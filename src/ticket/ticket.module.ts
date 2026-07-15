import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TicketController],
  providers: [TicketService, PrismaService],
  exports: [TicketService],
})
export class TicketModule {}
