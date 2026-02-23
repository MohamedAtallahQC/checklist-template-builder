import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, IsUUID, IsObject, IsArray, IsBoolean } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'My Template' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'uuid-of-template-type' })
  @IsUUID()
  templateTypeId: string;

  @ApiPropertyOptional({ example: 'uuid-of-project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-folder' })
  @IsOptional()
  @IsUUID()
  folderId?: string;

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
  restoreDeleted?: boolean;
}
