// sie.client: Banxico SIE reference rates. Separate host and auth from the government-data provider.

import { z } from 'zod';
import { Logger, noopLogger } from '../infra/logger';
import { SourceResult, sourceOk, sourceUnavailable } from '../infra/types';

export const SIE_SOURCE = 'mx.banxico.sie';

const NOT_AVAILABLE = new Set(['N/E', 'N/A', '']);

export const sieSeriesSchema = z.object({
  idSerie: z.string(),
  titulo: z.string(),
  datos: z
    .array(z.object({ fecha: z.string(), dato: z.string() }))
    .nullish()
    .transform((value) => value ?? []),
});

export const sieResponseSchema = z.object({
  bmx: z.object({ series: z.array(sieSeriesSchema) }),
});

export interface SieObservation {
  series_id: string;
  title: string;
  value: number | null;
  observed_on: string | null;
}

export interface SieClientOptions {
  token?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof globalThis.fetch;
  logger?: Logger;
}

export class SieClient {
  private readonly token: string | undefined;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly logger: Logger;

  constructor(options: SieClientOptions = {}) {
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? 'https://www.banxico.org.mx/SieAPIRest/service/v1').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.logger = options.logger ?? noopLogger;
  }

  async getLatest(seriesIds: string[]): Promise<SourceResult<SieObservation[]>> {
    const ids = seriesIds.map((id) => id.trim()).filter((id) => id.length > 0);
    if (ids.length === 0) return sourceUnavailable<SieObservation[]>(SIE_SOURCE, 'no_series_requested');
    if (!this.token) return sourceUnavailable<SieObservation[]>(SIE_SOURCE, 'missing_token');

    const startedAt = Date.now();
    let result: SourceResult<SieObservation[]>;

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/series/${ids.join(',')}/datos/oportuno`, {
        method: 'GET',
        headers: { 'Bmx-Token': this.token, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        result = sourceUnavailable<SieObservation[]>(SIE_SOURCE, `http_${response.status}`, new Date().toISOString());
      } else {
        const parsed = sieResponseSchema.safeParse(await response.json());
        result = parsed.success
          ? sourceOk<SieObservation[]>(SIE_SOURCE, parsed.data.bmx.series.map(toObservation))
          : sourceUnavailable<SieObservation[]>(SIE_SOURCE, 'invalid_response_shape', new Date().toISOString());
      }
    } catch (error) {
      const reason = error instanceof Error ? (error.name === 'TimeoutError' ? 'timeout' : error.message) : 'unknown_error';
      result = sourceUnavailable<SieObservation[]>(SIE_SOURCE, `request_failed:${reason}`, new Date().toISOString());
    }

    this.logger.log(result.available ? 'info' : 'warn', 'sie.call', {
      source: SIE_SOURCE,
      series: ids.length,
      available: result.available,
      error: result.error,
      elapsed_ms: Date.now() - startedAt,
    });
    return result;
  }
}

function toObservation(series: z.infer<typeof sieSeriesSchema>): SieObservation {
  const latest = series.datos[0];
  return {
    series_id: series.idSerie,
    title: series.titulo,
    value: latest ? parseValue(latest.dato) : null,
    observed_on: latest ? toIsoDate(latest.fecha) : null,
  };
}

function parseValue(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  if (NOT_AVAILABLE.has(cleaned.toUpperCase())) return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

// SIE returns dd/mm/yyyy. A calendar date carries no time, so it is not converted to a timestamp.
function toIsoDate(raw: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}
