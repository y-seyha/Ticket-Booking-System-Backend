import { Module } from '@nestjs/common';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerService } from '../utils/generateEmail';
import { CustomerThrottlerStore } from './throttler/customer-throttler.store';
import { CustomerThrottlerGuard } from './guards/customer-throttler.guard';
import {GoogleStrategy} from "./oauth-strategy/google.strategy";
import {GithubStrategy} from "./oauth-strategy/github.strategy";
import {FacebookStrategy} from "./oauth-strategy/facebook.strategy";
import {DiscordStrategy} from "./oauth-strategy/discord.strategy";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error('JWT_SECRET is missing in .env');
        }

        return {
          secret,
          signOptions: { expiresIn: '15m' },
        };
      },
    }),
  ],
  controllers: [AuthenticationController],
  providers: [
    AuthenticationService,
    JwtStrategy,
    MailerService,
    CustomerThrottlerStore,
    CustomerThrottlerGuard,

    GoogleStrategy,
    GithubStrategy,
    FacebookStrategy,
    DiscordStrategy,
  ],
})
export class AuthenticationModule {}
