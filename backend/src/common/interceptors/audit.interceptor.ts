import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../decorators/audit-log.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const SENSITIVE = new Set(['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'accessTokenEncrypted', 'tokenHash']);
    const copy = { ...obj };
    for (const key of Object.keys(copy)) {
      if (SENSITIVE.has(key)) copy[key] = '[REDACTED]';
    }
    return copy;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (data) => {
        try {
          await this.prisma.auditLog.create({
            data: {
              actorId: user?.id,
              actorEmail: user?.email,
              action: auditMetadata.action as any,
              resourceType: auditMetadata.resource,
              resourceId: data?.id,
              resourceName: data?.name || data?.email || data?.title,
              newValues: data ? this.sanitize(JSON.parse(JSON.stringify(data))) : null,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
              requestId: request.headers['x-request-id'],
              metadata: {
                method: request.method,
                path: request.path,
                duration: Date.now() - startTime,
              },
            },
          });
        } catch (error) {
          this.logger.error('Failed to create audit log', error?.message);
        }
      }),
    );
  }
}
