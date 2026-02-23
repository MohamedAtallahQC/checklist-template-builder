import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser, AuditLog } from '../../common/decorators';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll(@Query() filter: UserFilterDto) {
    return this.usersService.findAll(filter);
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles('admin')
  @AuditLog('create', 'user')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.usersService.create(dto, currentUser.id);
  }

  @Patch(':id')
  @Roles('admin')
  @AuditLog('update', 'user')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @AuditLog('delete', 'user')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.usersService.remove(id, currentUser.id);
  }

  @Post(':id/roles')
  @Roles('admin')
  @AuditLog('assign', 'user')
  @ApiOperation({ summary: 'Assign roles to user' })
  @ApiResponse({ status: 200, description: 'Roles assigned' })
  async assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('roleIds') roleIds: string[],
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.usersService.assignRoles(id, roleIds, currentUser.id);
  }

  @Patch(':id/status')
  @Roles('admin')
  @AuditLog('update', 'user')
  @ApiOperation({ summary: 'Change user status' })
  @ApiResponse({ status: 200, description: 'Status changed' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ) {
    return this.usersService.changeStatus(id, status);
  }
}
