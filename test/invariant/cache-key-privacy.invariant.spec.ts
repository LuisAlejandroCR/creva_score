import fc from 'fast-check';
import { MemoryCacheStore } from '../../src/infra/cache';
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
  .tuple(
    fc.stringMatching(/^[A-Z]{3,4}$/),
    fc.stringMatching(/^[0-9]{6}$/),
    fc.stringMatching(/^[A-Z0-9]{3}$/),
  )
  .map(([a, b, c]) => `${a}${b}${c}`);

describe('cache key privacy invariants', () => {
  it('never writes the RFC into a cache key, in any casing or separator form', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 2, maxLength: 60 }),
        arbRfc,
        fc.constantFrom<(v: string) => string>(
          (v) => v,
          (v) => v.toLowerCase(),
          (v) => `${v.slice(0, 4)}-${v.slice(4)}`,
          (v) => `  ${v}  `,
        ),
        async (businessName, rfc, mangle) => {
          const cache = new MemoryCacheStore();
          const service = new BusinessVerificationService(new SiemClient(new StubCroma()), cache, {
            cacheTtlMs: 60_000,
            maxDetailLookups: 1,
            rfcField: 'establishment.rfc',
          });

          await service.verify({ businessName, rfc: mangle(rfc) });

          const keys = Array.from((cache as unknown as { entries: Map<string, unknown> }).entries.keys());
          for (const key of keys) {
            expect(key.toUpperCase()).not.toContain(rfc.toUpperCase());
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
