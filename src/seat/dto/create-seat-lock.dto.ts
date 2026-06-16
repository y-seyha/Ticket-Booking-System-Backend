import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateSeatLockDto {
    @ApiProperty({ example: 'seat-id-uuid' })
    @IsUUID()
    seatId: string;

    @ApiProperty({ example: 'showtime-id-uuid' })
    @IsUUID()
    showtimeId: string;
}