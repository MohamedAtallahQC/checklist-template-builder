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
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { TemplatesService } from './templates.service';
import { TemplateExportService } from './template-export.service';
import { TemplateImportService, ImportResult, ParsedTableData, ParsedMarkdownData } from './template-import.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, AuditLog } from '../../common/decorators';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto';

import { TemplateQueryDto } from './dto/template-query.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { InstantiateTemplateDto } from './dto/instantiate-template.dto';

@ApiTags('templates')
@Controller('templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TemplatesController {
  constructor(
    private templatesService: TemplatesService,
    private exportService: TemplateExportService,
    private importService: TemplateImportService,
  ) { }

  @Get()
  @ApiOperation({ summary: 'Get all templates' })
  async findAll(@Query() query: TemplateQueryDto) {
    return this.templatesService.findAll(query);
  }

  @Patch('reorder')
  @AuditLog('update', 'template')
  @ApiOperation({ summary: 'Reorder templates' })
  async reorder(@Body() dto: { orderedIds: string[] }) {
    return this.templatesService.reorder(dto.orderedIds);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  async findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @AuditLog('create', 'template')
  @ApiOperation({ summary: 'Create template' })
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: CurrentUserData) {
    return this.templatesService.create(dto, user.id);
  }

  @Patch(':id')
  @AuditLog('update', 'template')
  @ApiOperation({ summary: 'Update template' })
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @AuditLog('delete', 'template')
  @ApiOperation({ summary: 'Delete template' })
  async remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }

  @Post(':id/instantiate')
  @AuditLog('create', 'template')
  @ApiOperation({ summary: 'Create checklist instance from template' })
  async instantiate(@Param('id') id: string, @Body() dto: InstantiateTemplateDto, @CurrentUser() user: CurrentUserData) {
    return this.templatesService.instantiate(id, dto, user.id);
  }

  @Post(':id/duplicate')
  @AuditLog('create', 'template')
  @ApiOperation({ summary: 'Duplicate template' })
  async duplicate(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.templatesService.duplicate(id, user.id);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'Get template items' })
  async getItems(@Param('id') id: string) {
    return this.templatesService.getItems(id);
  }

  @Post(':id/items')
  @AuditLog('create', 'checklist-item')
  @ApiOperation({ summary: 'Create checklist item' })
  async createItem(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: CurrentUserData) {
    return this.templatesService.createItem(id, dto, user.id);
  }

  // ==================== EXPORT ENDPOINTS ====================

  @Get(':id/export/pdf')
  @AuditLog('export', 'template')
  @ApiOperation({ summary: 'Export template to PDF' })
  async exportToPdf(@Param('id') id: string, @Res() res: Response) {
    return this.exportService.exportToPdf(id, res);
  }

  @Get(':id/export/excel')
  @AuditLog('export', 'template')
  @ApiOperation({ summary: 'Export template to Excel' })
  async exportToExcel(@Param('id') id: string, @Res() res: Response) {
    return this.exportService.exportToExcel(id, res);
  }

  // ==================== IMPORT ENDPOINTS ====================

  @Post('import/excel')
  @AuditLog('import', 'template')
  @ApiOperation({ summary: 'Import template from Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        templateName: { type: 'string' },
        projectId: { type: 'string' },
        folderId: { type: 'string' },
        templateTypeId: { type: 'string' },
        restoreDeleted: { type: 'boolean', default: false },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { templateName?: string; projectId?: string; folderId?: string; templateTypeId?: string; restoreDeleted?: boolean | string },
    @CurrentUser() user: CurrentUserData,
  ): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (!validMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Please upload an Excel file (.xlsx or .xls)');
    }

    return this.importService.importFromExcel(file, {
      projectId: body.projectId,
      folderId: body.folderId,
      templateName: body.templateName,
      templateTypeId: body.templateTypeId,
      createdBy: user.id,
      restoreDeleted: body.restoreDeleted === 'true' || body.restoreDeleted === true,
    });
  }

  @Post('import/markdown')
  @AuditLog('import', 'template')
  @ApiOperation({ summary: 'Import template from Markdown content' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Markdown content with table' },
        templateName: { type: 'string' },
        projectId: { type: 'string' },
        folderId: { type: 'string' },
        templateTypeId: { type: 'string' },
        restoreDeleted: { type: 'boolean', default: false },
      },
      required: ['content'],
    },
  })
  async importFromMarkdown(
    @Body() body: { content: string; templateName?: string; projectId?: string; folderId?: string; templateTypeId?: string; restoreDeleted?: boolean },
    @CurrentUser() user: CurrentUserData,
  ): Promise<ImportResult> {
    if (!body.content || body.content.trim() === '') {
      throw new BadRequestException('Markdown content is required');
    }

    return this.importService.importFromMarkdown(body.content, {
      projectId: body.projectId,
      folderId: body.folderId,
      templateName: body.templateName,
      templateTypeId: body.templateTypeId,
      createdBy: user.id,
      restoreDeleted: body.restoreDeleted,
    });
  }

  @Post('import/markdown-file')
  @AuditLog('import', 'template')
  @ApiOperation({ summary: 'Import template from Markdown file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        templateName: { type: 'string' },
        projectId: { type: 'string' },
        folderId: { type: 'string' },
        templateTypeId: { type: 'string' },
        restoreDeleted: { type: 'boolean', default: false },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importFromMarkdownFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { templateName?: string; projectId?: string; folderId?: string; templateTypeId?: string; restoreDeleted?: boolean | string },
    @CurrentUser() user: CurrentUserData,
  ): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const validExtensions = ['.md', '.markdown', '.txt'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (!validExtensions.includes(ext)) {
      throw new BadRequestException('Invalid file type. Please upload a Markdown file (.md, .markdown, or .txt)');
    }

    const content = file.buffer.toString('utf-8');

    return this.importService.importFromMarkdown(content, {
      projectId: body.projectId,
      folderId: body.folderId,
      templateName: body.templateName,
      templateTypeId: body.templateTypeId,
      createdBy: user.id,
      restoreDeleted: body.restoreDeleted === 'true' || body.restoreDeleted === true,
    });
  }

  @Post('import/csv')
  @AuditLog('import', 'template')
  @ApiOperation({ summary: 'Import template from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        templateName: { type: 'string' },
        projectId: { type: 'string' },
        folderId: { type: 'string' },
        templateTypeId: { type: 'string' },
        delimiter: { type: 'string', description: 'CSV delimiter (default: comma)' },
        restoreDeleted: { type: 'boolean', default: false },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importFromCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { templateName?: string; projectId?: string; folderId?: string; templateTypeId?: string; delimiter?: string; restoreDeleted?: boolean | string },
    @CurrentUser() user: CurrentUserData,
  ): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const validExtensions = ['.csv'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (!validExtensions.includes(ext)) {
      throw new BadRequestException('Invalid file type. Please upload a CSV file (.csv)');
    }

    return this.importService.importFromCsv(file, {
      projectId: body.projectId,
      folderId: body.folderId,
      templateName: body.templateName,
      templateTypeId: body.templateTypeId,
      createdBy: user.id,
      delimiter: body.delimiter,
      restoreDeleted: body.restoreDeleted === 'true' || body.restoreDeleted === true,
    });
  }

  @Post('import/preview')
  @ApiOperation({ summary: 'Preview import data without creating template' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async previewImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { markdownContent?: string },
  ): Promise<ParsedTableData | ParsedMarkdownData> {
    return this.importService.previewImport(file || null, body.markdownContent || null);
  }
}
