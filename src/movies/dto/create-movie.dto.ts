import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsDate,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateMovieDto {
  @ApiProperty({
    example: 'Mission Impossible: Dead Reckoning',
    description: 'Movie title',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    example: 'Ethan Hunt returns for another mission.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 163,
    description: 'Movie duration in minutes',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiProperty({
    example: 'English',
  })
  @IsString()
  language: string;

  @ApiProperty({
    example: '2026-08-15',
  })
  @Type(() => Date)
  @IsDate()
  releaseDate: Date;

  @ApiPropertyOptional({
    example: 'avz06PDqDbM',
    description: 'Youtube Video ID only',
  })
  @IsOptional()
  @IsString()
  trailerYoutubeId?: string;

}

