import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateSeatPricingDto {
    @ApiPropertyOptional({ example: 3.0 })
    @IsOptional()
    @IsNumber()
    seatSurcharge?: number;

}