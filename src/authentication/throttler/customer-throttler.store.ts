import { Injectable } from '@nestjs/common';

type Entry = {
  count: number;
  lockedUntil?: number;
};

@Injectable()
export class CustomerThrottlerStore {
  private store = new Map<string, Entry>();

  get(key: string): Entry {
    return this.store.get(key) || { count: 0 };
  }

  set(key: string, value: Entry) {
    this.store.set(key, value);
  }

  reset(key: string) {
    this.store.delete(key);
  }
}
