import {IsUUID} from 'class-validator';

import {
    ApiProperty,
} from '@nestjs/swagger';

export class PayDto {
    @ApiProperty({example: 'e6f3e4a2-c1fd-4c64-a46d-bf8f8b8e9c99', description: 'Payment ID generated during checkout'})
    @IsUUID()
    paymentId: string;
}