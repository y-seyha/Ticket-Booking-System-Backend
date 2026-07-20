import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { CloudinaryService } from './cloudinary/cloudinary.service';
import { CloudinaryProvider } from '../provider/cloudinary.provider';

@Module({
  providers: [
    FileUploadService,
    CloudinaryService,
    CloudinaryProvider,
  ],
  controllers: [FileUploadController],
  exports: [FileUploadService],
})
export class FileUploadModule {}
