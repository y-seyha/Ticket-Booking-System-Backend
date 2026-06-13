import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CustomerThrottlerStore } from '../throttler/customer-throttler.store';

@Injectable()
export class CustomerThrottlerGuard implements CanActivate {
  constructor(private store: CustomerThrottlerStore) {}

  private MAX_ATTEMPTS = 3;
  private LOCK_TIME_MS = 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const key = req.body?.email || req.ip;
    const entry = this.store.get(key);

    // BLOCK IF LOCKED
    if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
      const wait = Math.ceil((entry.lockedUntil - Date.now()) / 1000);

      throw new UnauthorizedException(
        `Too many attempts. Try again in ${wait}s`,
      );
    }

    req.__throttleKey = key;
    req.__throttleEntry = entry;

    return true;
  }
}
