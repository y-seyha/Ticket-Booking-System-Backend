import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { Injectable, Logger } from '@nestjs/common';

interface ExplicitGoogleProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  Strategy as any,
  'google',
) {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });

    this.logger.log('GoogleStrategy initialized');
  }

  public validate(
    accessToken: string,
    refreshToken: string,
    profile: ExplicitGoogleProfile,
    done: (err: Error | null, user?: unknown) => void,
  ): void {
    const user = {
      provider: 'GOOGLE',
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value || null,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value || null,
      accessToken,
      refreshToken,
    };

    this.logger.log(`Google OAuth login: ${user.email ?? 'unknown'}`);

    done(null, user);
  }
}
