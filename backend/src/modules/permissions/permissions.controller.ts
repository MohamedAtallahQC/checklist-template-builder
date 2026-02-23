import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('permissions')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get('permissions')
  @Roles('admin')
  @ApiOperation({ summary: 'Get all permissions' })
  async findAllPermissions() {
    return this.permissionsService.findAllPermissions();
  }

  @Get('permission-rules')
  @Roles('admin')
  @ApiOperation({ summary: 'Get all permission rules' })
  async findAllRules() {
    return this.permissionsService.findAllRules();
  }

  @Post('permission-rules')
  @Roles('admin')
  @ApiOperation({ summary: 'Create permission rule' })
  async createRule(@Body() dto: any) {
    return this.permissionsService.createRule(dto);
  }

  @Patch('permission-rules/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update permission rule' })
  async updateRule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.permissionsService.updateRule(id, dto);
  }

  @Delete('permission-rules/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete permission rule' })
  async removeRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.removeRule(id);
  }
}
