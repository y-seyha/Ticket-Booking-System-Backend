import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ValidateTicketDto {
  @ApiProperty({ example: 'TKT-a3Bx9kQm' })
  @IsString()
  qrCode: string;
}
