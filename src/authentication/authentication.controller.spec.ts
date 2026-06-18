import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CustomerThrottlerGuard } from './guards/customer-throttler.guard';
import { CustomerThrottlerStore } from './throttler/customer-throttler.store';

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
    reactivateAccount: jest.fn(),
    confirmReactivation: jest.fn(),
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
      expect(resMock.cookie).toHaveBeenCalledTimes(0);
    });

    it('error', async () => {
      authServiceMock.register.mockRejectedValue(new BadRequestException());

      await expect(controller.register({} as any, resMock)).rejects.toThrow(
        BadRequestException,
      );
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
        { email: 'x', password: 'y' },
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
        { email: 'x', password: 'y' },
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
      authServiceMock.setup2FA.mockRejectedValue(new BadRequestException());

      await expect(controller.setup2FA({ id: '1' })).rejects.toThrow();
    });
  });

  describe('enable2FA', () => {
    it('success', async () => {
      authServiceMock.enable2FA.mockResolvedValue({
        message: 'enabled',
      });

      const res = await controller.enable2FA({ id: '1' }, '123');

      expect(res.message).toBe('enabled');
    });

    it('error', async () => {
      authServiceMock.enable2FA.mockRejectedValue(new BadRequestException());

      await expect(controller.enable2FA({ id: '1' }, '123')).rejects.toThrow();
    });
  });

  describe('verify2FA', () => {
    it('success', async () => {
      authServiceMock.verify2FA.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: '1' },
      });

      const res = await controller.verify2FA('temp', '123', reqMock, resMock);

      expect(res.success).toBe(true);
      expect(resMock.cookie).toHaveBeenCalled();
    });

    it('error', async () => {
      authServiceMock.verify2FA.mockRejectedValue(new BadRequestException());

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
      });

      expect(res.message).toBe('sent');
    });
  });

  describe('resetPassword', () => {
    it('success', async () => {
      authServiceMock.resetPassword.mockResolvedValue({
        message: 'ok',
      });

      const res = await controller.resetPassword('token', {} as any);

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
      authServiceMock.verifyEmail.mockRejectedValue(new BadRequestException());

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
      await oauthTest(() => controller.googleCallback(reqMock, resMock));
    });

    it('github', async () => {
      await oauthTest(() => controller.githubCallback(reqMock, resMock));
    });

    it('facebook', async () => {
      await oauthTest(() => controller.facebookCallback(reqMock, resMock));
    });

    it('discord', async () => {
      await oauthTest(() => controller.discordCallback(reqMock, resMock));
    });

    it('login should handle missing request headers safely', async () => {
      authServiceMock.login.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { sub: '1' },
      });

      const res = (await controller.login(
        { email: 'x', password: 'y' },
        reqMock,
        resMock,
      )) as any;

      expect(res.user.sub).toBe('1');
      expect(resMock.cookie).toHaveBeenCalled();
    });

    it('login should NOT set cookies when 2FA required', async () => {
      authServiceMock.login.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: 'temp123',
      });

      const res: any = await controller.login(
        { email: 'x', password: 'y' },
        reqMock,
        resMock,
      );

      expect(res.requiresTwoFactor).toBe(true);
      expect(resMock.cookie).not.toHaveBeenCalled();
    });

    it('verifyEmail should return success HTML content', async () => {
      authServiceMock.verifyEmail.mockResolvedValue(true);

      const res = { send: jest.fn() };

      await controller.verifyEmail('token', res as any);

      expect(res.send).toHaveBeenCalled();

      const html = res.send.mock.calls[0][0];
      expect(html).toContain('Email Verified Successfully');
    });

    it('reactivate should call service with email', async () => {
      authServiceMock.reactivateAccount = jest.fn().mockResolvedValue({
        message: 'Reactivation email sent',
      });

      const res = await controller.reactivate({
        email: 'test@test.com',
      });

      expect(authServiceMock.reactivateAccount).toHaveBeenCalledWith(
        'test@test.com',
      );

      expect(res.message).toBe('Reactivation email sent');
    });

    it('confirmReactivate should return HTML page', async () => {
      authServiceMock.confirmReactivation = jest.fn().mockResolvedValue(true);

      const res = { send: jest.fn() };

      await controller.confirmReactivate('token123', res as any);

      expect(authServiceMock.confirmReactivation).toHaveBeenCalledWith(
        'token123',
      );

      expect(res.send).toHaveBeenCalled();

      const html = res.send.mock.calls[0][0];
      expect(html).toContain('Account Reactivated');
    });

    it('logout should forward request and response', async () => {
      authServiceMock.logout.mockResolvedValue({ ok: true });

      await controller.logout(reqMock, resMock);

      expect(authServiceMock.logout).toHaveBeenCalledWith(reqMock, resMock);
    });

    it('google callback should pass correct device info', async () => {
      authServiceMock.validateOAuthLogin.mockResolvedValue({
        id: '1',
        email: 'a@test.com',
      });

      authServiceMock.issueTokens.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: '1' },
      });

      await controller.googleCallback(reqMock, resMock);

      expect(authServiceMock.issueTokens).toHaveBeenCalledWith(
        expect.anything(),
        reqMock,
        expect.objectContaining({
          ip: '127.0.0.1',
        }),
      );
    });

    it('should propagate unexpected controller errors', async () => {
      authServiceMock.login.mockRejectedValue(new Error('DB crash'));

      await expect(
        controller.login(
          { email: 'x', password: 'y' } as any,
          reqMock,
          resMock,
        ),
      ).rejects.toThrow('DB crash');
    });
  });
});
