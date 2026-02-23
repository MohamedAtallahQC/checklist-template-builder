import { Module } from '@nestjs/common';
import { TemplateTypesController } from './template-types.controller';
import { TemplateTypesService } from './template-types.service';

@Module({
  controllers: [TemplateTypesController],
  providers: [TemplateTypesService],
  exports: [TemplateTypesService],
})
export class TemplateTypesModule {}
