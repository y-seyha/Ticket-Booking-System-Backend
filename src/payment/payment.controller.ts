import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import {
  PayDto,
  UpdatePaymentMethodDto,
  CheckoutResponseDto,
} from '../checkout/dto/create-checkout.dto';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';


@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Patch(':paymentId/method')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Switch payment provider while booking remains active',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method adjusted successfully',
    type: CheckoutResponseDto,
  })
  changeMethod(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.paymentService.changePaymentMethod(user.id, paymentId, dto);
  }

  @Post('cash')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete CASH payment' })
  @ApiBody({ type: PayDto })
  @ApiResponse({ status: 200, description: 'Payment completed successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  payCash(@CurrentUser() user: any, @Body() dto: PayDto) {
    return this.paymentService.payCash(user.id, dto);
  }
}
