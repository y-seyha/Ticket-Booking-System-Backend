import { Controller, Get, Param, Query, UseGuards, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../authentication/decorators/role.decorator';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { PaymentService } from './payment.service';
import {
  AdminPaymentsQueryDto,
  AdminPaymentExportDto,
} from './dto/admin-payments-query.dto';

@ApiTags('Payments Admin')
@Controller('payments/admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class PaymentAdminController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @ApiOperation({ summary: 'List all payments with pagination and filters' })
  findAll(@Query() query: AdminPaymentsQueryDto) {
    return this.paymentService.adminFindAll(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export payments as CSV' })
  async export(@Query() query: AdminPaymentExportDto, @Res() res: Response) {
    const result = await this.paymentService.adminExportCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment detail' })
  findOne(@Param('id') id: string) {
    return this.paymentService.adminFindOne(id);
  }
}
