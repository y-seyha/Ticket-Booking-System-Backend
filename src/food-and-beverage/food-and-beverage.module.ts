import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { FoodAndBeverageController } from './food-and-beverage.controller';
import { FoodAndBeverageService } from './food-and-beverage.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [FoodAndBeverageController],
  providers: [FoodAndBeverageService],
})
export class FoodAndBeverageModule {}
