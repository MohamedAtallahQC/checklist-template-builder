import { SetMetadata } from '@nestjs/common';

export interface AuditLogMetadata {
  action: string;
  resource: string;
}

export const AUDIT_LOG_KEY = 'auditLog';
export const AuditLog = (action: string, resource: string) =>
  SetMetadata(AUDIT_LOG_KEY, { action, resource } as AuditLogMetadata);
