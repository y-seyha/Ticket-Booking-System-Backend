import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Res,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../authentication/decorators/role.decorator';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { RefundsService } from './refunds.service';
import {
  AdminRefundsQueryDto,
  AdminRefundsExportDto,
} from './dto/refunds-query.dto';
import { TicketService } from '../ticket/ticket.service';

@ApiTags('Refunds Admin')
@Controller('refunds/admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class RefundsController {
  private readonly logger = new Logger(RefundsController.name);

  constructor(
    private readonly refundsService: RefundsService,
    private readonly ticketService: TicketService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all refunded tickets' })
  findAll(@Query() query: AdminRefundsQueryDto) {
    return this.refundsService.findAll(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export refunds as CSV' })
  async export(@Query() query: AdminRefundsExportDto, @Res() res: Response) {
    const result = await this.refundsService.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.csv);
  }

  @Patch(':ticketId/refund')
  @ApiOperation({ summary: 'Admin refund a ticket' })
  async refundTicket(@Param('ticketId') ticketId: string) {
    const ticket = await this.ticketService.refundTicket(ticketId);
    return this.refundsService.afterRefund(ticket);
  }
}
