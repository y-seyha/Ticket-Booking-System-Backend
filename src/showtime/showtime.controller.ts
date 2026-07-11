/* eslint-disable */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post, Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {MovieStatus, Role, ShowtimeStatus} from '@prisma/client';

import { ShowtimeService } from './showtime.service';
import { CreateShowtimeDto } from './dto/create-showtime.dto';
import { UpdateShowtimeDto } from './dto/update-showtime.dto';

import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/role.decorator';
import { CreateBulkScheduleDto } from './dto/create-bulk-showtime.dto';

@ApiTags('Showtimes')
@ApiBearerAuth()
@Controller('showtimes')
export class ShowtimeController {
  constructor(private readonly showtimeService: ShowtimeService) {}

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk generate showtime matrix (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Bulk schedule generated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date parameters or inputs provided.',
  })
  @ApiResponse({
    status: 404,
    description: 'Target movie metadata profile entity not found.',
  })
  async createBulk(@Body() dto: CreateBulkScheduleDto) {
    return this.showtimeService.createBulkSchedule(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create showtime' })
  @ApiResponse({ status: 201, description: 'Showtime created successfully' })
  create(@Body() dto: CreateShowtimeDto) {
    return this.showtimeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all showtimes' })
  findAll() {
    return this.showtimeService.findAll();
  }

  @Get('movie/:movieId')
  @ApiOperation({ summary: 'Get showtimes by movie' })
  findByMovie(@Param('movieId') movieId: string) {
    return this.showtimeService.findByMovie(movieId);
  }

  @Get('active/listings')
  @ApiOperation({
    summary: 'Get active grouped showtimes filtered by status and date',
  })
  findActiveListings(
    @Query('status') status: MovieStatus,
    @Query('date') dateStr: string,
  ) {
    return this.showtimeService.findActiveListings(status, dateStr);
  }

  @Get('screen/:screenId')
  @ApiOperation({ summary: 'Get showtimes by screen' })
  findByScreen(@Param('screenId') screenId: string) {
    return this.showtimeService.findByScreen(screenId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get showtime by id' })
  findOne(@Param('id') id: string) {
    return this.showtimeService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update showtime' })
  update(@Param('id') id: string, @Body() dto: UpdateShowtimeDto) {
    return this.showtimeService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update showtime status' })
  @ApiResponse({
    status: 200,
    description: 'Showtime status updated successfully',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ShowtimeStatus,
  ) {
    return this.showtimeService.updateStatus(id, status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete showtime' })
  remove(@Param('id') id: string) {
    return this.showtimeService.remove(id);
  }
}
