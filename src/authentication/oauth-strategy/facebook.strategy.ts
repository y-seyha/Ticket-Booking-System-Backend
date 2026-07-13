import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { Injectable, Logger } from '@nestjs/common';

interface ExplicitFacebookProfile {
  id: string;
  name?: {
    givenName?: string;
    familyName?: string;
  };
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

@Injectable()
export class FacebookStrategy extends PassportStrategy(
  Strategy as any,
  'facebook',
) {
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

  public validate(
    accessToken: string,
    refreshToken: string,
    profile: ExplicitFacebookProfile,
    done: (err: Error | null, user?: unknown) => void,
  ): void {
    const user = {
      provider: 'FACEBOOK',
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value || null,
      displayName:
        `${profile.name?.givenName ?? ''} ${profile.name?.familyName ?? ''}`.trim(),
      avatarUrl: profile.photos?.[0]?.value || null,
      accessToken,
      refreshToken,
    };

    this.logger.log(`Facebook OAuth login: ${user.email ?? 'unknown'}`);

    done(null, user);
  }
}
