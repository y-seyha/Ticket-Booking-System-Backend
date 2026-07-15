import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class TicketQueryDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
