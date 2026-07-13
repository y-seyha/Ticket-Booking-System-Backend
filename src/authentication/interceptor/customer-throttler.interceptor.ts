import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request } from 'express';
import { CustomerThrottlerStore } from '../throttler/customer-throttler.store';

interface ThrottleEntry {
  count: number;
  lockedUntil: number | undefined;
}

interface ThrottledRequest extends Request {
  __throttleKey?: string;
  __throttleEntry?: ThrottleEntry;
}

@Injectable()
export class CustomerThrottlerInterceptor implements NestInterceptor {
  constructor(private store: CustomerThrottlerStore) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<ThrottledRequest>();

    const key = req.__throttleKey;

    return next.handle().pipe(
      tap(() => {
        if (key) this.store.reset(key);
      }),

      catchError((err: unknown) => {
        if (key) {
          const current = this.store.get(key) as ThrottleEntry;

          const newCount = current.count + 1;
          let lockedUntil = current.lockedUntil;

          if (newCount >= 3) {
            lockedUntil = Date.now() + 60 * 1000; // 1 min lock
          }

          this.store.set(key, {
            count: newCount,
            lockedUntil,
          });
        }

        return throwError(() => err);
      }),
    );
  }
}
