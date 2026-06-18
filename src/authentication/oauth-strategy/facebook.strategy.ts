import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-facebook';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  private readonly logger = new Logger(FacebookStrategy.name);

  constructor() {
    super({
      clientID: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL!,
      profileFields: ['id', 'emails', 'name', 'photos'],
      scope: ['email', 'public_profile'],
    });

    this.logger.log('FacebookStrategy initialized');
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const user = {
      provider: 'FACEBOOK',
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value,
      displayName:
        `${profile.name?.givenName ?? ''} ${profile.name?.familyName ?? ''}`.trim(),
      avatarUrl: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };

    this.logger.log(`Facebook OAuth login: ${user.email}`);

    done(null, user);
  }
}
