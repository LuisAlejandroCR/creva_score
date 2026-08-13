// reference-rates.service: headline and secondary reference rates. See D-06.

import { CacheStore } from '../infra/cache';
import { SourceResult, sourceOk } from '../infra/types';
import { SieClient, SieObservation } from '../banxico/sie.client';

export const REFERENCE_RATES_SOURCE = 'mx.banxico.sie';

export type RatePlacement = 'headline' | 'secondary';

export interface ReferenceRate {
  series_id: string;
  label: string;
  placement: RatePlacement;
  unit: 'percent' | 'mxn';
  value: number | null;
  observed_on: string | null;
}

export interface ReferenceRates {
  rates: ReferenceRate[];
  missing_series: string[];
}

export interface RateDefinition {
  seriesId: string;
  label: string;
  placement: RatePlacement;
  unit: 'percent' | 'mxn';
}

export interface ReferenceRatesOptions {
  definitions: RateDefinition[];
  cacheTtlMs: number;
}

export const DEFAULT_RATE_DEFINITIONS: RateDefinition[] = [
  { seriesId: 'SF61745', label: 'Tasa objetivo de Banxico', placement: 'headline', unit: 'percent' },
  { seriesId: 'SF60648', label: 'TIIE a 28 días', placement: 'headline', unit: 'percent' },
  { seriesId: 'SF60633', label: 'Cetes a 28 días', placement: 'secondary', unit: 'percent' },
  { seriesId: 'SP68257', label: 'Valor de la UDI', placement: 'secondary', unit: 'mxn' },
];

export class ReferenceRatesService {
  constructor(
    private readonly sie: SieClient,
    private readonly cache: CacheStore,
    private readonly options: ReferenceRatesOptions,
  ) {}

  async getRates(): Promise<SourceResult<ReferenceRates>> {
    const definitions = this.options.definitions;
    const cacheKey = `rates:v1:${definitions.map((d) => d.seriesId).join(',')}`;

    const cached = await this.cache.get<ReferenceRates>(cacheKey);
    if (cached) return cached;

    const fetched = await this.sie.getLatest(definitions.map((d) => d.seriesId));
    if (!fetched.available || fetched.data === null) {
      return { ...fetched, data: null };
    }

    const observations = new Map<string, SieObservation>(
      fetched.data.map((observation) => [observation.series_id, observation]),
    );

    const rates: ReferenceRate[] = [];
    const missing: string[] = [];

    for (const definition of definitions) {
      const observation = observations.get(definition.seriesId);
      if (!observation || observation.value === null) {
        missing.push(definition.seriesId);
        continue;
      }

      rates.push({
        series_id: definition.seriesId,
        label: definition.label,
        placement: definition.placement,
        unit: definition.unit,
        value: observation.value,
        observed_on: observation.observed_on,
      });
    }

    const result = sourceOk<ReferenceRates>(
      REFERENCE_RATES_SOURCE,
      { rates: rates.sort(byPlacement), missing_series: missing },
      fetched.checked_at ?? undefined,
    );

    await this.cache.set(cacheKey, result, this.options.cacheTtlMs);
    return result;
  }
}

export function headlineRates(rates: ReferenceRates): ReferenceRate[] {
  return rates.rates.filter((rate) => rate.placement === 'headline');
}

export function secondaryRates(rates: ReferenceRates): ReferenceRate[] {
  return rates.rates.filter((rate) => rate.placement === 'secondary');
}

function byPlacement(a: ReferenceRate, b: ReferenceRate): number {
  if (a.placement === b.placement) return 0;
  return a.placement === 'headline' ? -1 : 1;
}
