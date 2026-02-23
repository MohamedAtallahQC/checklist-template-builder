import { Injectable, Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  InvalidCredentialsException,
  AccountLockedException,
  InvalidTokenException,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
} from '../../common/exceptions';
import { UserStatus } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_TIME_MINUTES = 30;
  private readonly userWithRolesInclude = {
    userRoles: {
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    },
  } as const;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) { }

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ResourceAlreadyExistsException('User', 'email', dto.email);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        status: UserStatus.pending,
      },
    });

    // Assign default 'user' role
    const userRole = await this.prisma.role.findUnique({
      where: { name: 'user' },
    });

    if (userRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: userRole.id,
        },
      });
    }

    // Log audit
    await this.logAudit(user.id, 'create', 'user', user.id);

    return {
      message: 'Registration successful. Please verify your email.',
      userId: user.id,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
      include: this.userWithRolesInclude,
    });

    if (!user) {
      throw new InvalidCredentialsException();
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AccountLockedException(user.lockedUntil);
    }

    // Check user status before verifying password to avoid unnecessary DB writes
    if (user.status !== UserStatus.active) {
      throw new InvalidCredentialsException();
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      throw new InvalidCredentialsException();
    }

    // Reset failed attempts on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Log audit
    await this.logAudit(user.id, 'login', 'user', user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        roles: user.userRoles.map((ur) => ur.role.name),
      },
    };
  }

  async logout(userId: string, refreshToken: string, accessToken?: string) {
    const tokenHash = this.hashToken(refreshToken);

    // Revoke refresh token in database
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Blacklist access token in Redis if provided
    if (accessToken) {
      try {
        const decoded: any = this.jwtService.decode(accessToken);
        if (decoded && decoded.exp) {
          const now = Math.floor(Date.now() / 1000);
          const ttl = decoded.exp - now;
          if (ttl > 0) {
            await this.redis.set(`blacklist:${accessToken}`, '1', 'EX', ttl);
          }
        }
      } catch (e) {
        this.logger.error(`Failed to blacklist token: ${e.message}`);
      }
    }

    await this.logAudit(userId, 'logout', 'user', userId);

    return { message: 'Logged out successfully' };
  }

  async refreshToken(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: this.userWithRolesInclude,
        },
      },
    });

    if (!storedToken) {
      throw new InvalidTokenException();
    }

    if (storedToken.revokedAt) {
      throw new InvalidTokenException();
    }

    if (storedToken.expiresAt < new Date()) {
      throw new InvalidTokenException();
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    return this.generateTokens(storedToken.user);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If the email exists, a reset link will be sent' };
    }

    // TODO: Generate reset token and send email
    // For now, just log
    this.logger.log(`Password reset requested for: ${email}`);

    return { message: 'If the email exists, a reset link will be sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    // TODO: Implement token validation
    throw new InvalidTokenException();
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      timezone: user.timezone,
      roles: user.userRoles.map((ur) => ur.role.name),
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        locale: dto.locale,
        timezone: dto.timezone,
      },
    });

    await this.logAudit(userId, 'update', 'user', userId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      locale: user.locale,
      timezone: user.timezone,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new InvalidCredentialsException();
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
      },
    });

    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.logAudit(userId, 'update', 'user', userId);

    return { message: 'Password changed successfully' };
  }

  private async generateTokens(user: any) {
    const roles = user.userRoles?.map((ur: any) => ur.role.name) || [];
    const permissions = user.userRoles?.flatMap(
      (ur: any) => ur.role.rolePermissions?.map(
        (rp: any) => `${rp.permission.resource}:${rp.permission.action}`,
      ) || [],
    ) || [];

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions: Array.from(new Set(permissions)) as string[],
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = nanoid(64);
    const tokenHash = this.hashToken(refreshToken);

    const refreshExpiration = this.configService.get<string>('jwt.refreshExpiration', '7d');
    const expiresAt = this.parseExpirationToDate(refreshExpiration);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.accessExpiration'),
    };
  }

  private async handleFailedLogin(userId: string, currentAttempts: number) {
    const newAttempts = currentAttempts + 1;
    const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
      failedLoginAttempts: newAttempts,
    };

    if (newAttempts >= this.MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + this.LOCK_TIME_MINUTES);
      updateData.lockedUntil = lockUntil;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpirationToDate(expiration: string): Date {
    const now = new Date();
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      now.setDate(now.getDate() + 7);
      return now;
    }
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': now.setSeconds(now.getSeconds() + value); break;
      case 'm': now.setMinutes(now.getMinutes() + value); break;
      case 'h': now.setHours(now.getHours() + value); break;
      case 'd': now.setDate(now.getDate() + value); break;
    }
    return now;
  }

  private async logAudit(
    actorId: string,
    action: string,
    resourceType: string,
    resourceId: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: action as any,
        resourceType,
        resourceId,
      },
    });
  }
}
