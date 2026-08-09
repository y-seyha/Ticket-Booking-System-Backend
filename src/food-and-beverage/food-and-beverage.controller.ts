import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/role.decorator';
import { PermissionsGuard } from '../authentication/guards/permissions.guard';
import { Permissions } from '../authentication/decorators/permissions.decorator';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';
import { FoodAndBeverageService } from './food-and-beverage.service';
import { CreateFoodCategoryDto } from './dto/create-food-category.dto';
import { UpdateFoodCategoryDto } from './dto/update-food-category.dto';
import { CreateFoodItemDto } from './dto/create-food-item.dto';
import { UpdateFoodItemDto } from './dto/update-food-item.dto';
import { AddBookingFoodItemsDto } from './dto/add-booking-food-item.dto';
import { CreateFoodOrderDto } from './dto/create-food-order.dto';
import { CreateBulkFoodItemDto } from './dto/create-bulk-food-item.dto';

@ApiTags('Food & Beverage')
@Controller('food-and-beverage')
export class FoodAndBeverageController {
  constructor(private readonly fbService: FoodAndBeverageService) {}

  /* ─── Public Endpoints ───────────────────────────── */

  @Get('categories')
  @ApiOperation({ summary: 'Get all food categories with items' })
  getCategories() {
    return this.fbService.getCategories();
  }

  @Get('categories/:categoryId/items')
  @ApiOperation({ summary: 'Get food items by category' })
  getItems(@Param('categoryId') categoryId: string) {
    return this.fbService.getItems(categoryId);
  }

  @Get('items')
  @ApiOperation({ summary: 'Get all active food items' })
  getAllItems() {
    return this.fbService.getAllItems();
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get a single food item' })
  getItem(@Param('id') id: string) {
    return this.fbService.getItem(id);
  }

  /* ─── Booking Food Items (authenticated) ─────────── */

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('booking/:bookingId/items')
  @ApiOperation({ summary: 'Add food items to a booking' })
  addFoodItems(
    @Param('bookingId') bookingId: string,
    @Body() dto: AddBookingFoodItemsDto,
    @CurrentUser() user: any,
  ) {
    return this.fbService.addFoodItems(bookingId, dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('booking/:bookingId/items')
  @ApiOperation({ summary: 'Get food items for a booking' })
  getBookingFoodItems(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: any,
  ) {
    return this.fbService.getBookingFoodItems(bookingId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('booking/:bookingId/items/:itemId')
  @ApiOperation({ summary: 'Remove a food item from a booking' })
  removeFoodItem(
    @Param('bookingId') bookingId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
  ) {
    return this.fbService.removeFoodItem(bookingId, itemId, user.id);
  }

  /* ─── Standalone Food Order ──────────────────────── */

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('order')
  @ApiOperation({ summary: 'Create a standalone food-only order' })
  createFoodOrder(@Body() dto: CreateFoodOrderDto, @CurrentUser() user: any) {
    return this.fbService.createFoodOrder(dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my-orders')
  @ApiOperation({ summary: 'Get all food-only orders for the current user' })
  getMyOrders(@CurrentUser() user: any) {
    return this.fbService.getMyOrders(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('orders/:bookingId')
  @ApiOperation({ summary: 'Get a single food-only order by booking ID' })
  getOrderById(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: any,
  ) {
    return this.fbService.getOrderById(bookingId, user.id);
  }

  /* ─── Admin Endpoints ────────────────────────────── */

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @ApiBearerAuth()
  @Post('categories')
  @ApiOperation({ summary: 'Create a food category' })
  createCategory(@Body() dto: CreateFoodCategoryDto) {
    return this.fbService.createCategory(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @Get('categories')
  @ApiOperation({ summary: 'Get all categories (admin)' })
  getAllCategories() {
    return this.fbService.getAllCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @ApiBearerAuth()
  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a food category' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateFoodCategoryDto) {
    return this.fbService.updateCategory(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @ApiBearerAuth()
  @Patch('categories/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle category active status' })
  toggleCategoryStatus(@Param('id') id: string) {
    return this.fbService.toggleCategoryStatus(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @ApiBearerAuth()
  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a food category' })
  deleteCategory(@Param('id') id: string) {
    return this.fbService.deleteCategory(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @ApiBearerAuth()
  @Post('items')
  @ApiOperation({ summary: 'Create a food item' })
  createItem(@Body() dto: CreateFoodItemDto) {
    return this.fbService.createItem(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard,PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @ApiBearerAuth()
  @Post('items/bulk')
  @ApiOperation({
    summary: 'Bulk create a food item across multiple categories',
  })
  createBulkItems(@Body() dto: CreateBulkFoodItemDto) {
    return this.fbService.createBulkItems(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @ApiBearerAuth()
  @Patch('items/:id')
  @ApiOperation({ summary: 'Update a food item' })
  updateItem(@Param('id') id: string, @Body() dto: UpdateFoodItemDto) {
    return this.fbService.updateItem(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @ApiBearerAuth()
  @Patch('items/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle item active status' })
  toggleItemStatus(@Param('id') id: string) {
    return this.fbService.toggleItemStatus(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('ADMIN')
  @Permissions('canManageMovies')
  @ApiBearerAuth()
  @Delete('items/:id')
  @ApiOperation({ summary: 'Delete a food item' })
  deleteItem(@Param('id') id: string) {
    return this.fbService.deleteItem(id);
  }
}
