import { IsUUID, IsDateString, IsEnum, IsNumber, Min } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { ShowtimeStatus } from '@prisma/client';

export class CreateShowtimeDto {
  @ApiProperty({
    example: 'a5d6b8c7-1234-5678-9999-abcdef123456',
    description: 'Movie ID',
  })
  @IsUUID()
  movieId: string;

  @ApiProperty({
    example: 'f6d6b8c7-1234-5678-9999-abcdef123456',
    description: 'Screen ID',
  })
  @IsUUID()
  screenId: string;

  @ApiProperty({
    example: '2026-07-01T14:00:00.000Z',
    description: 'Showtime start time',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    example: '2026-07-01T16:30:00.000Z',
    description: 'Showtime end time',
  })
  @IsDateString()
  endTime: string;

  @ApiProperty({
    example: 5.5,
    description: 'Ticket price',
  })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({
    enum: ShowtimeStatus,
    example: ShowtimeStatus.SCHEDULED,
  })
  @IsEnum(ShowtimeStatus)
  status: ShowtimeStatus;
}
