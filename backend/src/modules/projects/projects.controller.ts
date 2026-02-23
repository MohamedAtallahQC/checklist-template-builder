import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, AuditLog } from '../../common/decorators';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) { }

  @Get()
  @ApiOperation({ summary: 'Get all accessible projects' })
  async findAll(@Query() pagination: PaginationDto, @CurrentUser() user: CurrentUserData) {
    return this.projectsService.findAll(pagination, user.id, user.roles);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @AuditLog('create', 'project')
  @ApiOperation({ summary: 'Create a new project' })
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: CurrentUserData) {
    return this.projectsService.create(dto, user.id);
  }

  @Patch(':id')
  @AuditLog('update', 'project')
  @ApiOperation({ summary: 'Update project' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @AuditLog('delete', 'project')
  @ApiOperation({ summary: 'Delete project' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.remove(id);
  }

  @Get(':id/users')
  @ApiOperation({ summary: 'Get project members' })
  async getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.getMembers(id);
  }

  @Post(':id/users')
  @AuditLog('assign', 'project')
  @ApiOperation({ summary: 'Add user to project' })
  async addMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddMemberDto) {
    return this.projectsService.addMember(id, dto);
  }

  @Delete(':id/users/:userId')
  @ApiOperation({ summary: 'Remove user from project' })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.projectsService.removeMember(id, userId);
  }
}
