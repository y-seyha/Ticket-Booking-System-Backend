import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-discord';
import { Injectable, Logger } from '@nestjs/common';

interface ExplicitDiscordProfile {
  id: string;
  username: string;
  avatar: string | null;
  email?: string;
}

@Injectable()
export class DiscordStrategy extends PassportStrategy(
  Strategy as any,
  'discord',
) {
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

  public validate(
    accessToken: string,
    refreshToken: string,
    profile: ExplicitDiscordProfile,
    done: (err: Error | null, user?: unknown) => void,
  ): void {
    const user = {
      provider: 'DISCORD',
      providerUserId: profile.id,
      email: profile.email || null,
      displayName: profile.username,
      avatarUrl: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null,
      accessToken,
      refreshToken,
    };

    this.logger.log(`Discord OAuth login: ${user.email ?? 'unknown'}`);

    done(null, user);
  }
}
