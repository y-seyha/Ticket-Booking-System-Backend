import { Module } from '@nestjs/common';
import { SeatTemplateController } from './seat-template.controller';
import { SeatTemplateService } from './seat-template.service';

@Module({
  controllers: [SeatTemplateController],
  providers: [SeatTemplateService],
  exports: [SeatTemplateService],
})
export class SeatTemplateModule {}
