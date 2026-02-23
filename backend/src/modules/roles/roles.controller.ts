import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { SyncRolePermissionsDto } from './dto/sync-permissions.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class RolesController {
  constructor(private rolesService: RolesService) { }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, description: 'Return all roles' })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiResponse({ status: 200, description: 'Return role by ID' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Post(':id/permissions')
  @Roles('admin')
  @ApiOperation({ summary: 'Sync role permissions' })
  @ApiResponse({ status: 200, description: 'Permissions updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - cannot modify system admin role' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async syncPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SyncRolePermissionsDto,
  ) {
    return this.rolesService.syncPermissions(id, dto.permissionIds);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new role' })
  async create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update role' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete role' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }
}
