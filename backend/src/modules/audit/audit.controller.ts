import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('audit-logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth('JWT-auth')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs' })
  async findAll(@Query() query: any) {
    return this.auditService.findAll(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export audit logs' })
  async export(@Query() query: any, @Res() res: Response) {
    return this.auditService.export(query, res);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get audit statistics' })
  async getStats(@Query() query: any) {
    return this.auditService.getStats(query);
  }
}
