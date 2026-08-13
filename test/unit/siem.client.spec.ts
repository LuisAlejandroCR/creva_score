import { CallOptions, CromaCallable } from '../../src/infra/croma-client';
import { SourceResult, sourceOk, sourceUnavailable } from '../../src/infra/types';
import { SiemClient } from '../../src/siem/siem.client';
import { SIEM_DETAIL_PATH, SIEM_SEARCH_PATH } from '../../src/siem/siem.schemas';

class FakeCroma implements CromaCallable {
  readonly calls: Array<{ path: string; body: unknown; options: CallOptions }> = [];

  constructor(private readonly responses: Array<SourceResult<unknown>>) {}

  async call<T>(path: string, body: unknown, options: CallOptions): Promise<SourceResult<T>> {
    this.calls.push({ path, body, options });
    const next = this.responses.shift();
    if (!next) throw new Error('no fake response left');
    return next as SourceResult<T>;
  }
}

const searchPayload = {
  query: 'ACME',
  establishments: [
    { establishment_id: '3417757', commercial_name: 'ACME SA', chamber: 'CANACO', state: 'Jalisco', state_code: 14 },
  ],
  pagination: { total: 1, page_size: 20, total_pages: 1, page: 1 },
};

describe('SiemClient', () => {
  it('hits the confirmed search path with the trimmed name', async () => {
    const croma = new FakeCroma([sourceOk('mx.siem', searchPayload)]);
    const result = await new SiemClient(croma).searchEstablishments({ name: '  ACME  ' });

    expect(croma.calls[0]?.path).toBe(SIEM_SEARCH_PATH);
    expect(croma.calls[0]?.body).toEqual({ name: 'ACME' });
    expect(result.data?.establishments[0]?.establishment_id).toBe('3417757');
  });

  it('includes optional filters only when they are within the documented range', async () => {
    const croma = new FakeCroma([sourceOk('mx.siem', searchPayload), sourceOk('mx.siem', searchPayload)]);
    const client = new SiemClient(croma);

    await client.searchEstablishments({ name: 'ACME', stateCode: 14, page: 2 });
    await client.searchEstablishments({ name: 'ACME', stateCode: 99, page: 0 });

    expect(croma.calls[0]?.body).toEqual({ name: 'ACME', state_code: 14, page: 2 });
    expect(croma.calls[1]?.body).toEqual({ name: 'ACME' });
  });

  it('rejects a name shorter than the documented minimum without spending a request', async () => {
    const croma = new FakeCroma([]);
    const result = await new SiemClient(croma).searchEstablishments({ name: 'A' });

    expect(result.available).toBe(false);
    expect(result.error).toBe('invalid_business_name');
    expect(croma.calls).toHaveLength(0);
  });

  it('normalises missing optional fields to null', async () => {
    const croma = new FakeCroma([
      sourceOk('mx.siem', {
        query: 'ACME',
        establishments: [{ establishment_id: '1' }],
        pagination: { total: 1, page_size: 20, total_pages: 1, page: 1 },
      }),
    ]);

    const result = await new SiemClient(croma).searchEstablishments({ name: 'ACME' });

    expect(result.data?.establishments[0]).toEqual({
      establishment_id: '1',
      commercial_name: null,
      chamber: null,
      state: null,
      state_code: null,
    });
  });

  it('degrades when the response shape is not the documented one', async () => {
    const croma = new FakeCroma([sourceOk('mx.siem', { query: 'ACME', establishments: 'nope' })]);
    const result = await new SiemClient(croma).searchEstablishments({ name: 'ACME' });

    expect(result.available).toBe(false);
    expect(result.error).toBe('invalid_response_shape');
  });

  it('passes unconfirmed detail fields through untouched', async () => {
    const croma = new FakeCroma([
      sourceOk('mx.siem', {
        found: true,
        establishment_id: '3417757',
        establishment: { rfc: 'ACM010101AAA', legal_name: 'ACME SA DE CV', status: 'ACTIVO' },
      }),
    ]);

    const result = await new SiemClient(croma).getEstablishment('3417757');

    expect(croma.calls[0]?.path).toBe(SIEM_DETAIL_PATH);
    expect(croma.calls[0]?.body).toEqual({ establishment_id: '3417757' });
    expect(result.data?.establishment).toMatchObject({ rfc: 'ACM010101AAA', status: 'ACTIVO' });
  });

  it('forwards a degraded call without inventing data', async () => {
    const croma = new FakeCroma([sourceUnavailable('mx.siem', 'http_500')]);
    const result = await new SiemClient(croma).getEstablishment('1');

    expect(result.available).toBe(false);
    expect(result.data).toBeNull();
  });
});
