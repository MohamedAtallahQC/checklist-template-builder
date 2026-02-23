import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FoldersService } from './folders.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, AuditLog } from '../../common/decorators';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

@ApiTags('folders')
@Controller('projects/:projectId/folders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FoldersController {
  constructor(private foldersService: FoldersService) {}

  @Get()
  @ApiOperation({ summary: 'Get root folders' })
  async findAll(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.foldersService.findByProject(projectId);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get full folder tree' })
  async getTree(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.foldersService.getTree(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get folder with children' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.foldersService.findOne(id);
  }

  @Post()
  @AuditLog('create', 'folder')
  @ApiOperation({ summary: 'Create folder' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.foldersService.create(projectId, dto, user.id);
  }

  @Patch(':id')
  @AuditLog('update', 'folder')
  @ApiOperation({ summary: 'Update folder' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFolderDto) {
    return this.foldersService.update(id, dto);
  }

  @Delete(':id')
  @AuditLog('delete', 'folder')
  @ApiOperation({ summary: 'Delete folder' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.foldersService.remove(id);
  }

  @Post(':id/move')
  @ApiOperation({ summary: 'Move folder' })
  async move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.foldersService.move(id, dto.parentId);
  }
}
