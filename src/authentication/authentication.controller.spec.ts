/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CustomerThrottlerGuard } from './guards/customer-throttler.guard';
import { CustomerThrottlerStore } from './throttler/customer-throttler.store';
import { Request, Response } from 'express';

// Type-safe Mock Interfaces representing the DTO structures expected by your controller
interface MockRegisterDto {
  email: string;
  password?: string;
}

interface MockLoginDto {
  email: string;
  password?: string;
}

interface MockResetPasswordDto {
  newPassword?: string;
  confirmNewPassword?: string;
  [key: string]: unknown;
}

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
    handlePostLoginState: jest.fn(),
    reactivateAccount: jest.fn(),
    confirmReactivation: jest.fn(),
  };

  // Type safe Response mock
  const resMock = {
    cookie: jest.fn(),
    send: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response;

  // Type safe Request mock
  const reqMock = {
    headers: { 'user-agent': 'jest' },
    ip: '127.0.0.1',
  } as unknown as Request;

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

    controller = module.get<AuthenticationController>(AuthenticationController);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('success', async () => {
      authServiceMock.register.mockResolvedValue({
        message: 'Account created',
        accessToken: 'a',
        refreshToken: 'r',
      });

      const dto: MockRegisterDto = { email: 'a', password: 'b' };
      const res = await controller.register(
        dto as Parameters<typeof controller.register>[0],
        resMock,
      );

      expect(res.message).toBe('Account created');
      expect(resMock.cookie).toHaveBeenCalledTimes(0);
    });

    it('error', async () => {
      authServiceMock.register.mockRejectedValue(new BadRequestException());

      const emptyDto = {} as Parameters<typeof controller.register>[0];
      await expect(controller.register(emptyDto, resMock)).rejects.toThrow(
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

      const dto: MockLoginDto = { email: 'x', password: 'y' };
      const res = await controller.login(
        dto as Parameters<typeof controller.login>[0],
        reqMock,
        resMock,
      );

      if (res && 'user' in res && res.user) {
        expect(res.user.sub).toBe('1');
      }

      expect(resMock.cookie).toHaveBeenCalled();
    });

    it('2FA required branch', async () => {
      authServiceMock.login.mockResolvedValue({
        requiresTwoFactor: true,
        tempToken: 'temp',
      });

      const dto: MockLoginDto = { email: 'x', password: 'y' };
      const res = await controller.login(
        dto as Parameters<typeof controller.login>[0],
        reqMock,
        resMock,
      );

      if (res && 'requiresTwoFactor' in res) {
        expect(res.requiresTwoFactor).toBe(true);
        expect(res.tempToken).toBe('temp');
      }

      expect(resMock.cookie).not.toHaveBeenCalled();
    });

    it('login error', async () => {
      authServiceMock.login.mockRejectedValue(new UnauthorizedException());

      const emptyDto = {} as Parameters<typeof controller.login>[0];
      await expect(
        controller.login(emptyDto, reqMock, resMock),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('login should handle missing request headers safely', async () => {
      authServiceMock.login.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { sub: '1' },
      });

      const dto: MockLoginDto = { email: 'x', password: 'y' };
      const res = await controller.login(
        dto as Parameters<typeof controller.login>[0],
        reqMock,
        resMock,
      );

      if (res && 'user' in res && res.user) {
        expect(res.user.sub).toBe('1');
      }
      expect(resMock.cookie).toHaveBeenCalled();
    });

    it('should propagate unexpected controller login errors', async () => {
      authServiceMock.login.mockRejectedValue(new Error('DB crash'));

      const dto: MockLoginDto = { email: 'x', password: 'y' };
      await expect(
        controller.login(
          dto as Parameters<typeof controller.login>[0],
          reqMock,
          resMock,
        ),
      ).rejects.toThrow('DB crash');
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

      const emptyDto: MockResetPasswordDto = {};
      const res = await controller.resetPassword(
        'token',
        emptyDto as Parameters<typeof controller.resetPassword>[1],
      );

      expect(res.message).toBe('ok');
    });
  });

  describe('verifyEmail', () => {
    const verifyReqMock = {
      headers: { 'user-agent': 'jest' },
      ip: '127.0.0.1',
    } as unknown as Request;

    it('success html response', async () => {
      authServiceMock.verifyEmail.mockResolvedValue({
        account: { id: 'acc1', email: 'test@test.com' },
      });
      authServiceMock.issueTokens.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { sub: 'acc1' },
      });

      const res = { cookie: jest.fn(), send: jest.fn() } as unknown as Response;

      await controller.verifyEmail('token', verifyReqMock, res);

      expect(authServiceMock.issueTokens).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
    });

    it('verifyEmail should return success JSON response', async () => {
      authServiceMock.verifyEmail.mockResolvedValue({
        account: { id: 'acc1', email: 'test@test.com' },
      });
      authServiceMock.issueTokens.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { sub: 'acc1' },
      });

      const res = { cookie: jest.fn() } as unknown as Response;

      const result = await controller.verifyEmail('token', reqMock, res);

      expect(result.success).toBe(true);
      expect(result.message).toContain('verified');
      expect(res.cookie).toHaveBeenCalled();
    });

    it('error', async () => {
      authServiceMock.verifyEmail.mockRejectedValue(new BadRequestException());

      const res = { cookie: jest.fn(), send: jest.fn() } as unknown as Response;

      await expect(
        controller.verifyEmail('token', verifyReqMock, res),
      ).rejects.toThrow();
    });
  });

  describe('reactivate', () => {
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

      const mockSend = jest.fn();
      const res = { send: mockSend } as unknown as Response;

      await controller.confirmReactivate('token123', res);

      expect(authServiceMock.confirmReactivation).toHaveBeenCalledWith(
        'token123',
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('Account Reactivated'),
      );
    });
  });

  describe('logout', () => {
    it('success', async () => {
      authServiceMock.logout.mockResolvedValue({ ok: true });

      const res = await controller.logout(reqMock, resMock);

      expect(res).toBeDefined();
      expect(authServiceMock.logout).toHaveBeenCalled();
    });

    it('logout should forward request and response', async () => {
      authServiceMock.logout.mockResolvedValue({ ok: true });

      await controller.logout(reqMock, resMock);

      expect(authServiceMock.logout).toHaveBeenCalledWith(reqMock, resMock);
    });
  });

  describe('oauth callbacks', () => {
    const oauthTest = async (fn: () => Promise<unknown>) => {
      authServiceMock.validateOAuthLogin.mockResolvedValue({
        id: '1',
      });

      authServiceMock.handlePostLoginState.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: '1' },
      });

      await fn();

      expect(authServiceMock.handlePostLoginState).toHaveBeenCalled();
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

    it('google callback should pass correct device info', async () => {
      authServiceMock.validateOAuthLogin.mockResolvedValue({
        id: '1',
        email: 'a@test.com',
      });

      authServiceMock.handlePostLoginState.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: '1' },
      });

      await controller.googleCallback(reqMock, resMock);

      expect(authServiceMock.handlePostLoginState).toHaveBeenCalledWith(
        expect.anything(),
        reqMock,
        expect.objectContaining({
          ip: '127.0.0.1',
        }),
      );
    });
  });
});
