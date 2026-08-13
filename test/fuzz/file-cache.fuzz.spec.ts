import fc from 'fast-check';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileCacheStore } from '../../src/common/cache/file-cache';
import { sourceOk } from '../../src/common/types/source-result.types';

describe('FileCacheStore fuzz', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'creva-cache-fuzz-'));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('never throws on an arbitrary file, whatever it contains', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.string({ minLength: 1, maxLength: 40 }), async (contents, key) => {
        const path = join(directory, 'arbitrary.json');
        await writeFile(path, contents, 'utf8');

        const cache = new FileCacheStore({ filePath: path });
        await expect(cache.get(key)).resolves.toBeUndefined();
        await expect(cache.set(key, sourceOk('s', { a: 1 }), 1_000)).resolves.toBeUndefined();
        await expect(cache.delete(key)).resolves.toBeUndefined();
      }),
      { numRuns: 60 },
    );
  });

  it('never throws on an arbitrary JSON structure in the entries slot', async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (entries) => {
        const path = join(directory, 'structured.json');
        await writeFile(path, JSON.stringify({ version: 1, entries }), 'utf8');

        const cache = new FileCacheStore({ filePath: path });
        await expect(cache.get('k')).resolves.toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('round-trips any key through a restart', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 200 }), async (key) => {
        const path = join(directory, 'roundtrip.json');
        await rm(path, { force: true });

        const writer = new FileCacheStore({ filePath: path, now: () => 1_000 });
        await writer.set(key, sourceOk('s', { marker: 7 }), 10_000);

        const reader = new FileCacheStore({ filePath: path, now: () => 2_000 });
        await expect(reader.get(key)).resolves.toMatchObject({ data: { marker: 7 } });
      }),
      { numRuns: 60 },
    );
  });
});
