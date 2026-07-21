/* eslint-disable */
import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '../utils/generateEmail';
import {
  Account,
  AccountStatus,
  PasswordResetToken,
  TokenType,
  VerificationToken,
} from '@prisma/client';
import { CustomerThrottlerStore } from './throttler/customer-throttler.store';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Response } from 'express';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { JwtPayload } from '../types';

type DeviceInfo = {
  deviceName?: string;
  deviceType?: string;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private readonly mailerService: MailerService,
    private throttlerStore: CustomerThrottlerStore,
  ) {}

  async register(dto: RegisterDto) {
    try {
      const existingAccount = await this.prisma.account.findUnique({
        where: { email: dto.email },
      });

      if (existingAccount) {
        if (existingAccount.emailVerified) {
          throw new BadRequestException('Email already exists');
        }

        const rawToken = crypto.randomUUID();
        const tokenHash = await bcrypt.hash(rawToken, 10);

        await this.prisma.verificationToken.create({
          data: {
            accountId: existingAccount.id,
            tokenHash,
            type: TokenType.EMAIL,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour expiration
          },
        });

        await this.mailerService.sendVerificationEmail(
          existingAccount.email,
          rawToken,
        );

        return {
          message:
              'Account exists but not verified. Verification email resent.',
        };
      }

      if (dto.phone) {
        const phoneExists = await this.prisma.userProfile.findUnique({
          where: { phone: dto.phone },
        });

        if (phoneExists) {
          throw new BadRequestException('Phone already exists');
        }
      }

      const hash = await bcrypt.hash(dto.password, 10);

      const account = await this.prisma.account.create({
        data: {
          email: dto.email,
          passwordHash: hash,
          profile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
              status: 'ACTIVE',
            },
          },
        },
        include: { profile: true },
      });

      const rawToken = crypto.randomUUID();
      const tokenHash = await bcrypt.hash(rawToken, 10);

      // FIX 2: Extended expiration window from 5 minutes to 1 hour
      await this.prisma.verificationToken.create({
        data: {
          accountId: account.id,
          tokenHash,
          type: TokenType.EMAIL, // Safe typed enum usage
          expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour expiration
        },
      });

      await this.mailerService.sendVerificationEmail(account.email, rawToken);

      this.logger.log(`User registered (verification sent): ${account.email}`);

      return {
        message: 'Account created. Please verify your email.',
      };
    } catch (error: any) {
      this.handlePrismaError(error);
    }
  }
  // async verifyEmail(token: string) {
  //   const tokens = await this.prisma.verificationToken.findMany({
  //     where: {
  //       type: 'EMAIL',
  //       usedAt: null,
  //       expiresAt: { gt: new Date() },
  //     },
  //   });
  //
  //   let matchedToken: VerificationToken | null = null;
  //
  //   for (const t of tokens) {
  //     const isValid = await bcrypt.compare(token, t.tokenHash);
  //     if (isValid) {
  //       matchedToken = t;
  //       break;
  //     }
  //   }
  //
  //   if (!matchedToken) {
  //     throw new BadRequestException('Invalid or expired token');
  //   }
  //
  //   await this.prisma.$transaction([
  //     this.prisma.account.update({
  //       where: { id: matchedToken.accountId },
  //       data: { emailVerified: true },
  //     }),
  //
  //     this.prisma.verificationToken.update({
  //       where: { id: matchedToken.id },
  //       data: { usedAt: new Date() },
  //     }),
  //   ]);
  //
  //   return true;
  // }

  async verifyEmail(token: string) {
    const tokens = await this.prisma.verificationToken.findMany({
      where: {
        type: 'EMAIL', // This maps directly to your TokenType.EMAIL enum safely
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        account: true
      }
    });

    let matchedToken: any = null;

    for (const t of tokens) {
      const isValid = await bcrypt.compare(token, t.tokenHash);
      if (isValid) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: matchedToken.accountId },
        data: { emailVerified: true },
      }),

      this.prisma.verificationToken.update({
        where: { id: matchedToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { account: matchedToken.account };
  }

  async login(dto: LoginDto, req: any) {
    const key = dto.email;

    try {
      const account = await this.prisma.account.findUnique({
        where: { email: key },
        include: {
          twoFactorAuth: true,
        },
      });

      if (!account) {
        throw new UnauthorizedException('Invalid email or password');
      }

      //validate
      const state = this.getAccountState(account);

      if (!state.allowed) {
        throw new UnauthorizedException(`Account ${state.type.toLowerCase()}`);
      }

      //lock
      if (account.lockedUntil && account.lockedUntil > new Date()) {
        throw new UnauthorizedException('Account temporarily locked');
      }

      if (!account.emailVerified) {
        throw new UnauthorizedException('Please verify your email');
      }

      if (!account.passwordHash) {
        throw new UnauthorizedException(
          'This account uses social login. Please sign in with Google, Github, Facebook, or Discord.',
        );
      }

      const match = await bcrypt.compare(dto.password, account.passwordHash);

      if (!match) {
        throw new UnauthorizedException('Invalid email or password');
      }

      if (account.twoFactorEnabled) {
        const tempToken = this.jwt.sign(
          { sub: account.id, type: '2fa-pending' },
          { expiresIn: '5m' },
        );

        return {
          requiresTwoFactor: true,
          tempToken,
        };
      }

      await this.prisma.account.update({
        where: { id: account.id },
        data: {
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      this.throttlerStore.reset(key);

      this.logger.log(`Login success: ${account.email}`);

      return this.issueTokens(account, req, {
        deviceName: req.headers['user-agent'],
        deviceType: this.detectDevice(req),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (error) {
      const current = this.throttlerStore.get(key);

      const newCount = (current?.count ?? 0) + 1;

      let lockedUntil: number | undefined;

      if (newCount >= 10) {
        lockedUntil = Date.now() + 5 * 60 * 1000;
      }

      await this.prisma.account.update({
        where: { email: key },
        data: {
          failedLoginAttempts: newCount,
          lockedUntil: lockedUntil ? new Date(lockedUntil) : null,
        },
      });

      this.throttlerStore.set(key, {
        count: newCount,
        lockedUntil,
      });

      throw error;
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const account = await this.prisma.account.findUnique({
      where: { email: dto.email },
    });

    // always return success
    if (!account) {
      return { message: 'Reset Link already sent to your email account' };
    }

    const rawToken = crypto.randomUUID();
    const tokenHash = await bcrypt.hash(rawToken, 10);

    await this.prisma.passwordResetToken.create({
      data: {
        accountId: account.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 5), // 5 min
      },
    });

    await this.mailerService.sendResetPasswordEmail(account.email, rawToken);

    return { message: 'If email exists, reset link sent' };
  }

  async resetPassword(token: string, dto: ResetPasswordDto) {
    const { newPassword, confirmNewPassword } = dto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Passwords dto not match');
    }

    const tokens = await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let matched: PasswordResetToken | null = null;

    for (const t of tokens) {
      const isValid = await bcrypt.compare(token, t.tokenHash);

      if (isValid) {
        matched = t;
        break;
      }
    }

    if (!matched) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Transaction: update password + mark token used
    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: matched.accountId },
        data: {
          passwordHash: hashedPassword,
        },
      }),

      this.prisma.passwordResetToken.update({
        where: { id: matched.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Password reset successful',
    };
  }

  async logout(req: any, res: Response) {
    const userId = req.user.sub;
    const refreshToken = req.cookies?.refresh_token;

    let session: any = null;

    //find refresh token
    if (refreshToken) {
      const tokens = await this.prisma.refreshToken.findMany({
        where: {
          accountId: userId,
          revokedAt: null,
        },
      });

      for (const t of tokens) {
        const match = await bcrypt.compare(refreshToken, t.tokenHash);

        if (match) {
          session = t;
          await this.prisma.refreshToken.update({
            where: { id: t.id },
            data: { revokedAt: new Date() },
          });
          break;
        }
      }
    }

    if (session) {
      await this.prisma.loginSession.updateMany({
        where: {
          accountId: userId,
          refreshTokenId: session.id,
        },
        data: {
          isActive: false,
          lastActiveAt: new Date(),
        },
      });
    }

    this.clearCookies(res);

    return { message: 'Logged out successfully' };
  }

  async validateOAuthLogin(profile: any) {
    const { provider, providerUserId, email, displayName } = profile;

    const safeEmail = email ?? null;

    const oauth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: { account: true },
    });

    if (oauth) {
      return oauth.account;
    }

    if (!safeEmail) {
      throw new BadRequestException(
        `${provider} did not return email. Enable email permission.`,
      );
    }

    let account = await this.prisma.account.findUnique({
      where: { email: safeEmail },
    });

    if (!account) {
      account = await this.prisma.account.create({
        data: {
          email: safeEmail,
          emailVerified: true,
          profile: {
            create: {
              firstName: displayName ?? 'User',
              lastName: '',
              status: 'ACTIVE',
            },
          },
        },
      });
    }

    await this.prisma.oAuthAccount.create({
      data: {
        accountId: account.id,
        provider,
        providerUserId,
        providerEmail: safeEmail,
        displayName,
      },
    });

    return account;
  }

  async setup2FA(userId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: userId },
    });

    if (!account) {
      throw new BadRequestException('Account not found');
    }

    const secret = speakeasy.generateSecret({
      name: `YourApp (${account.email})`,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    await this.prisma.twoFactorAuth.upsert({
      where: { accountId: userId },
      update: {
        secretEncrypted: this.encrypt(secret.base32),
        method: 'TOTP',
      },
      create: {
        accountId: userId,
        secretEncrypted: this.encrypt(secret.base32),
        method: 'TOTP',
      },
    });

    return {
      qrCode,
      secret: secret.base32,
    };
  }

  async enable2FA(userId: string, code: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: userId },
      include: { twoFactorAuth: true },
    });

    if (!account?.twoFactorAuth) {
      throw new BadRequestException('2FA not configured');
    }

    if (account.twoFactorEnabled) {
      return { message: '2FA already enabled' };
    }

    const secret = this.decrypt(account.twoFactorAuth.secretEncrypted);

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      throw new BadRequestException('Invalid code');
    }

    await this.prisma.account.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    await this.prisma.twoFactorAuth.update({
      where: { accountId: userId },
      data: { enabledAt: new Date() },
    });

    return {
      message: '2FA enabled successfully',
    };
  }

  async verify2FA(tempToken: string, code: string, req: any) {
    let payload: any;

    try {
      payload = this.jwt.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Expired or invalid session');
    }

    if (payload.type !== '2fa-pending') {
      throw new UnauthorizedException('Invalid 2FA session');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
      include: { twoFactorAuth: true },
    });

    if (!account?.twoFactorAuth) {
      throw new UnauthorizedException('2FA not enabled');
    }

    const secret = this.decrypt(account.twoFactorAuth.secretEncrypted);

    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      throw new UnauthorizedException('Invalid code');
    }

    return this.issueTokens(account, req);
  }

  async handlePostLoginState(account: any, req: any, device?: DeviceInfo) {
    const state = this.getAccountState(account);
    if (!state.allowed) {
      throw new UnauthorizedException(`Account ${state.type.toLowerCase()}`);
    }


    if (account.twoFactorEnabled) {
      const tempToken = this.jwt.sign(
          { sub: account.id, type: '2fa-pending' },
          { expiresIn: '5m' },
      );

      return {
        requiresTwoFactor: true,
        tempToken,
      };
    }


    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return this.issueTokens(account, req, device);
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(12);

    const key = crypto
      .createHash('sha256')
      .update(process.env.ENCRYPTION_KEY!)
      .digest();

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return [
      iv.toString('hex'),
      tag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  private decrypt(payload: string): string {
    if (!payload || typeof payload !== 'string') {
      throw new BadRequestException('Invalid encrypted payload');
    }

    const parts = payload.split(':');

    if (parts.length !== 3) {
      throw new BadRequestException('Corrupted encryption format');
    }

    const [ivHex, tagHex, encryptedHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');

    const key = crypto
      .createHash('sha256')
      .update(process.env.ENCRYPTION_KEY!)
      .digest();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  async issueTokens(account: any, req: any, device?: DeviceInfo) {
    const sessionId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();

    const payload = {
      sub: account.id,
      email: account.email,
      role: account.role,
      sid: sessionId,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwt.sign(payload, { expiresIn: '7d' });

    const tokenHash = await bcrypt.hash(refreshToken, 10);

    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        accountId: account.id,
        tokenHash,

        deviceId,

        ipAddress: device?.ip ?? req.ip ?? null,

        deviceInfo: JSON.stringify({
          userAgent: req.headers['user-agent'],
          deviceType: this.detectDevice(req),
          deviceName: device?.deviceName ?? null,
        }),

        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.loginSession.create({
      data: {
        accountId: account.id,
        refreshTokenId: refreshTokenRecord.id,

        deviceName: device?.deviceName ?? req.headers['user-agent'] ?? null,
        deviceType: device?.deviceType ?? this.detectDevice(req),

        ipAddress: device?.ip ?? req.ip ?? null,
        userAgent: device?.userAgent ?? req.headers['user-agent'] ?? null,

        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: payload,
    };
  }

  async reactivateAccount(email: string) {
    const account = await this.prisma.account.findUnique({
      where: { email },
    });

    if (!account) {
      return {
        message: 'If the account exists, a reactivation email has been sent',
      };
    }

    if (account.status !== AccountStatus.DELETED) {
      throw new BadRequestException('Only deleted accounts can be reactivated');
    }

    const rawToken = crypto.randomUUID();
    const tokenHash = await bcrypt.hash(rawToken, 10);

    await this.prisma.verificationToken.create({
      data: {
        accountId: account.id,
        tokenHash,
        type: TokenType.REACTIVATION,
        expiresAt: new Date(Date.now() + 1000 * 60 * 5), // 5 min
      },
    });

    await this.mailerService.sendReactivateAccountEmail(
      account.email,
      rawToken,
    );

    return {
      message: 'Reactivation email sent',
    };
  }

  async confirmReactivation(token: string) {
    const tokens = await this.prisma.verificationToken.findMany({
      where: {
        type: TokenType.REACTIVATION,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    let matchedToken: VerificationToken | null = null;

    for (const t of tokens) {
      const valid = await bcrypt.compare(token, t.tokenHash);

      if (valid) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      throw new BadRequestException('Invalid or expired reactivation token');
    }

    await this.prisma.$transaction([
      this.prisma.account.update({
        where: { id: matchedToken.accountId },
        data: {
          status: AccountStatus.ACTIVE,
        },
      }),

      this.prisma.verificationToken.update({
        where: { id: matchedToken.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Account reactivated successfully',
    };
  }

  async refreshTokens(refreshToken: string | undefined, req: Request & { ip?: string }) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
    });

    if (!account) {
      throw new UnauthorizedException('Account not found');
    }

    const state = this.getAccountState(account);
    if (!state.allowed) {
      throw new UnauthorizedException(`Account ${state.type.toLowerCase()}`);
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        accountId: account.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    // Explicitly find the match using Prisma's generated RefreshToken type
    let matchedTokenRecord: (typeof tokens)[number] | null = null;
    for (const t of tokens) {
      const match = await bcrypt.compare(refreshToken, t.tokenHash);
      if (match) {
        matchedTokenRecord = t;
        break;
      }
    }

    if (!matchedTokenRecord) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: matchedTokenRecord.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.loginSession.updateMany({
        where: {
          accountId: account.id,
          refreshTokenId: matchedTokenRecord.id,
        },
        data: {
          isActive: false,
          lastActiveAt: new Date(),
        },
      }),
    ]);

    const rawHeaders = req.headers as unknown as Record<
      string,
      string | undefined
    >;
    const userAgent = rawHeaders['user-agent'] || '';

    return this.issueTokens(account, req, {
      deviceName: userAgent,
      deviceType: this.detectDevice(req),
      ip: req.ip || '',
      userAgent: userAgent,
    });
  }


  private handlePrismaError(error: any): never {
    if (error?.code === 'P2002') {
      const target = error.meta?.target;

      if (Array.isArray(target)) {
        if (target.includes('email')) {
          throw new BadRequestException('Email already exists');
        }

        if (target.includes('phone')) {
          throw new BadRequestException('Phone already exists');
        }
      }

      throw new BadRequestException('Unique constraint violation');
    }

    throw error;
  }

  private clearCookies(res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = isProduction ? '.yscinema.site' : undefined;

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      domain: cookieDomain,
      path: '/',
    };

    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
  }

  private detectDevice(req: any): string {
    const ua = req.headers['user-agent'] || '';

    if (/mobile/i.test(ua)) return 'MOBILE';
    if (/tablet/i.test(ua)) return 'TABLET';
    return 'DESKTOP';
  }

  private getAccountState(account: Account) {
    switch (account.status) {
      case AccountStatus.SUSPENDED:
        return {
          type: 'SUSPENDED',
          allowed: false,
          reason: 'Account suspended by admin',
        };

      case AccountStatus.DELETED:
        return {
          type: 'DELETED',
          allowed: false,
          reason: 'Account is deleted',
        };

      default:
        return {
          type: 'ACTIVE',
          allowed: true,
          reason: null,
        };
    }
  }
}
