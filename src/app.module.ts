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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthenticationModule,
    PrismaModule,
    FileUploadModule,
    UserModule,
    MoviesModule,
    TheaterModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
