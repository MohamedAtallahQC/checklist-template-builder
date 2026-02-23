import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(
    code: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
  ) {
    super({ code, message, details }, statusCode);
    this.code = code;
    this.details = details;
  }
}

export class ResourceNotFoundException extends BusinessException {
  constructor(resource: string, id: string) {
    super(
      'RESOURCE_NOT_FOUND',
      `${resource} with ID ${id} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ResourceAlreadyExistsException extends BusinessException {
  constructor(resource: string, field: string, value: string) {
    super(
      'RESOURCE_ALREADY_EXISTS',
      `${resource} with ${field} "${value}" already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class InsufficientPermissionsException extends BusinessException {
  constructor(action: string, resource: string) {
    super(
      'INSUFFICIENT_PERMISSIONS',
      `You do not have permission to ${action} this ${resource}`,
      HttpStatus.FORBIDDEN,
    );
  }
}

export class InvalidCredentialsException extends BusinessException {
  constructor() {
    super(
      'INVALID_CREDENTIALS',
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class TokenExpiredException extends BusinessException {
  constructor() {
    super(
      'TOKEN_EXPIRED',
      'The token has expired',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class InvalidTokenException extends BusinessException {
  constructor() {
    super(
      'INVALID_TOKEN',
      'The token is invalid',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AccountLockedException extends BusinessException {
  constructor(unlockTime?: Date) {
    super(
      'ACCOUNT_LOCKED',
      unlockTime
        ? `Account is locked until ${unlockTime.toISOString()}`
        : 'Account is locked due to too many failed login attempts',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ValidationException extends BusinessException {
  constructor(errors: Record<string, string[]>) {
    super(
      'VALIDATION_ERROR',
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      errors,
    );
  }
}

export class DeletedResourceFoundException extends BusinessException {
  constructor(resource: string, field: string, value: string) {
    super(
      'SOFT_DELETED_RESOURCE_FOUND',
      `A deleted ${resource} with this ${field} was found. Do you want to restore it?`,
      HttpStatus.CONFLICT,
      { resource, field, value }
    );
  }
}

