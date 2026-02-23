import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsArray, IsBoolean } from 'class-validator';

export class UpdateTemplateDto {
  @ApiPropertyOptional({ example: 'My Template' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  columnConfig?: unknown[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}
