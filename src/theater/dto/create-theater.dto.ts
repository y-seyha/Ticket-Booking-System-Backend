import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TheaterStatus } from '@prisma/client';

export class CreateTheaterDto {
    @ApiProperty({ example: 'Legend Cinema AEON Mall' })
    @IsString()
    @MinLength(2)
    name: string;

    @ApiProperty({ example: '+85512345678', required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: 'cinema@email.com', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ example: '123 Street 310, Phnom Penh' })
    @IsString()
    location: string;

    @ApiProperty({ example: 'Phnom Penh' })
    @IsString()
    city: string;

    @ApiProperty({
        enum: TheaterStatus,
        example: TheaterStatus.ACTIVE,
    })
    @IsEnum(TheaterStatus)
    status: TheaterStatus;
}