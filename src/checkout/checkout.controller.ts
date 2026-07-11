import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import {
  CreateCheckoutDto,
  CheckoutResponseDto,
} from './dto/create-checkout.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';


@ApiTags('Checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Checkout current cart and create booking' })
  @ApiResponse({
    status: 201,
    description: 'Checkout completed successfully',
    type: CheckoutResponseDto,
  })
  checkout(@CurrentUser() user: any, @Body() dto: CreateCheckoutDto) {
    return this.checkoutService.checkout(user.id, dto);
  }
}
