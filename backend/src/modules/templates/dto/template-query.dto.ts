import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class TemplateQueryDto extends PaginationDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    projectId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    folderId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    showAll?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    includeInstances?: boolean;
}
