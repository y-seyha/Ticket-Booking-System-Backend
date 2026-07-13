import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { CustomerThrottlerStore } from '../throttler/customer-throttler.store';

interface ThrottleEntry {
  lockedUntil: number | null;
}

interface ThrottledRequest extends Request {
  body: {
    email?: string;
  };
  __throttleKey?: string;
  __throttleEntry?: ThrottleEntry;
}

@Injectable()
export class CustomerThrottlerGuard implements CanActivate {
  constructor(private store: CustomerThrottlerStore) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<ThrottledRequest>();

    const key = req.body?.email || req.ip || 'unknown-ip';
    // Cast the response of your store to ensure type-safety on entry checks
    const entry = this.store.get(key) as ThrottleEntry;

    if (entry && entry.lockedUntil && entry.lockedUntil > Date.now()) {
      const wait = Math.ceil((entry.lockedUntil - Date.now()) / 1000);

      throw new HttpException(
        {
          message: 'Too many login attempts',
          retryAfter: wait,
          code: 'RATE_LIMITED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    req.__throttleKey = key;
    req.__throttleEntry = entry;

    return true;
  }
}
