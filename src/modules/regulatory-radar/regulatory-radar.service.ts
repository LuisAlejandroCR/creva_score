// regulatory-radar.service: collects recent regulatory publications relevant to small businesses.
// Shared across all users and free of personal data, unlike the directory check.

import { CacheStore } from '../../common/cache/memory-cache';
import { SourceResult, sourceOk, sourceUnavailable } from '../../common/types/source-result.types';
import { CnbvClient } from './providers/cnbv.provider';
import { CNBV_SOURCE } from './providers/cnbv.types';
import { DofClient } from './providers/dof.provider';
import { DOF_SOURCE } from './providers/dof.types';

export const RADAR_SOURCE = 'mx.regulatory-radar';

export type RegulatoryAlertKind = 'publication' | 'standing_rule';

export interface RegulatoryAlert {
  source: string;
  kind: RegulatoryAlertKind;
  external_id: string;
  title: string;
  published_at: string | null;
  agency: string | null;
  url: string | null;
}

export interface RegulatoryRadar {
  alerts: RegulatoryAlert[];
  scanned_dates: string[];
  failed_dates: string[];
  sources_available: string[];
  sources_unavailable: string[];
}

export interface RegulatoryRadarOptions {
  keywords: string[];
  scanDays: number;
  cacheTtlMs: number;
  maxAlerts: number;
  maxRulebookPages: number;
  now?: () => Date;
}

export class RegulatoryRadarService {
  constructor(
    private readonly dof: DofClient,
    private readonly cnbv: CnbvClient,
    private readonly cache: CacheStore,
    private readonly options: RegulatoryRadarOptions,
  ) {}

  async scan(): Promise<SourceResult<RegulatoryRadar>> {
    const dates = this.recentDates();
    const cacheKey = `radar:v1:${dates[0] ?? 'none'}|${dates.length}|${normalizeKeywords(this.options.keywords).join(',')}`;

    const cached = await this.cache.get<RegulatoryRadar>(cacheKey);
    if (cached) return cached;

    const available: string[] = [];
    const unavailable: string[] = [];
    const failedDates: string[] = [];
    const alerts: RegulatoryAlert[] = [];

    for (const alert of await this.collectFromDof(dates, available, unavailable, failedDates)) alerts.push(alert);
    for (const alert of await this.collectFromCnbv(available, unavailable)) alerts.push(alert);

    if (available.length === 0) {
      return sourceUnavailable<RegulatoryRadar>(RADAR_SOURCE, 'all_sources_unavailable', new Date().toISOString());
    }

    const radar: RegulatoryRadar = {
      alerts: dedupe(alerts).sort(byKindThenDate).slice(0, this.options.maxAlerts),
      scanned_dates: dates,
      failed_dates: failedDates,
      sources_available: available,
      sources_unavailable: unavailable,
    };

    const result = sourceOk<RegulatoryRadar>(RADAR_SOURCE, radar);
    await this.cache.set(cacheKey, result, this.options.cacheTtlMs);
    return result;
  }

  private async collectFromDof(
    dates: string[],
    available: string[],
    unavailable: string[],
    failedDates: string[],
  ): Promise<RegulatoryAlert[]> {
    const keywords = normalizeKeywords(this.options.keywords);
    const alerts: RegulatoryAlert[] = [];
    let anySucceeded = false;

    for (const date of dates) {
      const result = await this.dof.getPublicationsByDate(date);
      if (!result.available || result.data === null) {
        failedDates.push(date);
        continue;
      }

      anySucceeded = true;
      if (!result.data.published) continue;

      for (const publication of result.data.publications) {
        if (publication.title === null || !matchesAny(publication.title, keywords)) continue;
        alerts.push({
          source: DOF_SOURCE,
          kind: 'publication',
          external_id: publication.id,
          title: publication.title,
          published_at: date,
          agency: publication.agency,
          url: null,
        });
      }
    }

    (anySucceeded ? available : unavailable).push(DOF_SOURCE);
    return alerts;
  }

  private async collectFromCnbv(available: string[], unavailable: string[]): Promise<RegulatoryAlert[]> {
    const result = await this.cnbv.getAllRegulations(this.options.maxRulebookPages);
    if (!result.available || result.data === null) {
      unavailable.push(CNBV_SOURCE);
      return [];
    }

    available.push(CNBV_SOURCE);
    const keywords = normalizeKeywords(this.options.keywords);

    return result.data.regulations
      .filter((regulation) => matchesAny(regulation.name, keywords))
      .map((regulation) => ({
        source: CNBV_SOURCE,
        kind: 'standing_rule' as const,
        external_id: regulation.regulation_id ?? regulation.name,
        title: regulation.name,
        published_at: regulation.dof_date,
        agency: regulation.type,
        url: regulation.pdf_url,
      }));
  }

  private recentDates(): string[] {
    const now = this.options.now ? this.options.now() : new Date();
    const dates: string[] = [];

    for (let offset = 0; offset < this.options.scanDays; offset++) {
      const day = new Date(now.getTime());
      day.setUTCDate(day.getUTCDate() - offset);
      dates.push(toIsoDate(day));
    }
    return dates;
  }

}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map((keyword) => normalize(keyword.trim())).filter((keyword) => keyword.length > 0);
}

// Word-boundary matching: a substring match lets a short keyword such as "sat" fire on
// "satelite" or "resultados".
function matchesAny(text: string, normalizedKeywords: string[]): boolean {
  if (normalizedKeywords.length === 0) return false;
  const haystack = normalize(text);

  return normalizedKeywords.some((keyword) => {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(keyword, from);
      if (at === -1) return false;
      const before = at === 0 ? '' : haystack[at - 1];
      const after = haystack[at + keyword.length] ?? '';
      if (!isWordChar(before) && !isWordChar(after)) return true;
      from = at + 1;
    }
  });
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[a-z0-9]/.test(char);
}

function dedupe(alerts: RegulatoryAlert[]): RegulatoryAlert[] {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = `${alert.source}|${alert.external_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function byKindThenDate(a: RegulatoryAlert, b: RegulatoryAlert): number {
  if (a.kind !== b.kind) return a.kind === 'publication' ? -1 : 1;
  if (a.published_at === b.published_at) return 0;
  if (a.published_at === null) return 1;
  if (b.published_at === null) return -1;
  return a.published_at < b.published_at ? 1 : -1;
}
