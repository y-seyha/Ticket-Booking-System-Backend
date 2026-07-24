import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { SeatPricingService } from './seat-pricing.service';
import { CreateSeatPricingDto } from './dto/create-seat-pricing.dto';
import { UpdateSeatPricingDto } from './dto/update-seat-pricing.dto';

import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { SeatType } from '@prisma/client';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/role.decorator';

@ApiTags('Seat Pricing (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('seat-pricing')
export class SeatPricingController {
  constructor(private readonly service: SeatPricingService) {}

  @Post()
  @ApiOperation({ summary: 'Create seat pricing rule' })
  @ApiResponse({ status: 201, description: 'Created successfully' })
  create(@Body() dto: CreateSeatPricingDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all seat pricing rules' })
  findAll() {
    return this.service.findAll();
  }

  @Patch(':seatType/toggle-active')
  @ApiOperation({ summary: 'Toggle seat pricing active status' })
  @ApiResponse({ status: 200, description: 'Toggled successfully' })
  toggle(@Param('seatType') seatType: SeatType) {
    return this.service.toggleActive(seatType);
  }

  @Get(':seatType')
  @ApiOperation({ summary: 'Get seat pricing by seat types' })
  findOne(@Param('seatType') seatType: string) {
    return this.service.findOne(seatType);
  }

  @Patch(':seatType')
  @ApiOperation({ summary: 'Update seat pricing rule' })
  update(
    @Param('seatType') seatType: string,
    @Body() dto: UpdateSeatPricingDto,
  ) {
    return this.service.update(seatType, dto);
  }

  @Delete(':seatType')
  @ApiOperation({ summary: 'Delete seat pricing rule' })
  remove(@Param('seatType') seatType: string) {
    return this.service.remove(seatType);
  }
}
