import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-github2';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    private readonly logger = new Logger(GithubStrategy.name);

    constructor() {
        super({
            clientID: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/github/callback',
            scope: ['user:email'],
        });

        this.logger.log('GithubStrategy initialized');
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ) {
        const email = profile.emails?.[0]?.value;

        const user = {
            provider: 'GITHUB',
            providerUserId: profile.id,
            email,
            displayName: profile.displayName || profile.username,
            avatarUrl: profile.photos?.[0]?.value,
            accessToken,
            refreshToken,
        };

        this.logger.log(`GitHub OAuth login: ${email}`);

        done(null, user);
    }
}