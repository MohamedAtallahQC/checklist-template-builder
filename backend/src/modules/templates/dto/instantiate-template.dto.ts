import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class InstantiateTemplateDto {
  @ApiPropertyOptional({ example: 'My Instance' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'uuid-of-project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-folder' })
  @IsOptional()
  @IsUUID()
  folderId?: string;
}
