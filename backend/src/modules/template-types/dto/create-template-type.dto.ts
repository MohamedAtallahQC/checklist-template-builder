import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, Matches, IsObject, IsArray, IsBoolean } from 'class-validator';

export class CreateTemplateTypeDto {
  @ApiProperty({ example: 'audit_checklist' })
  @IsString()
  @Matches(/^[a-z0-9_]+$/, { message: 'name must be lowercase alphanumeric with underscores' })
  name: string;

  @ApiProperty({ example: 'Audit Checklist' })
  @IsString()
  @MinLength(1)
  displayName: string;

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

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  restoreDeleted?: boolean;
}
