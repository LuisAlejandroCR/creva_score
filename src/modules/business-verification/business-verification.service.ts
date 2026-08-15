// business-verification.service: resolves a business against the government directory.

import { createHash } from 'node:crypto';
import { CacheStore } from '../../common/cache/memory-cache';
import { SourceResult, sourceOk } from '../../common/types/source-result.types';
import { SiemClient } from './providers/siem.provider';
import { normalizeRfc } from './rfc';
import { EstablishmentSummary, SIEM_SOURCE } from './providers/siem.types';

export interface BusinessVerificationInput {
  businessName: string;
  stateCode?: number;
  rfc?: string;
}

export interface BusinessVerification {
  matched: boolean;
  confirmed_by_rfc: boolean;
  establishment_id: string | null;
  commercial_name: string | null;
  state: string | null;
  candidates_found: number;
}

export interface BusinessVerificationOptions {
  cacheTtlMs: number;
  maxDetailLookups: number;
  rfcField: string;
}

export type VerificationStatus = 'verified' | 'ambiguous' | 'not_listed' | 'unavailable';

const RANK_EXACT = 0;
const RANK_CONTAINS = 2;

export class BusinessVerificationService {
  constructor(
    private readonly siem: SiemClient,
    private readonly cache: CacheStore,
    private readonly options: BusinessVerificationOptions,
  ) {}

  async verify(input: BusinessVerificationInput): Promise<SourceResult<BusinessVerification>> {
    const cacheKey = buildCacheKey(input);
    const cached = await this.cache.get<BusinessVerification>(cacheKey);
    if (cached) return cached;

    const search = await this.siem.searchEstablishments({
      name: input.businessName,
      stateCode: input.stateCode,
    });

    if (!search.available || search.data === null) {
      return { ...search, data: null };
    }

    const result = await this.resolveMatch(
      search.data.establishments,
      search.data.pagination.total,
      input.businessName,
      input.rfc,
    );
    const verified = sourceOk<BusinessVerification>(SIEM_SOURCE, result, search.checked_at ?? undefined);

    await this.cache.set(cacheKey, verified, this.options.cacheTtlMs);
    return verified;
  }

  private async resolveMatch(
    candidates: EstablishmentSummary[],
    totalFound: number,
    businessName: string,
    rfc: string | undefined,
  ): Promise<BusinessVerification> {
    const base: BusinessVerification = {
      matched: false,
      confirmed_by_rfc: false,
      establishment_id: null,
      commercial_name: null,
      state: null,
      candidates_found: totalFound,
    };

    const ordered = orderByNameCloseness(candidates, businessName);
    const best = ordered[0];
    if (!best) return base;

    const normalizedRfc = normalizeRfc(rfc);
    if (normalizedRfc && this.options.maxDetailLookups > 0) {
      const confirmed = await this.confirmByRfc(ordered, normalizedRfc);
      if (confirmed) {
        return {
          ...base,
          matched: true,
          confirmed_by_rfc: true,
          establishment_id: confirmed.establishment_id,
          commercial_name: confirmed.commercial_name,
          state: confirmed.state,
        };
      }
    }

    const closeness = rank(best, normalizeName(businessName));
    const identifies = closeness === RANK_EXACT || (closeness <= RANK_CONTAINS && totalFound === 1);
    if (!identifies) return base;

    return {
      ...base,
      matched: true,
      establishment_id: best.establishment_id,
      commercial_name: best.commercial_name,
      state: best.state,
    };
  }

  private async confirmByRfc(
    ordered: EstablishmentSummary[],
    normalizedRfc: string,
  ): Promise<EstablishmentSummary | null> {
    const lookups = Math.min(this.options.maxDetailLookups, ordered.length);

    for (let index = 0; index < lookups; index++) {
      const candidate = ordered[index];
      if (!candidate) break;

      const detail = await this.siem.getEstablishment(candidate.establishment_id);
      if (!detail.available || detail.data === null || detail.data.found !== true) continue;

      const detailRfc = normalizeRfc(readPath(detail.data, this.options.rfcField));
      if (detailRfc && detailRfc === normalizedRfc) return candidate;
    }
    return null;
  }
}

export function getVerificationStatus(result: SourceResult<BusinessVerification>): VerificationStatus {
  if (!result.available || result.data === null) return 'unavailable';
  if (result.data.matched) return 'verified';
  return result.data.candidates_found > 0 ? 'ambiguous' : 'not_listed';
}

function readPath(payload: Record<string, unknown>, path: string): string | undefined {
  let current: unknown = payload;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

function orderByNameCloseness(
  candidates: EstablishmentSummary[],
  businessName: string,
): EstablishmentSummary[] {
  const target = normalizeName(businessName);
  return [...candidates].sort((a, b) => rank(a, target) - rank(b, target));
}

function rank(candidate: EstablishmentSummary, target: string): number {
  const name = candidate.commercial_name === null ? '' : normalizeName(candidate.commercial_name);
  if (name === target) return 0;
  if (name.startsWith(target)) return 1;
  if (name.includes(target)) return 2;
  return 3;
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildCacheKey(input: BusinessVerificationInput): string {
  const rfc = normalizeRfc(input.rfc);
  const fingerprint = rfc ? createHash('sha256').update(rfc).digest('hex').slice(0, 16) : 'none';
  return `siem:v2:${normalizeName(input.businessName)}|${input.stateCode ?? 'any'}|${fingerprint}`;
}
