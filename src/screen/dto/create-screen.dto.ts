import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ScreenType } from '@prisma/client';

export class CreateScreenDto {
  @ApiProperty({ example: 'theater-id' })
  @IsUUID()
  theaterId: string;

  @ApiProperty({ example: 'template-id' })
  @IsUUID()
  templateId: string;

  @ApiProperty({ example: 'layout-variant-id' })
  @IsUUID()
  layoutId: string;

  @ApiProperty({ example: 'Screen 1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ScreenType })
  @IsEnum(ScreenType)
  type: ScreenType;
}
