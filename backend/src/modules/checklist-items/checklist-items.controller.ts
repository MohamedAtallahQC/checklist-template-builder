import { Controller, Get, Patch, Delete, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChecklistItemsService } from './checklist-items.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, AuditLog } from '../../common/decorators';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { AddResponseDto } from './dto/add-response.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiTags('checklist-items')
@Controller('items')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChecklistItemsController {
  constructor(private checklistItemsService: ChecklistItemsService) { }

  @Get(':id')
  @ApiOperation({ summary: 'Get item by ID' })
  async findOne(@Param('id') id: string) {
    return this.checklistItemsService.findOne(id);
  }

  @Patch(':id')
  @AuditLog('update', 'checklist-item')
  @ApiOperation({ summary: 'Update item' })
  async update(@Param('id') id: string, @Body() dto: UpdateChecklistItemDto) {
    return this.checklistItemsService.update(id, dto);
  }

  @Delete(':id')
  @AuditLog('delete', 'checklist-item')
  @ApiOperation({ summary: 'Delete item' })
  async remove(@Param('id') id: string) {
    return this.checklistItemsService.remove(id);
  }

  @Patch(':id/status')
  @AuditLog('update', 'checklist-item')
  @ApiOperation({ summary: 'Update item status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.checklistItemsService.updateStatus(id, dto.status, user.id, dto.comment);
  }

  @Post(':id/response')
  @ApiOperation({ summary: 'Add response to item' })
  async addResponse(
    @Param('id') id: string,
    @Body() dto: AddResponseDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.checklistItemsService.addResponse(id, dto, user.id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get item history' })
  async getHistory(@Param('id') id: string) {
    return this.checklistItemsService.getHistory(id);
  }
}
