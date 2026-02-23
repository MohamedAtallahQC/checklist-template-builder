import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from './business.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let code: string;
    let message: string;
    let details: Record<string, any> | undefined;

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, any>;
        code = responseObj.error || 'HTTP_ERROR';
        message = Array.isArray(responseObj.message)
          ? responseObj.message.join(', ')
          : responseObj.message || exception.message;
      } else {
        code = 'HTTP_ERROR';
        message = exception.message;
      }
    } else if (exception?.constructor?.name === 'PrismaClientKnownRequestError') {
      // Prisma error codes: https://www.prisma.io/docs/reference/api-reference/error-reference#prisma-client-query-engine
      const prismaException = exception as any;
      if (prismaException.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'RESOURCE_ALREADY_EXISTS';
        const target = prismaException.meta?.target;
        message = target
          ? `Resource with ${Array.isArray(target) ? target.join(', ') : target} already exists`
          : 'Resource already exists';
      } else {
        status = HttpStatus.BAD_REQUEST;
        code = `PRISMA_${prismaException.code}`;
        message = 'Database operation failed';
      }
      this.logger.error(`Prisma error ${prismaException.code}: ${prismaException.message}`);
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected error occurred';

      // Log the full error for debugging
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected error occurred';
    }

    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'] as string,
    };

    response.status(status).json(errorResponse);
  }
}
