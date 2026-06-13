import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, tap, throwError } from 'rxjs';
import { CustomerThrottlerStore } from '../throttler/customer-throttler.store';

@Injectable()
export class CustomerThrottlerInterceptor implements NestInterceptor {
  constructor(private store: CustomerThrottlerStore) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();

    const key = req.__throttleKey;

    return next.handle().pipe(
      tap(() => {
        // if success → reset attempts
        if (key) this.store.reset(key);
      }),

      catchError((err) => {
        //  failure → increment
        if (key) {
          const current = this.store.get(key);

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
