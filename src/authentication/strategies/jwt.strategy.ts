import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

interface RequestWithCookies extends Request {
  cookies: {
    access_token?: string;
  };
}

const cookieExtractor = (req: RequestWithCookies): string | null => {
  return req?.cookies?.access_token || null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = config.get<string>('JWT_SECRET');

    if (!secret) throw new Error('JWT_SECRET is missing');

    super({
      jwtFromRequest: cookieExtractor,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        roleId: true,
        profile: {
          select: {
            phone: true,
          },
        },
      },
    });

    if (!account) {
      throw new UnauthorizedException('Account not found');
    }

    return {
      id: account.id,
      email: account.email,
      role: account.roleId,
      phone: account.profile?.phone,
    };
  }
}
