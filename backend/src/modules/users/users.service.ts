import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
  BusinessException,
  DeletedResourceFoundException,
} from '../../common/exceptions';
import { createPaginatedResult } from '../../common/dto';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findAll(filter: UserFilterDto) {
    const where: any = {
      deletedAt: null,
    };

    if (filter.search) {
      where.OR = [
        { email: { contains: filter.search, mode: 'insensitive' } },
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
        { phoneNumber: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.roleId || filter.roleName) {
      where.userRoles = {
        some: {
          role: {
            OR: [
              filter.roleId ? { id: filter.roleId } : {},
              filter.roleName ? { name: filter.roleName } : {},
            ].filter(obj => Object.keys(obj).length > 0),
          },
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: {
          [filter.sortBy || 'createdAt']: filter.sortOrder || 'desc',
        },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const mappedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      status: user.status,
      roles: user.userRoles.map((ur) => ur.role.name),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    }));

    return createPaginatedResult(mappedUsers, total, filter.page || 1, filter.limit || 20);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl,
      status: user.status,
      locale: user.locale,
      timezone: user.timezone,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        displayName: ur.role.displayName,
      })),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  async create(dto: CreateUserDto, createdBy?: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email.toLowerCase() },
          dto.phoneNumber ? { phoneNumber: dto.phoneNumber } : {},
        ].filter(obj => Object.keys(obj).length > 0),
        ['_bypassSoftDelete' as any]: true,
      } as any
    });

    if (existingUser) {
      if (existingUser.deletedAt) {
        if (dto.restoreDeleted) {
          // Restore the user
          const passwordHash = await bcrypt.hash(dto.password, 10);
          const user = await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              email: dto.email.toLowerCase(),
              passwordHash,
              firstName: dto.firstName,
              lastName: dto.lastName,
              phoneNumber: dto.phoneNumber,
              status: dto.status || UserStatus.active,
              deletedAt: null,
            }
          });

          if (dto.roleIds?.length) {
            await this.assignRoles(user.id, dto.roleIds, createdBy);
          }

          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            status: user.status,
            restored: true
          };
        } else {
          // Found deleted user but no instruction to restore - tell frontend
          throw new DeletedResourceFoundException('User', existingUser.email === dto.email.toLowerCase() ? 'email' : 'phone number', dto.email);
        }
      }

      // If active user found
      if (existingUser.email === dto.email.toLowerCase()) {
        throw new ResourceAlreadyExistsException('User', 'email', dto.email);
      } else {
        throw new ResourceAlreadyExistsException('User', 'phoneNumber', dto.phoneNumber);
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        status: dto.status || UserStatus.active,
      },
    });

    // Assign roles if provided
    if (dto.roleIds?.length) {
      await this.assignRoles(user.id, dto.roleIds, createdBy);
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    const updateData: any = {};

    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.phoneNumber) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phoneNumber: dto.phoneNumber, id: { not: id } },
      });
      if (existingPhone) {
        throw new ResourceAlreadyExistsException('User', 'phoneNumber', dto.phoneNumber);
      }
      updateData.phoneNumber = dto.phoneNumber;
    }
    if (dto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: dto.email.toLowerCase(), id: { not: id } },
      });
      if (existingEmail) {
        throw new ResourceAlreadyExistsException('User', 'email', dto.email);
      }
      updateData.email = dto.email.toLowerCase();
    }
    if (dto.status) updateData.status = dto.status;
    if (dto.locale) updateData.locale = dto.locale;
    if (dto.timezone) updateData.timezone = dto.timezone;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    if (dto.roleIds) {
      await this.assignRoles(id, dto.roleIds);
    }

    return this.findOne(id);
  }

  async remove(id: string, currentUserId?: string) {
    if (id === currentUserId) {
      throw new BusinessException('SELF_DELETION', 'Admins cannot delete themselves', 400);
    }

    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: UserStatus.inactive // Also set status to inactive
      },
    });

    return { message: 'User deleted successfully' };
  }

  async assignRoles(userId: string, roleIds: string[], assignedBy?: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId, roleId, assignedBy })),
        });
      }
    });

    return { message: 'Roles assigned successfully' };
  }

  async changeStatus(id: string, status: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: status as UserStatus },
    });

    return { message: 'Status updated successfully' };
  }
}
