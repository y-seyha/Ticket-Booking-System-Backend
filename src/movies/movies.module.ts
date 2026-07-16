import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [PrismaModule, FileUploadModule, SearchModule],
  controllers: [MoviesController],
  providers: [MoviesService],
})
export class MoviesModule {}
