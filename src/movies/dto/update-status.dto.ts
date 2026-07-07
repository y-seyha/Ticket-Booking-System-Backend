import { MovieStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMovieStatusDto {
  @IsEnum(MovieStatus)
  status: MovieStatus;
}
