import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { TemplateExportService } from './template-export.service';
import { TemplateImportService } from './template-import.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
    }),
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplateExportService, TemplateImportService],
  exports: [TemplatesService, TemplateExportService, TemplateImportService],
})
export class TemplatesModule {}
