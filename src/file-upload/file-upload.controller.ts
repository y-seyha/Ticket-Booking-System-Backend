import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from './file-upload.service';
import { UploadFileDto } from './dto/upload-file.dto';

import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';
import { memoryStorage } from 'multer';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FileUploadController {
  constructor(private readonly fileService: FileUploadService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  @ApiOperation({ summary: 'Upload a file (Cloudinary)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        folder: {
          type: 'string',
          enum: ['avatars', 'movies', 'theaters', 'general'],
          default: 'general',
        },
        description: {
          type: 'string',
          example: 'Optional file description',
        },
      },
    },
  })
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: any,
  ) {
    return this.fileService.uploadFile(file, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file (owner or admin only)' })
  @ApiParam({
    name: 'id',
    description: 'File ID',
    example: 'c1a2b3d4-xxxx-xxxx',
  })
  deleteFile(@Param('id') id: string, @CurrentUser() user: any) {
    return this.fileService.deleteFile(id, user);
  }
}
