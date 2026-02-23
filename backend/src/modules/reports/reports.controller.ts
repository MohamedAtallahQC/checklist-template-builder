import { Controller, Get, Post, Delete, Body, Param, Query, Res, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, AuditLog } from '../../common/decorators';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all reports' })
  async findAll(@Query() query: PaginationDto, @CurrentUser() user: CurrentUserData) {
    return this.reportsService.findAll(query, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.findOne(id);
  }

  @Post()
  @AuditLog('create', 'report')
  @ApiOperation({ summary: 'Generate new report' })
  async create(@Body() dto: any, @CurrentUser() user: CurrentUserData) {
    return this.reportsService.create(dto, user.id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download report file' })
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    return this.reportsService.download(id, res);
  }

  @Delete(':id')
  @AuditLog('delete', 'report')
  @ApiOperation({ summary: 'Delete report' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.remove(id);
  }
}
