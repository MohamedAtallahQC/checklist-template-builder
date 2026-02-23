import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TemplateTypesService } from './template-types.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser, AuditLog } from '../../common/decorators';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateTemplateTypeDto } from './dto/create-template-type.dto';
import { UpdateTemplateTypeDto } from './dto/update-template-type.dto';

@ApiTags('template-types')
@Controller('template-types')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TemplateTypesController {
  constructor(private templateTypesService: TemplateTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all template types' })
  async findAll() {
    return this.templateTypesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template type by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templateTypesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @AuditLog('create', 'template-type')
  @ApiOperation({ summary: 'Create template type' })
  async create(@Body() dto: CreateTemplateTypeDto, @CurrentUser() user: CurrentUserData) {
    return this.templateTypesService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @AuditLog('update', 'template-type')
  @ApiOperation({ summary: 'Update template type' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateTypeDto) {
    return this.templateTypesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @AuditLog('delete', 'template-type')
  @ApiOperation({ summary: 'Delete template type' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.templateTypesService.remove(id);
  }
}
