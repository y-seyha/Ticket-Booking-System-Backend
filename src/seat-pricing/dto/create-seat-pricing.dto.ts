import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { SeatType } from '@prisma/client';

export class CreateSeatPricingDto {
    @ApiProperty({
        enum: SeatType,
        example: SeatType.VIP,
        description: 'Seat types to apply pricing rule',
    })
    @IsEnum(SeatType)
    seatType: SeatType;

    @ApiProperty({
        example: 2.5,
        description: 'Extra surcharge for this seat types',
    })
    @IsNumber()
    seatSurcharge: number;

    @ApiProperty({
        example: true,
        required: false,
        description: 'Whether this pricing rule is active',
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}