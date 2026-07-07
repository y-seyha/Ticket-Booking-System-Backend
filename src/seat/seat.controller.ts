import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SeatService } from './seat.service';
import { CreateSeatLockDto } from './dto/create-seat-lock.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';
import { UnlockSeatDto } from './dto/unlock-seat.dto';

@ApiTags('Seats')
@Controller('seats')
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('cart')
  getMyCart(@CurrentUser() user) {
    return this.seatService.getMyLockedSeats(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('cart/clear')
  @ApiOperation({ summary: 'Clear all locked seats in user cart' })
  clearCart(@CurrentUser() user) {
    return this.seatService.clearMyCart(user.id);
  }

  //done
  @Get('screen/:screenId')
  @ApiOperation({ summary: 'Get all seats in screen' })
  getSeats(@Param('screenId') screenId: string) {
    return this.seatService.getSeatsByScreen(screenId);
  }

  //done
  @Get('map/:showtimeId')
  @ApiOperation({ summary: 'Get seat map with lock + booking status' })
  getSeatMap(@Param('showtimeId') showtimeId: string) {
    return this.seatService.getSeatMap(showtimeId);
  }

  //done
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('lock')
  @ApiOperation({ summary: 'Lock seat (add to cart)' })
  @ApiResponse({ status: 201, description: 'Seat locked for 5 minutes' })
  lockSeat(@CurrentUser() user, @Body() dto: CreateSeatLockDto) {
    return this.seatService.lockSeat(user.id, dto);
  }

  //done
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('unlock')
  @ApiOperation({ summary: 'Unlock seat (remove from cart)' })
  unlockSeat(@CurrentUser() user, @Body() dto: UnlockSeatDto) {
    return this.seatService.unlockSeat(user.id, dto.seatId, dto.showtimeId);
  }
}
