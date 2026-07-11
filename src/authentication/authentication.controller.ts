/* eslint-disable */
import {
  Body,
  Controller,
  Post,
  UseGuards,
  Res,
  Get,
  Query,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';

import { AuthenticationService } from './authentication.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CustomerThrottlerInterceptor } from './interceptor/customer-throttler.interceptor';
import { CustomerThrottlerGuard } from './guards/customer-throttler.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { ReactivateAccountDto } from './dto/reactivate-account.dto';
import { RefreshResponse } from '../types';

@ApiTags('Auth')
@Controller('auth')
export class AuthenticationController {
  constructor(private auth: AuthenticationService) {}

  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3001';
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 400, description: 'Email or phone already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto);
    return { message: result.message };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or locked account',
  })
  @UseGuards(CustomerThrottlerGuard)
  @UseInterceptors(CustomerThrottlerInterceptor)
  async login(
    @Body() dto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, req);
    if ('requiresTwoFactor' in result) {
      return result;
    }
    this.setCookies(res, result);
    return {
      user: result.user,
    };
  }

  @Post('reactivate')
  @ApiOperation({ summary: 'Request account reactivation' })
  async reactivate(@Body() dto: ReactivateAccountDto) {
    return this.auth.reactivateAccount(dto.email);
  }

  @Get('reactivate/confirm')
  @ApiQuery({
    name: 'token',
    required: true,
  })
  async confirmReactivate(@Query('token') token: string, @Res() res: Response) {
    await this.auth.confirmReactivation(token);

    return res.send(`
    <html>
      <body style="font-family:Arial;text-align:center;padding:50px;">
        <h2>Account Reactivated</h2>
        <p>You can now log in again.</p>
      </body>
    </html>
  `);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate QR code for 2FA setup' })
  async setup2FA(@CurrentUser() user: any) {
    return this.auth.setup2FA(user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable 2FA after verifying code' })
  async enable2FA(@CurrentUser() user: any, @Body('code') code: string) {
    return this.auth.enable2FA(user.id, code);
  }

  @Post('2fa/verify')
  async verify2FA(
    @Body('tempToken') tempToken: string,
    @Body('code') code: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verify2FA(tempToken, code, req);

    this.setCookies(res, result);

    return {
      success: true,
      user: result.user,
    };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Send password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Reset email sent (if account exists)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Reset token from email',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  resetPassword(@Query('token') token: string, @Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(token, dto);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email using token' })
  @ApiQuery({ name: 'token', required: true })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully and logged in',
  })
  async verifyEmail(
    @Query('token') token: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyEmail(token);

    const tokens = await this.auth.issueTokens(result.account, req, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    this.setCookies(res, tokens);

    return {
      success: true,
      message: 'Email verified and logged in successfully',
      user: tokens.user,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged-in user' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@CurrentUser() user: any) {
    return { user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user and revoke session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access and refresh tokens via HTTP-only cookies',
    description:
      'This endpoint expects the refresh_token to be automatically present in incoming request cookies.',
  })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const requestWithCookies = req as Record<string, any>;
    const refreshToken: string | undefined =
      requestWithCookies.cookies?.refresh_token;

    const result = await this.auth.refreshTokens(refreshToken, req as any);

    this.setCookies(res, result);

    return {
      user: result.user,
    };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const account = await this.auth.validateOAuthLogin(req.user);

    const result = await this.auth.handlePostLoginState(account, req, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    const frontendUrl = this.getFrontendUrl();

    if ('requiresTwoFactor' in result) {
      return res.redirect(
        `${frontendUrl}/auth/verify-2fa?tempToken=${result.tempToken}`,
      );
    }

    this.setCookies(res, result);
    return res.redirect(`${frontendUrl}/auth/oauth-success`);
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubAuth() {}

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const account = await this.auth.validateOAuthLogin(req.user);

    const result = await this.auth.handlePostLoginState(account, req, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    const frontendUrl = this.getFrontendUrl();

    if ('requiresTwoFactor' in result) {
      return res.redirect(
        `${frontendUrl}/auth/verify-2fa?tempToken=${result.tempToken}`,
      );
    }

    this.setCookies(res, result);
    return res.redirect(`${frontendUrl}/auth/oauth-success`);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  facebookAuth() {}

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const account = await this.auth.validateOAuthLogin(req.user);

    const result = await this.auth.handlePostLoginState(account, req, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    const frontendUrl = this.getFrontendUrl();

    if ('requiresTwoFactor' in result) {
      return res.redirect(
        `${frontendUrl}/auth/verify-2fa?tempToken=${result.tempToken}`,
      );
    }

    this.setCookies(res, result);
    return res.redirect(`${frontendUrl}/auth/oauth-success`);
  }

  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  discordAuth() {}

  @Get('discord/callback')
  @UseGuards(AuthGuard('discord'))
  async discordCallback(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const account = await this.auth.validateOAuthLogin(req.user);

    const result = await this.auth.handlePostLoginState(account, req, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    const frontendUrl = this.getFrontendUrl();

    if ('requiresTwoFactor' in result) {
      return res.redirect(
        `${frontendUrl}/auth/verify-2fa?tempToken=${result.tempToken}`,
      );
    }

    this.setCookies(res, result);
    return res.redirect(`${frontendUrl}/auth/oauth-success`);
  }

  private setCookies(res: Response, tokens: any) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
