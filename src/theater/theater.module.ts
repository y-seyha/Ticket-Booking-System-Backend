import { Module } from '@nestjs/common';
import { TheaterController } from './theater.controller';
import { TheaterService } from './theater.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [PrismaModule, FileUploadModule, SearchModule],
  controllers: [TheaterController],
  providers: [TheaterService],
})
export class TheaterModule {}
