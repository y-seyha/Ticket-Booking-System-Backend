import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {CustomerThrottlerGuard} from "./guards/customer-throttler.guard";
import {CustomerThrottlerStore} from "./throttler/customer-throttler.store";

describe('AuthenticationController', () => {
  let controller: AuthenticationController;

  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
    setup2FA: jest.fn(),
    enable2FA: jest.fn(),
    verify2FA: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    verifyEmail: jest.fn(),
    logout: jest.fn(),
    validateOAuthLogin: jest.fn(),
    issueTokens: jest.fn(),
  };

  const resMock: any = {
    cookie: jest.fn(),
    send: jest.fn(),
  };

  const reqMock: any = {
    headers: { 'user-agent': 'jest' },
    ip: '127.0.0.1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [
        { provide: AuthenticationService, useValue: authServiceMock },
        {
          provide: CustomerThrottlerStore,
          useValue: {
            get: jest.fn().mockReturnValue({
              lockedUntil: 0,
              count: 0,
            }),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    })
        .overrideGuard(CustomerThrottlerGuard)
        .useValue({ canActivate: () => true })

        .compile();

    controller = module.get(AuthenticationController);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('success', async () => {
      authServiceMock.register.mockResolvedValue({
        message: 'Account created',
        accessToken: 'a',
        refreshToken: 'r',
      });

      const res = await controller.register(
          { email: 'a', password: 'b' } as any,
          resMock,
      );

      expect(res.message).toBe('Account created');
      expect(resMock.cookie).toHaveBeenCalledTimes(2);
    });

    it('error', async () => {
      authServiceMock.register.mockRejectedValue(
          new BadRequestException(),
      );

      await expect(
          controller.register({} as any, resMock),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('success login', async () => {
      authServiceMock.login.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { sub: '1' },
      });

      const res = await controller.login(
          { email: 'x', password: 'y' } as any,
          reqMock,
          resMock,
      );

      if ('user' in res) {
        expect(res.user.sub).toBe('1');
      }

      expect(resMock.cookie).toHaveBeenCalled();
    });

    it('2FA required branch', async () => {
      authServiceMock.login.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: 'temp',
      });

      const res = await controller.login(
          { email: 'x', password: 'y' } as any,
          reqMock,
          resMock,
      );

      if ('requiresTwoFactor' in res) {
        expect(res.requiresTwoFactor).toBe(true);
        expect(res.tempToken).toBe('temp');
      }

      expect(resMock.cookie).not.toHaveBeenCalled();
    });

    it('login error', async () => {
      authServiceMock.login.mockRejectedValue(new UnauthorizedException());

      await expect(
          controller.login({} as any, reqMock, resMock),
      ).rejects.toThrow(UnauthorizedException);
    });
  });


  describe('setup2FA', () => {
    it('success', async () => {
      authServiceMock.setup2FA.mockResolvedValue({
        qrCode: 'qr',
        secret: 'sec',
      });

      const res = await controller.setup2FA({ id: '1' });

      expect(res.secret).toBe('sec');
    });

    it('error', async () => {
      authServiceMock.setup2FA.mockRejectedValue(
          new BadRequestException(),
      );

      await expect(controller.setup2FA({ id: '1' })).rejects.toThrow();
    });
  });

  describe('enable2FA', () => {
    it('success', async () => {
      authServiceMock.enable2FA.mockResolvedValue({
        message: 'enabled',
      });

      const res = await controller.enable2FA(
          { id: '1' },
          '123',
      );

      expect(res.message).toBe('enabled');
    });

    it('error', async () => {
      authServiceMock.enable2FA.mockRejectedValue(
          new BadRequestException(),
      );

      await expect(
          controller.enable2FA({ id: '1' }, '123'),
      ).rejects.toThrow();
    });
  });

  describe('verify2FA', () => {
    it('success', async () => {
      authServiceMock.verify2FA.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: '1' },
      });

      const res = await controller.verify2FA(
          'temp',
          '123',
          reqMock,
          resMock,
      );

      expect(res.success).toBe(true);
      expect(resMock.cookie).toHaveBeenCalled();
    });

    it('error', async () => {
      authServiceMock.verify2FA.mockRejectedValue(
          new BadRequestException(),
      );

      await expect(
          controller.verify2FA('t', 'c', reqMock, resMock),
      ).rejects.toThrow();
    });
  });

  describe('forgotPassword', () => {
    it('success', async () => {
      authServiceMock.forgotPassword.mockResolvedValue({
        message: 'sent',
      });

      const res = await controller.forgotPassword({
        email: 'x',
      } as any);

      expect(res.message).toBe('sent');
    });
  });

  describe('resetPassword', () => {
    it('success', async () => {
      authServiceMock.resetPassword.mockResolvedValue({
        message: 'ok',
      });

      const res = await controller.resetPassword(
          'token',
          {} as any,
      );

      expect(res.message).toBe('ok');
    });
  });

  describe('verifyEmail', () => {
    it('success html response', async () => {
      authServiceMock.verifyEmail.mockResolvedValue(true);

      const res = { send: jest.fn() };

      await controller.verifyEmail('token', res as any);

      expect(res.send).toHaveBeenCalled();
    });

    it('error', async () => {
      authServiceMock.verifyEmail.mockRejectedValue(
          new BadRequestException(),
      );

      const res = { send: jest.fn() };

      await expect(
          controller.verifyEmail('token', res as any),
      ).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('success', async () => {
      authServiceMock.logout.mockResolvedValue({ ok: true });

      const res = await controller.logout(reqMock, resMock);

      expect(authServiceMock.logout).toHaveBeenCalled();
    });
  });

  describe('oauth callbacks', () => {
    const oauthTest = async (fn: any) => {
      authServiceMock.validateOAuthLogin.mockResolvedValue({
        id: '1',
      });

      authServiceMock.issueTokens.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: '1' },
      });

      const res = await fn();

      expect(res.success).toBe(true);
    };

    it('google', async () => {
      await oauthTest(() =>
          controller.googleCallback(reqMock, resMock),
      );
    });

    it('github', async () => {
      await oauthTest(() =>
          controller.githubCallback(reqMock, resMock),
      );
    });

    it('facebook', async () => {
      await oauthTest(() =>
          controller.facebookCallback(reqMock, resMock),
      );
    });

    it('discord', async () => {
      await oauthTest(() =>
          controller.discordCallback(reqMock, resMock),
      );
    });
  });
});