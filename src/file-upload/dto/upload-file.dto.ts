import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum UploadFolder {
  AVATARS = 'avatars',
  MOVIES = 'movies',
  THEATERS = 'theaters',
  GENERAL = 'general',
}

export class UploadFileDto {
  @ApiPropertyOptional({
    enum: UploadFolder,
    default: UploadFolder.GENERAL,
    description: 'Cloudinary sub-folder where file will be stored',
    example: UploadFolder.AVATARS,
  })
  @IsOptional()
  @IsEnum(UploadFolder)
  folder: UploadFolder = UploadFolder.GENERAL;

  @ApiPropertyOptional({
    description: 'Optional file description',
    example: 'User profile avatar',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
