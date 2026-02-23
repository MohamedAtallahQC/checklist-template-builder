import { Module } from '@nestjs/common';
import { ClickupController } from './clickup.controller';
import { ClickupService } from './clickup.service';

@Module({
  controllers: [ClickupController],
  providers: [ClickupService],
  exports: [ClickupService],
})
export class ClickupModule {}
