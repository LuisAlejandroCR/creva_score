import { MemoryCacheStore } from '../../src/infra/cache';
import { CallOptions, CromaCallable } from '../../src/infra/croma-client';
import { SourceResult, sourceOk, sourceUnavailable } from '../../src/infra/types';
import { SiemClient } from '../../src/siem/siem.client';
import { SIEM_DETAIL_PATH } from '../../src/siem/siem.schemas';
import { BusinessVerificationService, getVerificationStatus } from '../../src/business-verification/business-verification.service';

class FakeCroma implements CromaCallable {
  readonly calls: Array<{ path: string; body: unknown }> = [];

  constructor(private readonly responses: Array<SourceResult<unknown>>) {}

  async call<T>(path: string, body: unknown, _options: CallOptions): Promise<SourceResult<T>> {
    this.calls.push({ path, body });
    const next = this.responses.shift();
    if (!next) throw new Error('no fake response left');
    return next as SourceResult<T>;
  }
}

function searchResult(
  establishments: Array<Record<string, unknown>>,
  total = establishments.length,
): SourceResult<unknown> {
  return sourceOk('mx.siem', {
    query: 'ACME',
    establishments,
    pagination: { total, page_size: 10, total_pages: Math.ceil(total / 10), page: 1 },
  });
}

const candidate = {
  establishment_id: '3417757',
  commercial_name: 'ACME SA',
  chamber: 'CANACO',
  state: 'Jalisco',
  state_code: 14,
};

const options = { cacheTtlMs: 60_000, maxDetailLookups: 1, rfcField: 'establishment.rfc' };

function build(responses: Array<SourceResult<unknown>>, overrides: Partial<typeof options> = {}) {
  const croma = new FakeCroma(responses);
  const cache = new MemoryCacheStore();
  const service = new BusinessVerificationService(new SiemClient(croma), cache, { ...options, ...overrides });
  return { croma, cache, service };
}

describe('BusinessVerificationService', () => {
  it('reports a name-level match when no RFC is supplied', async () => {
    const { croma, service } = build([searchResult([candidate])]);

    const result = await service.verify({ businessName: 'ACME' });

    expect(result.available).toBe(true);
    expect(result.data).toMatchObject({
      matched: true,
      confirmed_by_rfc: false,
      establishment_id: '3417757',
      candidates_found: 1,
    });
    expect(croma.calls).toHaveLength(1);
    expect(getVerificationStatus(result)).toBe('verified');
  });

  it('treats an empty directory result as an answer, not a failure', async () => {
    const { service } = build([searchResult([])]);

    const result = await service.verify({ businessName: 'NEGOCIO NUEVO' });

    expect(result.available).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.data).toMatchObject({ matched: false, candidates_found: 0 });
    expect(getVerificationStatus(result)).toBe('not_listed');
  });

  it('confirms the match when the detail RFC equals the profile RFC', async () => {
    const { croma, service } = build([
      searchResult([candidate]),
      sourceOk('mx.siem', { found: true, establishment_id: '3417757', establishment: { rfc: 'acm-010101-AAA' } }),
    ]);

    const result = await service.verify({ businessName: 'ACME', rfc: 'ACM010101AAA' });

    expect(result.data?.confirmed_by_rfc).toBe(true);
    expect(croma.calls[1]?.path).toBe(SIEM_DETAIL_PATH);
  });

  it('stays an unconfirmed match when the RFC does not line up', async () => {
    const { service } = build([
      searchResult([candidate]),
      sourceOk('mx.siem', { found: true, establishment_id: '3417757', establishment: { rfc: 'OTR990101ZZZ' } }),
    ]);

    const result = await service.verify({ businessName: 'ACME', rfc: 'ACM010101AAA' });

    expect(result.data).toMatchObject({ matched: true, confirmed_by_rfc: false });
  });

  it('stays an unconfirmed match when the detail response has no RFC field', async () => {
    const { service } = build([
      searchResult([candidate]),
      sourceOk('mx.siem', { found: true, establishment_id: '3417757' }),
    ]);

    const result = await service.verify({ businessName: 'ACME', rfc: 'ACM010101AAA' });

    expect(result.data).toMatchObject({ matched: true, confirmed_by_rfc: false });
  });

  it('never spends more detail lookups than configured', async () => {
    const second = { ...candidate, establishment_id: '999' };
    const { croma, service } = build(
      [
        searchResult([candidate, second]),
        sourceOk('mx.siem', { found: true, establishment_id: '3417757', establishment: { rfc: 'NOPE000000XXX' } }),
      ],
      { maxDetailLookups: 1 },
    );

    await service.verify({ businessName: 'ACME', rfc: 'ACM010101AAA' });

    expect(croma.calls).toHaveLength(2);
  });

  it('skips the detail call entirely when lookups are disabled', async () => {
    const { croma, service } = build([searchResult([candidate])], { maxDetailLookups: 0 });

    const result = await service.verify({ businessName: 'ACME', rfc: 'ACM010101AAA' });

    expect(croma.calls).toHaveLength(1);
    expect(result.data).toMatchObject({ matched: true, confirmed_by_rfc: false });
  });

  it('reuses the cached answer instead of spending another request', async () => {
    const { croma, service } = build([searchResult([candidate])]);

    await service.verify({ businessName: 'ACME' });
    const second = await service.verify({ businessName: '  acme  ' });

    expect(croma.calls).toHaveLength(1);
    expect(second.data?.matched).toBe(true);
  });

  it('does not cache a provider failure', async () => {
    const { croma, service } = build([sourceUnavailable('mx.siem', 'http_500'), searchResult([candidate])]);

    const first = await service.verify({ businessName: 'ACME' });
    const second = await service.verify({ businessName: 'ACME' });

    expect(first.available).toBe(false);
    expect(getVerificationStatus(first)).toBe('unavailable');
    expect(second.available).toBe(true);
    expect(croma.calls).toHaveLength(2);
  });

  it('does not confirm from an RFC sitting outside the configured path', async () => {
    const { service } = build([
      searchResult([candidate]),
      sourceOk('mx.siem', { found: true, establishment_id: '3417757', rfc: 'ACM010101AAA' }),
    ]);

    const result = await service.verify({ businessName: 'ACME', rfc: 'ACM010101AAA' });

    expect(result.data?.confirmed_by_rfc).toBe(false);
  });

  it('spends its detail lookup on the closest name, not on the first row returned', async () => {
    const looseMatch = { ...candidate, establishment_id: '111', commercial_name: 'ACME SA DE CV SUCURSAL NORTE' };
    const exactMatch = { ...candidate, establishment_id: '222', commercial_name: 'Acmé SA' };
    const { croma, service } = build([
      searchResult([looseMatch, exactMatch]),
      sourceOk('mx.siem', { found: true, establishment_id: '222', establishment: { rfc: 'ACM010101AAA' } }),
    ]);

    const result = await service.verify({ businessName: 'ACME SA', rfc: 'ACM010101AAA' });

    expect(croma.calls[1]?.body).toEqual({ establishment_id: '222' });
    expect(result.data).toMatchObject({ establishment_id: '222', confirmed_by_rfc: true });
  });

  it('issues no badge for a generic word that returns a crowd of businesses', async () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      ...candidate,
      establishment_id: `id-${index}`,
      commercial_name: `ABARROTES ${index === 0 ? 'ERENDIRA' : index}`,
    }));
    const { service } = build([searchResult(rows, 2171)]);

    const result = await service.verify({ businessName: 'ABARROTES', stateCode: 8 });

    expect(result.data).toMatchObject({
      matched: false,
      establishment_id: null,
      commercial_name: null,
      candidates_found: 2171,
    });
    expect(getVerificationStatus(result)).toBe('ambiguous');
  });

  it('reports how many the directory really holds, not how many fit on one page', async () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({ ...candidate, establishment_id: `id-${index}` }));
    const { service } = build([searchResult(rows, 2171)]);

    const result = await service.verify({ businessName: 'ACME' });

    expect(result.data?.candidates_found).toBe(2171);
  });

  it('issues no badge for a candidate whose name has no relation to the query', async () => {
    const unrelated = { ...candidate, commercial_name: 'FERRETERIA EL TORNILLO' };
    const { service } = build([searchResult([unrelated])]);

    const result = await service.verify({ businessName: 'ACME' });

    expect(result.data).toMatchObject({ matched: false, establishment_id: null });
  });

  it('issues a badge on an exact name even when the directory holds many rows', async () => {
    const rows = [
      { ...candidate, establishment_id: '111', commercial_name: 'ACME SA DE CV SUCURSAL NORTE' },
      { ...candidate, establishment_id: '222', commercial_name: 'Acmé SA' },
    ];
    const { service } = build([searchResult(rows, 640)]);

    const result = await service.verify({ businessName: 'ACME SA' });

    expect(result.data).toMatchObject({ matched: true, establishment_id: '222', confirmed_by_rfc: false });
    expect(getVerificationStatus(result)).toBe('verified');
  });

  it('lets a confirmed RFC carry a match the name alone could not identify', async () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      ...candidate,
      establishment_id: `id-${index}`,
      commercial_name: `ABARROTES ${index}`,
    }));
    const { service } = build([
      searchResult(rows, 2171),
      sourceOk('mx.siem', { found: true, establishment_id: 'id-0', establishment: { rfc: 'ACM010101AAA' } }),
    ]);

    const result = await service.verify({ businessName: 'ABARROTES', rfc: 'ACM010101AAA' });

    expect(result.data).toMatchObject({ matched: true, confirmed_by_rfc: true, establishment_id: 'id-0' });
  });

  it('keeps the RFC out of the cache key', async () => {
    const { cache, service } = build([
      searchResult([candidate]),
      sourceOk('mx.siem', { found: true, establishment_id: '3417757', establishment: { rfc: 'ACM010101AAA' } }),
    ]);
    await service.verify({ businessName: 'ACME', rfc: 'ACM010101AAA' });

    const keys = Array.from((cache as unknown as { entries: Map<string, unknown> }).entries.keys());

    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain('ACM010101AAA');
  });

  it('does not answer from a verdict cached under the previous matching rule', async () => {
    const { cache, croma, service } = build([searchResult([candidate])]);
    const staleKey = 'siem:v1:ACME|any|none';
    await cache.set(staleKey, sourceOk('mx.siem', { matched: true, candidates_found: 9999 }), 60_000);

    const result = await service.verify({ businessName: 'ACME' });

    expect(result.data?.candidates_found).toBe(1);
    expect(croma.calls).toHaveLength(1);
  });
});
