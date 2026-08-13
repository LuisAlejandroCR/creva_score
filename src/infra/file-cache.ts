// file-cache: cache store that survives a process restart.

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CacheStore } from './cache';
import { Logger, noopLogger } from './logger';
import { SourceResult } from './types';

const FILE_VERSION = 1;

interface PersistedEntry {
  value: SourceResult<unknown>;
  expiresAt: number;
}

interface PersistedFile {
  version: number;
  entries: Record<string, PersistedEntry>;
}

export interface FileCacheStoreOptions {
  filePath: string;
  now?: () => number;
  logger?: Logger;
}

export class FileCacheStore implements CacheStore {
  private readonly filePath: string;
  private readonly now: () => number;
  private readonly logger: Logger;
  private entries: Map<string, PersistedEntry> | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(options: FileCacheStoreOptions) {
    this.filePath = options.filePath;
    this.now = options.now ?? (() => Date.now());
    this.logger = options.logger ?? noopLogger;
  }

  async get<T>(key: string): Promise<SourceResult<T> | undefined> {
    const entries = await this.load();
    const id = fingerprint(key);
    const entry = entries.get(id);
    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      entries.delete(id);
      await this.flush();
      return undefined;
    }
    return entry.value as SourceResult<T>;
  }

  async set<T>(key: string, value: SourceResult<T>, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) return;

    const entries = await this.load();
    entries.set(fingerprint(key), { value, expiresAt: this.now() + ttlMs });
    await this.flush();
  }

  async delete(key: string): Promise<void> {
    const entries = await this.load();
    if (!entries.delete(fingerprint(key))) return;
    await this.flush();
  }

  async clear(): Promise<void> {
    this.entries = new Map();
    await this.flush();
  }

  private async load(): Promise<Map<string, PersistedEntry>> {
    if (this.entries !== null) return this.entries;

    const entries = new Map<string, PersistedEntry>();
    this.entries = entries;

    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch {
      return entries;
    }

    const parsed = parseFile(raw);
    if (parsed === null) {
      this.logger.log('warn', 'cache.file_unreadable', { path: this.filePath });
      return entries;
    }

    const now = this.now();
    for (const [id, entry] of Object.entries(parsed.entries)) {
      if (entry.expiresAt > now) entries.set(id, entry);
    }
    return entries;
  }

  private async flush(): Promise<void> {
    const run = this.writing.then(() => this.writeSnapshot());
    this.writing = run.catch(() => undefined);
    return run;
  }

  private async writeSnapshot(): Promise<void> {
    const entries = this.entries ?? new Map<string, PersistedEntry>();
    const now = this.now();

    const payload: PersistedFile = { version: FILE_VERSION, entries: {} };
    for (const [id, entry] of entries) {
      if (entry.expiresAt <= now) {
        entries.delete(id);
        continue;
      }
      payload.entries[id] = entry;
    }

    const temporary = join(dirname(this.filePath), `.${fingerprint(this.filePath)}.${process.pid}.tmp`);
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(temporary, JSON.stringify(payload), 'utf8');
      await rename(temporary, this.filePath);
    } catch (error) {
      this.logger.log('warn', 'cache.write_failed', {
        path: this.filePath,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      await unlink(temporary).catch(() => undefined);
    }
  }
}

// Keys reach this store carrying the business name the user typed; the file keeps only a digest.
function fingerprint(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function parseFile(raw: string): PersistedFile | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== 'object') return null;
  const candidate = parsed as Partial<PersistedFile>;
  if (candidate.version !== FILE_VERSION) return null;
  if (candidate.entries === null || typeof candidate.entries !== 'object') return null;

  const entries: Record<string, PersistedEntry> = {};
  for (const [id, entry] of Object.entries(candidate.entries as Record<string, unknown>)) {
    if (entry === null || typeof entry !== 'object') continue;
    const shaped = entry as Partial<PersistedEntry>;
    if (typeof shaped.expiresAt !== 'number' || !Number.isFinite(shaped.expiresAt)) continue;
    if (shaped.value === null || typeof shaped.value !== 'object') continue;
    entries[id] = { value: shaped.value as SourceResult<unknown>, expiresAt: shaped.expiresAt };
  }
  return { version: FILE_VERSION, entries };
}
