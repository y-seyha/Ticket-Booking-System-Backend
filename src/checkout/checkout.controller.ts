import {
    Body,
    Controller,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';



import { CheckoutService } from './checkout.service';

import { CreateCheckoutDto } from './dto/create-checkout.dto';
import {JwtAuthGuard} from "../authentication/guards/jwt-auth.guard";
import {CurrentUser} from "../authentication/decorators/current-user.decorator";

@ApiTags('Checkout')
@Controller('checkout')
export class CheckoutController {
    constructor(
        private readonly checkoutService:
        CheckoutService,
    ) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({summary: 'Checkout current cart and create booking',})
    @ApiResponse({status: 201, description: 'Checkout completed successfully',})
    checkout(@CurrentUser() user, @Body() dto: CreateCheckoutDto,
    ) {
        return this.checkoutService.checkout(user.id, dto);
    }
}