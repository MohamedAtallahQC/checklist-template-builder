import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ChecklistItemStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({ enum: ChecklistItemStatus, example: ChecklistItemStatus.passed })
  @IsEnum(ChecklistItemStatus)
  status: ChecklistItemStatus;

  @ApiPropertyOptional({ example: 'All checks passed' })
  @IsOptional()
  @IsString()
  comment?: string;
}
