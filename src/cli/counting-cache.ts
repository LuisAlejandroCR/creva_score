// counting-cache: cache wrapper that records whether a run read from storage or from the sources.

import { CacheStore } from '../infra/cache';
import { SourceResult } from '../infra/types';

export class CountingCacheStore implements CacheStore {
  private hitCount = 0;
  private missCount = 0;

  constructor(private readonly inner: CacheStore) {}

  get hits(): number {
    return this.hitCount;
  }

  get misses(): number {
    return this.missCount;
  }

  async get<T>(key: string): Promise<SourceResult<T> | undefined> {
    const found = await this.inner.get<T>(key);
    if (found === undefined) {
      this.missCount++;
    } else {
      this.hitCount++;
    }
    return found;
  }

  async set<T>(key: string, value: SourceResult<T>, ttlMs: number): Promise<void> {
    await this.inner.set(key, value, ttlMs);
  }

  async delete(key: string): Promise<void> {
    await this.inner.delete(key);
  }
}
