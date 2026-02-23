import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };

  @ApiProperty()
  timestamp: string;

  @ApiPropertyOptional()
  requestId?: string;

  static success<T>(data: T, message?: string): ApiResponseDto<T> {
    const response = new ApiResponseDto<T>();
    response.success = true;
    response.data = data;
    response.message = message;
    response.timestamp = new Date().toISOString();
    return response;
  }

  static error(
    code: string,
    message: string,
    details?: Record<string, any>,
  ): ApiResponseDto<null> {
    const response = new ApiResponseDto<null>();
    response.success = false;
    response.error = { code, message, details };
    response.timestamp = new Date().toISOString();
    return response;
  }
}
