import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'editor' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'Editor' })
  @IsString()
  @MaxLength(100)
  displayName: string;

  @ApiPropertyOptional({ example: 'Can edit content' })
  @IsOptional()
  @IsString()
  description?: string;
}
