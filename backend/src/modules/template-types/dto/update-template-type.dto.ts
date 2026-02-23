import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, IsObject, IsArray, IsBoolean } from 'class-validator';

export class UpdateTemplateTypeDto {
  @ApiPropertyOptional({ example: 'Audit Checklist' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @ApiPropertyOptional({ example: 'For audit processes' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '✅' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  defaultColumns?: unknown[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
