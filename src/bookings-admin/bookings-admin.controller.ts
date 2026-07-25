import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../authentication/decorators/role.decorator';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { BookingsAdminService } from './bookings-admin.service';
import {
  AdminBookingsQueryDto,
  AdminBookingExportDto,
} from './dto/bookings-admin-query.dto';

@ApiTags('Bookings Admin')
@Controller('bookings/admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class BookingsAdminController {
  constructor(private readonly bookingsAdminService: BookingsAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all bookings with pagination and filters' })
  findAll(@Query() query: AdminBookingsQueryDto) {
    return this.bookingsAdminService.findAll(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export bookings as CSV' })
  async export(@Query() query: AdminBookingExportDto, @Res() res: Response) {
    const result = await this.bookingsAdminService.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking detail' })
  findOne(@Param('id') id: string) {
    return this.bookingsAdminService.findOne(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking (admin)' })
  cancel(@Param('id') id: string) {
    return this.bookingsAdminService.cancel(id);
  }
}
