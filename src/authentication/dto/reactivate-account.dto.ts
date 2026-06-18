import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReactivateAccountDto {
  @ApiProperty({
    example: 'user@gmail.com',
    description: 'Unique email address for the account',
  })
  @IsEmail()
  email: string;
}
