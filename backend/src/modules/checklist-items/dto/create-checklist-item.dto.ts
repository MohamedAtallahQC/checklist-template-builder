import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsInt, Min } from 'class-validator';

export class CreateChecklistItemDto {
  @ApiPropertyOptional({ example: 'uuid-of-parent' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ example: { text: 'Check this item' } })
  @IsOptional()
  content?: unknown;
}
