import { MemoryCacheStore } from '../../src/infra/cache';
import { SieClient } from '../../src/banxico/sie.client';
import {
  DEFAULT_RATE_DEFINITIONS,
  ReferenceRatesService,
  headlineRates,
  secondaryRates,
} from '../../src/reference-rates/reference-rates.service';

function response(series: Array<{ id: string; titulo: string; fecha?: string; dato?: string }>): Response {
  return new Response(
    JSON.stringify({
      bmx: {
        series: series.map((s) => ({
          idSerie: s.id,
          titulo: s.titulo,
          datos: s.fecha === undefined ? [] : [{ fecha: s.fecha, dato: s.dato ?? '0' }],
        })),
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function build(fetchImpl: jest.Mock, ttlMs = 60_000) {
  const cache = new MemoryCacheStore();
  const service = new ReferenceRatesService(
    new SieClient({ token: 't', fetchImpl: fetchImpl as unknown as typeof fetch }),
    cache,
    { definitions: DEFAULT_RATE_DEFINITIONS, cacheTtlMs: ttlMs },
  );
  return { service, cache };
}

const fullPayload = [
  { id: 'SF61745', titulo: 'Tasa objetivo', fecha: '13/08/2026', dato: '6.5000' },
  { id: 'SF60648', titulo: 'TIIE 28', fecha: '13/08/2026', dato: '6.7458' },
  { id: 'SF60633', titulo: 'Cetes 28', fecha: '11/08/2026', dato: '6.4000' },
  { id: 'SP68257', titulo: 'UDIS', fecha: '25/08/2026', dato: '8.807141' },
];

describe('ReferenceRatesService', () => {
  it('converts the gazette date format and parses the value', async () => {
    const { service } = build(jest.fn().mockResolvedValue(response(fullPayload)));

    const result = await service.getRates();
    const tiie = result.data?.rates.find((rate) => rate.series_id === 'SF60648');

    expect(tiie).toMatchObject({ value: 6.7458, observed_on: '2026-08-13', unit: 'percent' });
  });

  it('keeps each rate on its own date, because they are not published together', async () => {
    const { service } = build(jest.fn().mockResolvedValue(response(fullPayload)));

    const result = await service.getRates();
    const dates = Object.fromEntries((result.data?.rates ?? []).map((r) => [r.series_id, r.observed_on]));

    expect(dates.SF60648).toBe('2026-08-13');
    expect(dates.SF60633).toBe('2026-08-11');
    expect(dates.SP68257).toBe('2026-08-25');
  });

  it('puts the two policy rates up front and the rest behind them', async () => {
    const { service } = build(jest.fn().mockResolvedValue(response(fullPayload)));

    const result = await service.getRates();
    const rates = result.data!;

    expect(headlineRates(rates).map((r) => r.series_id)).toEqual(['SF61745', 'SF60648']);
    expect(secondaryRates(rates).map((r) => r.series_id)).toEqual(['SF60633', 'SP68257']);
  });

  it('reports a series it could not read instead of showing it as zero', async () => {
    const { service } = build(
      jest.fn().mockResolvedValue(
        response([
          { id: 'SF61745', titulo: 'Tasa objetivo', fecha: '13/08/2026', dato: '6.5000' },
          { id: 'SF60648', titulo: 'TIIE 28', fecha: '13/08/2026', dato: 'N/E' },
          { id: 'SF60633', titulo: 'Cetes 28' },
          { id: 'SP68257', titulo: 'UDIS', fecha: '25/08/2026', dato: '8.807141' },
        ]),
      ),
    );

    const result = await service.getRates();

    expect(result.data?.missing_series).toEqual(['SF60648', 'SF60633']);
    expect(result.data?.rates.map((r) => r.series_id)).toEqual(['SF61745', 'SP68257']);
  });

  it('degrades without a token instead of inventing a rate', async () => {
    const cache = new MemoryCacheStore();
    const service = new ReferenceRatesService(new SieClient({}), cache, {
      definitions: DEFAULT_RATE_DEFINITIONS,
      cacheTtlMs: 0,
    });

    const result = await service.getRates();

    expect(result.available).toBe(false);
    expect(result.error).toBe('missing_token');
    expect(result.data).toBeNull();
  });

  it('serves a second call from cache', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(fullPayload));
    const { service } = build(fetchImpl);

    await service.getRates();
    await service.getRates();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
