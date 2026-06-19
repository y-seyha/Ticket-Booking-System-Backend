import {
    Body,
    Controller,
    Post,
    Req,
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
import { PayDto } from './dto/pay.dto';
import {JwtAuthGuard} from "../authentication/guards/jwt-auth.guard";
import {CurrentUser} from "../authentication/decorators/current-user.decorator";

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
    ) {}

    @Post('cash')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: 'Complete CASH payment',})
    @ApiBody({type: PayDto,})
    @ApiResponse({status: 200, description: 'Payment completed successfully',})
    @ApiResponse({status: 404, description: 'Payment not found',})
    payCash(@CurrentUser() user, @Body() dto: PayDto,
    ) {
        return this.paymentService.payCash(user.id, dto);
    }
}