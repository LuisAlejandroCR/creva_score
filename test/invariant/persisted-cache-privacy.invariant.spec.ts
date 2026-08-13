import fc from 'fast-check';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileCacheStore } from '../../src/infra/file-cache';
import { CallOptions, CromaCallable } from '../../src/infra/croma-client';
import { SourceResult, sourceOk } from '../../src/infra/types';
import { SiemClient } from '../../src/siem/siem.client';
import { BusinessVerificationService } from '../../src/business-verification/business-verification.service';

class StubCroma implements CromaCallable {
  async call<T>(_path: string, _body: unknown, _options: CallOptions): Promise<SourceResult<T>> {
    return sourceOk('mx.siem', {
      query: 'q',
      establishments: [],
      pagination: { total: 0, page_size: 10, total_pages: 0, page: 1 },
    }) as SourceResult<T>;
  }
}

const arbRfc = fc
  .tuple(fc.stringMatching(/^[A-Z]{3,4}$/), fc.stringMatching(/^[0-9]{6}$/), fc.stringMatching(/^[A-Z0-9]{3}$/))
  .map(([a, b, c]) => `${a}${b}${c}`);

const arbBusinessName = fc
  .string({ minLength: 4, maxLength: 60 })
  .filter((value) => /[A-Za-z]{4}/.test(value));

describe('persisted cache privacy invariants', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'creva-cache-privacy-'));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('never writes a readable business name or RFC into the file, for any input', async () => {
    await fc.assert(
      fc.asyncProperty(arbBusinessName, arbRfc, async (businessName, rfc) => {
        const path = join(directory, 'privacy.json');
        await rm(path, { force: true });

        const cache = new FileCacheStore({ filePath: path });
        const service = new BusinessVerificationService(new SiemClient(new StubCroma()), cache, {
          cacheTtlMs: 60_000,
          maxDetailLookups: 1,
          rfcField: 'establishment.rfc',
        });

        await service.verify({ businessName, rfc });

        const file = JSON.parse(await readFile(path, 'utf8')) as { entries: Record<string, unknown> };
        const keys = Object.keys(file.entries);
        expect(keys.length).toBeGreaterThan(0);

        for (const key of keys) {
          expect(key).toMatch(/^[0-9a-f]{64}$/);
          expect(key.toUpperCase()).not.toContain(rfc.toUpperCase());
          expect(key.toUpperCase()).not.toContain(businessName.trim().toUpperCase());
        }

        // The cached payload is what the directory returned; the RFC is never part of it.
        expect(JSON.stringify(Object.values(file.entries)).toUpperCase()).not.toContain(rfc.toUpperCase());
      }),
      { numRuns: 150 },
    );
  });

  it('leaves nothing readable behind after a deletion request, for any input', async () => {
    await fc.assert(
      fc.asyncProperty(arbBusinessName, async (key) => {
        const path = join(directory, 'erasure.json');
        await rm(path, { force: true });

        const marker = `payload-marker-${key.trim()}`;
        const cache = new FileCacheStore({ filePath: path, now: () => 1_000 });
        await cache.set(key, sourceOk('mx.siem', { commercial_name: marker }), 60_000);
        await cache.delete(key);

        const reopened = new FileCacheStore({ filePath: path, now: () => 1_100 });
        await expect(reopened.get(key)).resolves.toBeUndefined();

        const raw = await readFile(path, 'utf8');
        expect(raw).not.toContain(marker);
        expect(JSON.parse(raw)).toMatchObject({ entries: {} });
      }),
      { numRuns: 100 },
    );
  });
});
