import fc from 'fast-check';
import { MemoryCacheStore } from '../../src/common/cache/memory-cache';
import { CallOptions, CromaCallable } from '../../src/common/http/croma.client';
import { SourceResult, sourceOk } from '../../src/common/types/source-result.types';
import { CnbvClient } from '../../src/modules/regulatory-radar/providers/cnbv.provider';
import { CNBV_REGULATIONS_PATH } from '../../src/modules/regulatory-radar/providers/cnbv.types';
import { DofClient } from '../../src/modules/regulatory-radar/providers/dof.provider';
import { DOF_PUBLICATIONS_BY_DATE_PATH } from '../../src/modules/regulatory-radar/providers/dof.types';
import { RegulatoryRadarService } from '../../src/modules/regulatory-radar/regulatory-radar.service';

class Croma implements CromaCallable {
  readonly bodies: unknown[] = [];

  async call<T>(path: string, body: unknown, _options: CallOptions): Promise<SourceResult<T>> {
    this.bodies.push(body);

    if (path === DOF_PUBLICATIONS_BY_DATE_PATH) {
      const date = (body as { date: string }).date;
      return sourceOk('mx.dof', {
        date,
        published: true,
        total: 1,
        publications: [{ id: `${date}-0`, title: 'ACUERDO sobre PyME', agency: 'SE', branch: 'EJECUTIVO' }],
      }) as SourceResult<T>;
    }
    if (path === CNBV_REGULATIONS_PATH) {
      return sourceOk('mx.cnbv', {
        regulations: [],
        pagination: { total: 0, page_size: 50, total_pages: 0, page: 1 },
      }) as SourceResult<T>;
    }
    throw new Error('unexpected path');
  }
}

describe('regulatory radar invariants', () => {
  it('never sends anything about a person or a business to the provider', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 30 }), async (scanDays) => {
        const croma = new Croma();
        const service = new RegulatoryRadarService(
          new DofClient(croma),
          new CnbvClient(croma),
          new MemoryCacheStore(),
          {
            keywords: ['PyME'],
            scanDays,
            cacheTtlMs: 0,
            maxAlerts: 50,
            maxRulebookPages: 1,
            now: () => new Date('2026-08-13T12:00:00.000Z'),
          },
        );

        await service.scan();

        for (const body of croma.bodies) {
          const keys = Object.keys(body as Record<string, unknown>);
          for (const key of keys) {
            expect(['date', 'query', 'page']).toContain(key);
          }
        }
      }),
      { numRuns: 30 },
    );
  });

  it('spends exactly one request per scanned date plus one for the rulebook', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 30 }), async (scanDays) => {
        const croma = new Croma();
        const service = new RegulatoryRadarService(
          new DofClient(croma),
          new CnbvClient(croma),
          new MemoryCacheStore(),
          {
            keywords: ['PyME'],
            scanDays,
            cacheTtlMs: 0,
            maxAlerts: 50,
            maxRulebookPages: 1,
            now: () => new Date('2026-08-13T12:00:00.000Z'),
          },
        );

        const result = await service.scan();

        expect(croma.bodies).toHaveLength(scanDays + 1);
        expect(result.data?.scanned_dates).toHaveLength(scanDays);
      }),
      { numRuns: 30 },
    );
  });

  it('never emits an alert whose title does not match a configured keyword', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom('PyME', 'acuerdo', 'zzz-nope'), async (keyword) => {
        const croma = new Croma();
        const service = new RegulatoryRadarService(
          new DofClient(croma),
          new CnbvClient(croma),
          new MemoryCacheStore(),
          {
            keywords: [keyword],
            scanDays: 1,
            cacheTtlMs: 0,
            maxAlerts: 50,
            maxRulebookPages: 1,
            now: () => new Date('2026-08-13T12:00:00.000Z'),
          },
        );

        const result = await service.scan();

        for (const alert of result.data?.alerts ?? []) {
          expect(alert.title.toLowerCase()).toContain(keyword.toLowerCase());
        }
      }),
    );
  });
});
