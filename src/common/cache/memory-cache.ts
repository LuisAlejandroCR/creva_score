// cache: cache port for verification results.

import { SourceResult } from '../types/source-result.types';

export interface CacheStore {
  get<T>(key: string): Promise<SourceResult<T> | undefined>;
  set<T>(key: string, value: SourceResult<T>, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

interface CacheEntry {
  value: SourceResult<unknown>;
  expiresAt: number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async get<T>(key: string): Promise<SourceResult<T> | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as SourceResult<T>;
  }

  async set<T>(key: string, value: SourceResult<T>, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) return;
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}
