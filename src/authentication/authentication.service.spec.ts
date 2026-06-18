import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticationService } from './authentication.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { MailerService } from '../utils/generateEmail';
import { CustomerThrottlerStore } from './throttler/customer-throttler.store';

jest.mock('bcrypt');
jest.mock('speakeasy');
jest.mock('qrcode');

describe('AuthenticationService', () => {
  let service: AuthenticationService;

  const mailerMock = {
    sendVerificationEmail: jest.fn(),
    sendResetPasswordEmail: jest.fn(),
    sendReactivateAccountEmail: jest.fn(),
  };

  const prismaMock = {
    account: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
    },
    verificationToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    loginSession: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    twoFactorAuth: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    oAuthAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb),
  };

  const jwtMock = {
    sign: jest.fn().mockReturnValue('jwt-token'),
    verify: jest.fn(),
  };

  const throttlerMock = {
    get: jest.fn(),
    set: jest.fn(),
    reset: jest.fn(),
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-secret-key';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: MailerService, useValue: mailerMock },
        { provide: CustomerThrottlerStore, useValue: throttlerMock },
      ],
    }).compile();

    service = module.get(AuthenticationService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register new account', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);
      prismaMock.userProfile.findUnique.mockResolvedValue(null);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      prismaMock.account.create.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
      });

      prismaMock.verificationToken.create.mockResolvedValue({});

      mailerMock.sendVerificationEmail.mockResolvedValue(true);

      const res = await service.register({
        email: 'test@test.com',
        password: '123',
        firstName: 'A',
        lastName: 'B',
      });

      expect(res.message).toContain('Account created');
    });

    it('should resend verification if account exists but not verified', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        emailVerified: false,
      });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

      prismaMock.verificationToken.create.mockResolvedValue({});
      mailerMock.sendVerificationEmail.mockResolvedValue(true);

      const res = await service.register({
        email: 'test@test.com',
        password: '123',
      } as any);

      expect(res.message).toContain('Verification email resent');
    });

    it('should throw if email already verified', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        emailVerified: true,
      });

      await expect(
        service.register({ email: 'x@test.com' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      prismaMock.verificationToken.findMany.mockResolvedValue([
        { id: '1', tokenHash: 'hash', accountId: 'acc1' },
      ]);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      prismaMock.$transaction.mockImplementation(async (cb) => cb);

      const res = await service.verifyEmail('token');

      expect(res).toBe(true);
    });

    it('should fail invalid token', async () => {
      prismaMock.verificationToken.findMany.mockResolvedValue([]);

      await expect(service.verifyEmail('bad')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        passwordHash: 'hash',
        emailVerified: true,
        twoFactorEnabled: false,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      prismaMock.account.update.mockResolvedValue({});

      prismaMock.refreshToken.create.mockResolvedValue({
        id: 'refresh-id-1',
      });

      prismaMock.loginSession.create.mockResolvedValue({});

      const res = await service.login(
        { email: 'test@test.com', password: '123' },
        { headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' },
      );

      if ('accessToken' in res) {
        expect(res.accessToken).toBeDefined();
        expect(res.refreshToken).toBeDefined();
      } else {
        throw new Error('Expected login success, got 2FA response');
      }
    });

    it('should require email verification', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        emailVerified: false,
      });

      await expect(
        service.login({ email: 'x', password: '123' } as any, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should fail wrong password', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        passwordHash: 'hash',
        emailVerified: true,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'x', password: '123' } as any, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return 2FA temp token', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        passwordHash: 'hash',
        emailVerified: true,
        twoFactorEnabled: true,
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await service.login({ email: 'x', password: '123' }, {});

      if ('requiresTwoFactor' in res) {
        expect(res.requiresTwoFactor).toBe(true);
        expect(res.tempToken).toBeDefined();
      } else {
        throw new Error('Expected 2FA response');
      }
    });
  });

  describe('forgotPassword', () => {
    it('should always return success even if user not found', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);

      const res = await service.forgotPassword({ email: 'x' });

      expect(res.message).toBeDefined();
    });

    it('should create reset token if user exists', async () => {
      prismaMock.account.findUnique.mockResolvedValue({ id: '1' });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

      prismaMock.passwordResetToken.create.mockResolvedValue({});

      const res = await service.forgotPassword({ email: 'x' });

      expect(res.message).toContain('reset');
    });
  });

  describe('resetPassword', () => {
    it('should reset password', async () => {
      prismaMock.passwordResetToken.findMany.mockResolvedValue([
        { id: '1', tokenHash: 'hash', accountId: 'acc1' },
      ]);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');

      prismaMock.$transaction.mockImplementation(async (cb) => cb);

      const res = await service.resetPassword('token', {
        newPassword: '123',
        confirmNewPassword: '123',
      });

      expect(res.message).toBeDefined();
    });

    it('should fail password mismatch', async () => {
      await expect(
        service.resetPassword('t', {
          newPassword: '1',
          confirmNewPassword: '2',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setup2FA', () => {
    it('should generate qr code', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@mail.com',
      });

      (speakeasy.generateSecret as jest.Mock).mockReturnValue({
        base32: 'SECRET123',
        otpauth_url: 'otpauth://totp/test?secret=SECRET123',
      });

      (QRCode.toDataURL as jest.Mock).mockResolvedValue('qr-image');

      const result = await service.setup2FA('1');

      expect(result.qrCode).toBe('qr-image');
      expect(result.secret).toBe('SECRET123');
    });

    it('should throw if account not found', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);

      await expect(service.setup2FA('1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('enable2FA', () => {
    it('should enable 2FA', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        twoFactorEnabled: false,
        twoFactorAuth: { secretEncrypted: 'enc' },
      });

      jest.spyOn<any, any>(service as any, 'decrypt').mockReturnValue('secret');

      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      prismaMock.account.update.mockResolvedValue({});
      prismaMock.twoFactorAuth.update.mockResolvedValue({});

      const res = await service.enable2FA('1', '123');

      expect(res.message).toContain('enabled');
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly', () => {
      process.env.ENCRYPTION_KEY = 'test-key';

      const text = 'hello';

      const encrypted = (service as any).encrypt(text);
      const decrypted = (service as any).decrypt(encrypted);

      expect(decrypted).toBe(text);
    });

    it('should throw on invalid format', () => {
      expect(() => (service as any).decrypt('bad')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('handlePrismaError', () => {
    it('should throw email exists', () => {
      expect(() =>
        (service as any).handlePrismaError({
          code: 'P2002',
          meta: { target: ['email'] },
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('reactivateAccount', () => {
    it('should send reactivation email if account is deleted', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        status: 'DELETED',
      });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      prismaMock.verificationToken.create.mockResolvedValue({});
      mailerMock.sendReactivateAccountEmail.mockResolvedValue(true);

      const res = await service.reactivateAccount('test@test.com');

      expect(res.message).toContain('Reactivation email sent');
    });

    it('should throw if account is not deleted', async () => {
      prismaMock.account.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        status: 'ACTIVE',
      });

      await expect(service.reactivateAccount('test@test.com')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return silent response if account not found', async () => {
      prismaMock.account.findUnique.mockResolvedValue(null);

      const res = await service.reactivateAccount('missing@test.com');

      expect(res.message).toContain('If the account exists');
    });
  });

  describe('confirmReactivation', () => {
    it('should reactivate account successfully', async () => {
      prismaMock.verificationToken.findMany.mockResolvedValue([
        {
          id: 't1',
          accountId: 'a1',
          tokenHash: 'hash',
        },
      ]);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      prismaMock.$transaction.mockImplementation(async (cb) => cb);

      const res = await service.confirmReactivation('token');

      expect(res.message).toContain('reactivated');
    });

    it('should fail invalid token', async () => {
      prismaMock.verificationToken.findMany.mockResolvedValue([]);
      await expect(service.confirmReactivation('bad')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateOAuthLogin', () => {
    it('should return existing oauth account', async () => {
      prismaMock.oAuthAccount.findUnique.mockResolvedValue({
        account: { id: '1', email: 'test@test.com' },
      });

      const res = await service.validateOAuthLogin({
        provider: 'google',
        providerUserId: '123',
        email: 'test@test.com',
      });

      expect(res.id).toBe('1');
    });

    it('should create new account if not exists', async () => {
      prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
      prismaMock.account.findUnique.mockResolvedValue(null);
      prismaMock.account.create.mockResolvedValue({ id: '1' });
      prismaMock.oAuthAccount.create.mockResolvedValue({});

      const res = await service.validateOAuthLogin({
        provider: 'google',
        providerUserId: '123',
        email: 'test@test.com',
        displayName: 'John',
      });

      expect(res.id).toBe('1');
    });

    it('should throw if email missing', async () => {
      prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);

      await expect(
        service.validateOAuthLogin({
          provider: 'google',
          providerUserId: '123',
          email: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token and clear cookies', async () => {
      prismaMock.refreshToken.findMany.mockResolvedValue([
        { id: 'rt1', tokenHash: 'hash' },
      ]);

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      prismaMock.refreshToken.update.mockResolvedValue({});
      prismaMock.loginSession.updateMany.mockResolvedValue({});

      const res = await service.logout(
        {
          user: { sub: 'user1' },
          cookies: { refresh_token: 'token' },
        },
        { clearCookie: jest.fn() } as any,
      );

      expect(res.message).toBeDefined();
    });
  });

  describe('getAccountState', () => {
    it('should return SUSPENDED state', () => {
      const res = (service as any).getAccountState({
        status: 'SUSPENDED',
      });

      expect(res.allowed).toBe(false);
    });

    it('should return DELETED state', () => {
      const res = (service as any).getAccountState({
        status: 'DELETED',
      });

      expect(res.allowed).toBe(false);
    });

    it('should return ACTIVE state', () => {
      const res = (service as any).getAccountState({
        status: 'ACTIVE',
      });

      expect(res.allowed).toBe(true);
    });
  });

  it('should ignore expired tokens in confirmReactivation', async () => {
    prismaMock.verificationToken.findMany.mockResolvedValue([
      {
        id: '1',
        accountId: 'a1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.confirmReactivation('token')).rejects.toThrow(
      BadRequestException,
    );
  });
});
