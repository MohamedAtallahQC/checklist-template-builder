import { SetMetadata } from '@nestjs/common';

export interface RequiredPermission {
  action: string;
  subject: string;
}

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Shorthand decorators for common permissions
export const CanCreate = (subject: string) =>
  Permissions({ action: 'create', subject });

export const CanRead = (subject: string) =>
  Permissions({ action: 'read', subject });

export const CanUpdate = (subject: string) =>
  Permissions({ action: 'update', subject });

export const CanDelete = (subject: string) =>
  Permissions({ action: 'delete', subject });

export const CanManage = (subject: string) =>
  Permissions({ action: 'manage', subject });
