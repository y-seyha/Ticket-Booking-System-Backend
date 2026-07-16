import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthenticationModule } from './authentication/authentication.module';
import { PrismaModule } from './prisma/prisma.module';
import { FileUploadModule } from './file-upload/file-upload.module';
import { UserModule } from './user/user.module';
import { MoviesModule } from './movies/movies.module';
import { TheaterModule } from './theater/theater.module';
import { ScreenModule } from './screen/screen.module';
import { ScreenTemplateModule } from './screen-template/screen-template.module';
import { SeatTemplateModule } from './seat-template/seat-template.module';
import { SeatModule } from './seat/seat.module';
import { ShowtimeModule } from './showtime/showtime.module';
import { SeatPricingModule } from './seat-pricing/seat-pricing.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymentModule } from './payment/payment.module';
import { TicketModule } from './ticket/ticket.module';
import { SearchModule } from './search/search.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AuthenticationModule,
    PrismaModule,
    FileUploadModule,
    UserModule,
    MoviesModule,
    TheaterModule,
    ScreenModule,
    ScreenTemplateModule,
    SeatTemplateModule,
    SeatModule,
    ShowtimeModule,
    SeatPricingModule,
    CheckoutModule,
    PaymentModule,
    TicketModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
