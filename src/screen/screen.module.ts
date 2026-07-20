import { Module } from '@nestjs/common';
import { ScreenService } from './screen.service';
import { ScreenController } from './screen.controller';

@Module({
  controllers: [ScreenController],
  providers: [ScreenService],
})
export class ScreenModule {}
