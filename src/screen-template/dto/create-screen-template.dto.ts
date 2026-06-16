import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScreenType } from '@prisma/client';

export class CreateScreenTemplateDto {
    @ApiProperty({
        example: 'IMAX Large Layout',
        description: 'Name of screen template',
        minLength: 3,
    })
    @IsString()
    @MinLength(3)
    name: string;

    @ApiProperty({
        example: ScreenType.IMAX,
        enum: ScreenType,
        description: 'Screen type (STANDARD / VIP / IMAX)',
    })
    @IsEnum(ScreenType)
    type: ScreenType;

    @ApiPropertyOptional({
        example: 'Best layout for IMAX cinema',
        description: 'Optional description',
    })
    @IsOptional()
    @IsString()
    description?: string;
}