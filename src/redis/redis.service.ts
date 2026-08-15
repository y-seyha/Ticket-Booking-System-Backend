import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private client: Redis;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';

    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });

    this.client.on('error', (error) => {
      this.logger.warn(
        `Redis error: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    try {
      await this.client.connect();
      this.logger.log('Connected to Redis');
    } catch (error) {
      this.logger.error(
        'Failed to connect to Redis — cache will be bypassed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async onModuleDestroy() {
    this.inFlight.clear();
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  isReady(): boolean {
    return this.client?.status === 'ready';
  }


  //get cached data
  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw === null || raw === undefined) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logWarn('getJson', key, error);
      return null;
    }
  }

  //save or update cach data
  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    if (value === undefined || value === null) return;

    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, raw, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, raw);
      }
    } catch (error) {
      this.logWarn('setJson', key, error);
    }
  }

  //delete one cache
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logWarn('del', key, error);
    }
  }

  //delete multiple caches
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.scanKeys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logWarn('delPattern', pattern, error);
    }
  }

  /**
   * Cache-aside read: returns the cached value, or runs `loader`,
   * stores the result and returns it. In-flight deduplication prevents
   * cache stampedes for the same key. Fail-open: if Redis is down,
   * always falls through to `loader`.
   */

  //get cache, otherwise query DB + cache
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (!this.isReady()) {
      return loader();
    }

    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = loader()
      .then(async (value) => {
        await this.setJson(key, value, ttlSeconds);
        return value;
      })
      .catch((error) => {
        throw error;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== '0');

    return keys;
  }

  private logWarn(operation: string, key: string, error: unknown) {
    this.logger.warn(
      `Redis ${operation} failed for "${key}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
