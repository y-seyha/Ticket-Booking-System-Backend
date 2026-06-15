import {
    IsString,
    IsOptional,
    IsInt,
    Min,
    IsDateString,
    IsEnum,
    IsUUID, IsDate,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MovieStatus } from '@prisma/client';
import {Type} from "class-transformer";

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

    // @ApiPropertyOptional({
    //     example: 'b0b3fd29-9b84-4d5e-bdb9-4f4e88f4e7c',
    //     description: 'Uploaded poster file id',
    // })
    // @IsOptional()
    // @IsUUID()
    // posterId?: string;

    @ApiPropertyOptional({
        example: 'avz06PDqDbM',
        description: 'Youtube Video ID only',
    })
    @IsOptional()
    @IsString()
    trailerYoutubeId?: string;

    @ApiProperty({
        enum: MovieStatus,
        example: MovieStatus.COMING_SOON,
    })
    @IsEnum(MovieStatus)
    status: MovieStatus;
}