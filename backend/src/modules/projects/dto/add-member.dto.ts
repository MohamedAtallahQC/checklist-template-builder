import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsEnum } from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty({ example: 'uuid-of-user' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ enum: ProjectRole, example: ProjectRole.member })
  @IsOptional()
  @IsEnum(ProjectRole)
  role?: ProjectRole;
}
