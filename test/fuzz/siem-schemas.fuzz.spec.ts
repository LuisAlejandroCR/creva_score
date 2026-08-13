import fc from 'fast-check';
import { CallOptions, CromaCallable } from '../../src/infra/croma-client';
import { SourceResult, sourceOk } from '../../src/infra/types';
import { SiemClient } from '../../src/siem/siem.client';

class EchoCroma implements CromaCallable {
  constructor(private readonly payload: unknown) {}

  async call<T>(_path: string, _body: unknown, _options: CallOptions): Promise<SourceResult<T>> {
    return sourceOk('mx.siem', this.payload) as SourceResult<T>;
  }
}

describe('SIEM schema fuzz', () => {
  it('degrades instead of throwing on any arbitrary payload', async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (payload) => {
        const client = new SiemClient(new EchoCroma(payload));

        const search = await client.searchEstablishments({ name: 'ACME' });
        const detail = await client.getEstablishment('1');

        for (const result of [search, detail]) {
          expect(typeof result.available).toBe('boolean');
          if (!result.available) expect(result.data).toBeNull();
        }
      }),
      { numRuns: 300 },
    );
  });

  it('rejects out-of-range search inputs without spending a request', async () => {
    let calls = 0;
    class CountingCroma implements CromaCallable {
      async call<T>(): Promise<SourceResult<T>> {
        calls++;
        return sourceOk('mx.siem', {
          query: 'q',
          establishments: [],
          pagination: { total: 0, page_size: 10, total_pages: 0, page: 1 },
        }) as SourceResult<T>;
      }
    }

    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 1 }), async (tooShort) => {
        calls = 0;
        const result = await new SiemClient(new CountingCroma()).searchEstablishments({ name: tooShort });

        expect(result.available).toBe(false);
        expect(result.error).toBe('invalid_business_name');
        expect(calls).toBe(0);
      }),
    );
  });

  it('never lets an out-of-range filter reach the request body', async () => {
    const bodies: unknown[] = [];
    class RecordingCroma implements CromaCallable {
      async call<T>(_path: string, body: unknown): Promise<SourceResult<T>> {
        bodies.push(body);
        return sourceOk('mx.siem', {
          query: 'q',
          establishments: [],
          pagination: { total: 0, page_size: 10, total_pages: 0, page: 1 },
        }) as SourceResult<T>;
      }
    }

    await fc.assert(
      fc.asyncProperty(fc.integer(), fc.integer(), fc.integer(), async (stateCode, activityCode, page) => {
        bodies.length = 0;
        await new SiemClient(new RecordingCroma()).searchEstablishments({
          name: 'ACME',
          stateCode,
          activityCode,
          page,
        });

        const body = bodies[0] as Record<string, number | string>;
        if ('state_code' in body) expect(body.state_code).toBeGreaterThanOrEqual(0);
        if ('state_code' in body) expect(body.state_code).toBeLessThanOrEqual(32);
        if ('activity_code' in body) expect(body.activity_code).toBeLessThanOrEqual(999999);
        if ('page' in body) expect(body.page).toBeGreaterThanOrEqual(1);
        if ('page' in body) expect(body.page).toBeLessThanOrEqual(1000);
      }),
      { numRuns: 200 },
    );
  });
});
