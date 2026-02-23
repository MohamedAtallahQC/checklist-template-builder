import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsArray } from 'class-validator';
import { ChecklistItemStatus } from '@prisma/client';

export class AddResponseDto {
  @ApiPropertyOptional({ enum: ChecklistItemStatus })
  @IsOptional()
  @IsEnum(ChecklistItemStatus)
  previousStatus?: ChecklistItemStatus;

  @ApiPropertyOptional({ enum: ChecklistItemStatus })
  @IsOptional()
  @IsEnum(ChecklistItemStatus)
  newStatus?: ChecklistItemStatus;

  @ApiPropertyOptional({ example: 'Item was reviewed' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ example: ['https://example.com/evidence.png'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];
}
