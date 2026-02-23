import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class UserFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  roleName?: string;
}
