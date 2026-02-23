import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import Redis from 'ioredis';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const accessToken = req.headers.authorization?.split(' ')[1];

    if (accessToken) {
      const isBlacklisted = await this.redis.get(`blacklist:${accessToken}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
