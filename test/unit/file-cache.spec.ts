import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileCacheStore } from '../../src/infra/file-cache';
import { sourceOk } from '../../src/infra/types';

describe('FileCacheStore', () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'creva-cache-'));
    filePath = join(directory, 'nested', 'cache.json');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('returns a value written by an earlier instance', async () => {
    const first = new FileCacheStore({ filePath, now: () => 1_000 });
    await first.set('k', sourceOk('s', { a: 1 }), 5_000);

    const second = new FileCacheStore({ filePath, now: () => 2_000 });
    await expect(second.get('k')).resolves.toMatchObject({ data: { a: 1 } });
  });

  it('does not return a value that expired while the process was down', async () => {
    const first = new FileCacheStore({ filePath, now: () => 1_000 });
    await first.set('k', sourceOk('s', { a: 1 }), 500);

    const second = new FileCacheStore({ filePath, now: () => 9_000 });
    await expect(second.get('k')).resolves.toBeUndefined();
  });

  it('stores nothing when the TTL is zero', async () => {
    const cache = new FileCacheStore({ filePath });
    await cache.set('k', sourceOk('s', { a: 1 }), 0);

    await expect(cache.get('k')).resolves.toBeUndefined();
  });

  it('forgets a deleted key across instances', async () => {
    const first = new FileCacheStore({ filePath, now: () => 1_000 });
    await first.set('k', sourceOk('s', { a: 1 }), 5_000);
    await first.delete('k');

    const second = new FileCacheStore({ filePath, now: () => 1_100 });
    await expect(second.get('k')).resolves.toBeUndefined();
  });

  it('drops every key on clear', async () => {
    const cache = new FileCacheStore({ filePath, now: () => 1_000 });
    await cache.set('a', sourceOk('s', { a: 1 }), 5_000);
    await cache.set('b', sourceOk('s', { b: 2 }), 5_000);
    await cache.clear();

    const reopened = new FileCacheStore({ filePath, now: () => 1_100 });
    await expect(reopened.get('a')).resolves.toBeUndefined();
    await expect(reopened.get('b')).resolves.toBeUndefined();
  });

  it('starts empty when the file holds invalid JSON', async () => {
    const path = join(directory, 'broken.json');
    await writeFile(path, 'not json at all', 'utf8');

    const logged: string[] = [];
    const cache = new FileCacheStore({ filePath: path, logger: { log: (_level, event) => logged.push(event) } });

    await expect(cache.get('k')).resolves.toBeUndefined();
    expect(logged).toContain('cache.file_unreadable');
  });

  it('starts empty when the file was written by another version', async () => {
    const path = join(directory, 'versioned.json');
    await writeFile(path, JSON.stringify({ version: 999, entries: { x: {} } }), 'utf8');

    const cache = new FileCacheStore({ filePath: path, now: () => 1_000 });
    await expect(cache.get('k')).resolves.toBeUndefined();

    await cache.set('k', sourceOk('s', { a: 1 }), 5_000);
    await expect(cache.get('k')).resolves.toMatchObject({ data: { a: 1 } });
  });

  it('skips entries whose shape does not survive a reread', async () => {
    const path = join(directory, 'partial.json');
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        entries: {
          good: { value: sourceOk('s', { a: 1 }), expiresAt: 9_000 },
          missingExpiry: { value: sourceOk('s', { b: 2 }) },
          missingValue: { expiresAt: 9_000 },
        },
      }),
      'utf8',
    );

    const cache = new FileCacheStore({ filePath: path, now: () => 1_000 });
    const raw = JSON.parse(await readFile(path, 'utf8')) as { entries: Record<string, unknown> };
    expect(Object.keys(raw.entries)).toHaveLength(3);

    await cache.set('fresh', sourceOk('s', { c: 3 }), 5_000);
    const rewritten = JSON.parse(await readFile(path, 'utf8')) as { entries: Record<string, unknown> };
    expect(Object.keys(rewritten.entries)).toHaveLength(2);
  });

  it('reports a failed write instead of throwing', async () => {
    const logged: string[] = [];
    const cache = new FileCacheStore({
      filePath: join(directory, 'cache.json'),
      logger: { log: (_level, event) => logged.push(event) },
    });

    await rm(directory, { recursive: true, force: true });
    await writeFile(directory, 'now a file, not a directory', 'utf8');

    await expect(cache.set('k', sourceOk('s', { a: 1 }), 5_000)).resolves.toBeUndefined();
    expect(logged).toContain('cache.write_failed');
  });
});
