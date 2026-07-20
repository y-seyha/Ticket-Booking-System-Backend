import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { TicketService } from './ticket.service';
import { ValidateTicketDto } from './dto/validate-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/role.decorator';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Get current user tickets' })
  getMyTickets(@CurrentUser() user: any, @Query() query: TicketQueryDto) {
    return this.ticketService.getUserTickets(user.id, query.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CASHIER')
  @ApiBearerAuth()
  @Get('orders')
  @ApiOperation({ summary: 'Get all confirmed orders for cashier dashboard' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'movieTitle', required: false })
  getCashierOrders(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('movieTitle') movieTitle?: string,
  ) {
    return this.ticketService.getCashierOrders({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      movieTitle,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CASHIER')
  @ApiBearerAuth()
  @Get('qr/:qrCode')
  @ApiOperation({ summary: 'Lookup ticket by QR code (cashier)' })
  lookupByQrCode(@Param('qrCode') qrCode: string) {
    return this.ticketService.lookupByQrCode(qrCode);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CASHIER')
  @ApiBearerAuth()
  @Post('validate')
  @ApiOperation({ summary: 'Validate ticket at entry (cashier)' })
  @ApiResponse({ status: 200, description: 'Ticket validated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Ticket already used/refunded/expired',
  })
  validateTicket(@CurrentUser() user: any, @Body() dto: ValidateTicketDto) {
    return this.ticketService.validateTicket(dto.qrCode, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get tickets by booking ID' })
  getTicketsByBooking(
    @CurrentUser() user: any,
    @Param('bookingId') bookingId: string,
  ) {
    return this.ticketService.getTicketsByBooking(bookingId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Get single ticket detail' })
  getTicketById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ticketService.getTicketById(id, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund a ticket (admin)' })
  refundTicket(@Param('id') id: string) {
    return this.ticketService.refundTicket(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({ summary: 'Get all tickets (admin)' })
  getAllTickets(@Query() query: TicketQueryDto) {
    return this.ticketService.getAllTickets(query.status);
  }
}
