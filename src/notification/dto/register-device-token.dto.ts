import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM device token' })
  @IsString()
  token: string;

  @ApiPropertyOptional({
    description: 'Device platform',
    default: 'web',
  })
  @IsOptional()
  @IsString()
  @IsIn(['web', 'ios', 'android'])
  platform?: string;
}

export class UnregisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM device token to remove' })
  @IsString()
  token: string;
}
