import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { Injectable, Logger } from '@nestjs/common';

interface ExplicitGithubProfile {
  id: string;
  username?: string;
  displayName?: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(
  Strategy as any,
  'github',
) {
  private readonly logger = new Logger(GithubStrategy.name);

  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ||
        'http://localhost:3000/auth/github/callback',
      scope: ['user:email'],
    });

    this.logger.log('GithubStrategy initialized');
  }

  public validate(
    accessToken: string,
    refreshToken: string,
    profile: ExplicitGithubProfile,
    done: (err: Error | null, user?: unknown) => void,
  ): void {
    const email = profile.emails?.[0]?.value || null;

    const user = {
      provider: 'GITHUB',
      providerUserId: profile.id,
      email,
      displayName: profile.displayName || profile.username || 'GitHub User',
      avatarUrl: profile.photos?.[0]?.value || null,
      accessToken,
      refreshToken,
    };

    this.logger.log(`GitHub OAuth login: ${email ?? 'unknown'}`);

    done(null, user);
  }
}
