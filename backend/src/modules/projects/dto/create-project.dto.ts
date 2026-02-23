import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, IsBoolean } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'My Project' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Project description' })
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

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  restoreDeleted?: boolean;
}
