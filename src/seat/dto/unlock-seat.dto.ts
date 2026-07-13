import { IsString } from 'class-validator';

export class UnlockSeatDto {
  @IsString()
  showtimeId: string;

  @IsString()
  seatId: string;
}
