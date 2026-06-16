import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    Req,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiTags,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { SeatService } from './seat.service';
import { CreateSeatLockDto } from './dto/create-seat-lock.dto';
import {JwtAuthGuard} from "../authentication/guards/jwt-auth.guard";
import {CurrentUser} from "../authentication/decorators/current-user.decorator";


@ApiTags('Seats')
@Controller('seats')
export class SeatController {
    constructor(private readonly seatService: SeatService) {}

    @Get('screen/:screenId')
    @ApiOperation({ summary: 'Get all seats in screen' })
    getSeats(@Param('screenId') screenId: string) {
        return this.seatService.getSeatsByScreen(screenId);
    }

    @Get('map/:showtimeId')
    @ApiOperation({ summary: 'Get seat map with lock + booking status' })
    getSeatMap(@Param('showtimeId') showtimeId: string) {
        return this.seatService.getSeatMap(showtimeId);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('lock')
    @ApiOperation({ summary: 'Lock seat (add to cart)' })
    @ApiResponse({ status: 201, description: 'Seat locked for 5 minutes' })
    lockSeat(@CurrentUser() user, @Body() dto: CreateSeatLockDto,) {
        return this.seatService.lockSeat(user.id, dto);
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Delete('unlock/:showtimeId/:seatId')
    @ApiOperation({ summary: 'Unlock seat (remove from cart)' })
    unlockSeat(
        @Req() req,
        @Param('showtimeId') showtimeId: string,
        @Param('seatId') seatId: string,
    ) {
        return this.seatService.unlockSeat(req.user.id, seatId, showtimeId);
    }
}