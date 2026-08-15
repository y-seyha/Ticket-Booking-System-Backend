import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { CreateFoodCategoryDto } from './dto/create-food-category.dto';
import { UpdateFoodCategoryDto } from './dto/update-food-category.dto';
import { CreateFoodItemDto } from './dto/create-food-item.dto';
import { UpdateFoodItemDto } from './dto/update-food-item.dto';
import { AddBookingFoodItemsDto } from './dto/add-booking-food-item.dto';
import { CreateFoodOrderDto } from './dto/create-food-order.dto';
import { CreateBulkFoodItemDto } from './dto/create-bulk-food-item.dto';
import { BookingStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class FoodAndBeverageService {
  private readonly logger = new Logger(FoodAndBeverageService.name);
  private readonly ttlSeconds = 120;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
  ) {}

  /* ─── Categories ─────────────────────────────────── */

  async createCategory(dto: CreateFoodCategoryDto) {
    const category = await this.prisma.foodCategory.create({ data: dto });
    await this.invalidateMenu();
    return category;
  }

  async getCategories() {
    return this.redisService.getOrSet('f&b:categories', this.ttlSeconds, () =>
      this.prisma.foodCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: { image: true },
          },
        },
      }),
    );
  }

  async getAllCategories() {
    return this.prisma.foodCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateCategory(id: string, dto: UpdateFoodCategoryDto) {
    const existing = await this.prisma.foodCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Food category not found');
    const updated = await this.prisma.foodCategory.update({
      where: { id },
      data: dto,
    });
    await this.invalidateMenu();
    return updated;
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.foodCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Food category not found');
    await this.prisma.foodCategory.delete({ where: { id } });
    await this.invalidateMenu();
  }

  /* ─── Items ──────────────────────────────────────── */

  async createItem(dto: CreateFoodItemDto) {
    const category = await this.prisma.foodCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Food category not found');
    const item = await this.prisma.foodItem.create({ data: dto });
    await this.invalidateMenu();
    return item;
  }

  async getItems(categoryId: string) {
    return this.redisService.getOrSet(
      `f&b:items:${categoryId}`,
      this.ttlSeconds,
      () =>
        this.prisma.foodItem.findMany({
          where: { categoryId, isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { image: true },
        }),
    );
  }

  async getItem(id: string) {
    return this.redisService.getOrSet(
      `f&b:item:${id}`,
      this.ttlSeconds,
      async () => {
        const item = await this.prisma.foodItem.findUnique({
          where: { id },
          include: { image: true, category: true },
        });
        if (!item) throw new NotFoundException('Food item not found');
        return item;
      },
    );
  }

  async updateItem(id: string, dto: UpdateFoodItemDto) {
    const existing = await this.prisma.foodItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Food item not found');
    const updated = await this.prisma.foodItem.update({
      where: { id },
      data: dto,
    });
    await this.invalidateMenu();
    return updated;
  }

  async deleteItem(id: string) {
    const existing = await this.prisma.foodItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Food item not found');
    await this.prisma.foodItem.delete({ where: { id } });
    await this.invalidateMenu();
  }

  async toggleItemStatus(id: string) {
    const existing = await this.prisma.foodItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Food item not found');
    const updated = await this.prisma.foodItem.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    await this.invalidateMenu();
    return {
      message: `Item ${updated.isActive ? 'activated' : 'deactivated'}`,
    };
  }

  async toggleCategoryStatus(id: string) {
    const existing = await this.prisma.foodCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Food category not found');
    const updated = await this.prisma.foodCategory.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    await this.invalidateMenu();
    return {
      message: `Category ${updated.isActive ? 'activated' : 'deactivated'}`,
    };
  }

  async getAllItems() {
    return this.redisService.getOrSet('f&b:items-all', this.ttlSeconds, () =>
      this.prisma.foodItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          image: true,
          category: true,
        },
      }),
    );
  }

  async createBulkItems(dto: CreateBulkFoodItemDto) {
    const categoryIds = dto.categoryIds;

    const categories = await this.prisma.foodCategory.findMany({
      where: { id: { in: categoryIds } },
    });
    if (categories.length !== categoryIds.length) {
      throw new NotFoundException('One or more categories not found');
    }

    const itemData = {
      name: dto.name,
      description: dto.description,
      price: dto.price,
      sortOrder: dto.sortOrder,
    };

    const result = await Promise.all(
      categoryIds.map((categoryId) =>
        this.prisma.foodItem.create({
          data: { ...itemData, categoryId },
        }),
      ),
    );

    await this.invalidateMenu();

    return result;
  }

  /* ─── Standalone Food Order ──────────────────────── */

  async createFoodOrder(dto: CreateFoodOrderDto, accountId: string) {
    const foodItemIds = dto.items.map((i) => i.foodItemId);
    const foodItems = await this.prisma.foodItem.findMany({
      where: { id: { in: foodItemIds }, isActive: true },
    });
    if (foodItems.length !== foodItemIds.length) {
      throw new NotFoundException('One or more food items not found');
    }

    const foodMap = Object.fromEntries(
      foodItems.map((f) => [f.id, Number(f.price)]),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const totalAmount = dto.items.reduce(
        (sum, entry) => sum + (foodMap[entry.foodItemId] ?? 0) * entry.quantity,
        0,
      );

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const booking = await tx.booking.create({
        data: {
          accountId,
          bookingCode: crypto.randomUUID(),
          totalPrice: totalAmount,
          status: BookingStatus.PENDING,
          expiresAt,
        },
      });

      for (const entry of dto.items) {
        await tx.bookingFoodItem.create({
          data: {
            bookingId: booking.id,
            foodItemId: entry.foodItemId,
            quantity: entry.quantity,
            unitPrice: foodMap[entry.foodItemId],
          },
        });
      }

      return {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        totalAmount,
        status: booking.status,
      };
    });

    await this.notificationService.sendBookingConfirmation(
      accountId,
      result.bookingId,
    );

    return result;
  }

  async getMyOrders(accountId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        accountId,
        showtimeId: null,
        foodItems: { some: {} },
      },
      include: {
        foodItems: {
          include: { foodItem: { include: { image: true } } },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((b) => ({
      bookingId: b.id,
      bookingCode: b.bookingCode,
      totalAmount: Number(b.totalPrice),
      status: b.status,
      createdAt: b.createdAt,
      paymentStatus: b.payment?.status ?? null,
      items: b.foodItems.map((fi) => ({
        id: fi.id,
        name: fi.foodItem.name,
        quantity: fi.quantity,
        unitPrice: Number(fi.unitPrice),
        image: fi.foodItem.image,
      })),
    }));
  }

  async getOrderById(bookingId: string, accountId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        foodItems: {
          include: { foodItem: { include: { image: true } } },
        },
        payment: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.accountId !== accountId)
      throw new ForbiddenException('Not your order');
    if (booking.showtimeId)
      throw new BadRequestException('This is not a food-only order');

    return {
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      totalAmount: Number(booking.totalPrice),
      status: booking.status,
      createdAt: booking.createdAt,
      paymentStatus: booking.payment?.status ?? null,
      items: booking.foodItems.map((fi) => ({
        id: fi.id,
        name: fi.foodItem.name,
        quantity: fi.quantity,
        unitPrice: Number(fi.unitPrice),
        image: fi.foodItem.image,
      })),
    };
  }

  /* ─── Booking Food Items ─────────────────────────── */

  async addFoodItems(
    bookingId: string,
    dto: AddBookingFoodItemsDto,
    accountId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.accountId !== accountId)
      throw new ForbiddenException('Not your booking');
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Can only add food to PENDING bookings');
    }

    const foodItemIds = dto.items.map((i) => i.foodItemId);
    const foodItems = await this.prisma.foodItem.findMany({
      where: { id: { in: foodItemIds }, isActive: true },
    });
    if (foodItems.length !== foodItemIds.length) {
      throw new NotFoundException('One or more food items not found');
    }

    const foodMap = Object.fromEntries(
      foodItems.map((f) => [f.id, Number(f.price)]),
    );

    return this.prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        dto.items
          .filter((entry) => foodMap[entry.foodItemId] !== undefined)
          .map((entry) =>
            tx.bookingFoodItem.create({
              data: {
                bookingId,
                foodItemId: entry.foodItemId,
                quantity: entry.quantity,
                unitPrice: foodMap[entry.foodItemId],
              },
              include: { foodItem: true },
            }),
          ),
      );

      const foodTotal = created.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      );
      const newTotal = Number(booking.totalPrice) + foodTotal;
      await tx.booking.update({
        where: { id: bookingId },
        data: { totalPrice: newTotal },
      });

      return created;
    });
  }

  async getBookingFoodItems(bookingId: string, accountId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.accountId !== accountId)
      throw new ForbiddenException('Not your booking');

    return this.prisma.bookingFoodItem.findMany({
      where: { bookingId },
      include: { foodItem: { include: { image: true } } },
    });
  }

  async removeFoodItem(bookingId: string, itemId: string, accountId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.accountId !== accountId)
      throw new ForbiddenException('Not your booking');

    const existing = await this.prisma.bookingFoodItem.findUnique({
      where: { id: itemId },
    });
    if (!existing || existing.bookingId !== bookingId) {
      throw new NotFoundException('Booking food item not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.bookingFoodItem.delete({ where: { id: itemId } });

      const deduction = Number(existing.unitPrice) * existing.quantity;
      const newTotal = Math.max(0, Number(booking.totalPrice) - deduction);
      await tx.booking.update({
        where: { id: bookingId },
        data: { totalPrice: newTotal },
      });

      return { message: 'Food item removed from booking' };
    });
  }

  private async invalidateMenu() {
    await this.redisService.delPattern('f&b:*');
  }
}
