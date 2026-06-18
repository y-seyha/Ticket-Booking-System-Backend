import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-discord';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  private readonly logger = new Logger(DiscordStrategy.name);

  constructor() {
    super({
      clientID: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      callbackURL:
        process.env.DISCORD_CALLBACK_URL ||
        'http://localhost:3000/auth/discord/callback',
      scope: ['identify', 'email'],
    });

    this.logger.log('DiscordStrategy initialized');
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const user = {
      provider: 'DISCORD',
      providerUserId: profile.id,
      email: profile.email,
      displayName: profile.username,
      avatarUrl: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null,
      accessToken,
      refreshToken,
    };

    this.logger.log(`Discord OAuth login: ${user.email}`);

    done(null, user);
  }
}
