import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, IsInt, Min } from 'class-validator';

export class UpdateFolderDto {
  @ApiPropertyOptional({ example: 'My Folder' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Folder description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '📁' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
