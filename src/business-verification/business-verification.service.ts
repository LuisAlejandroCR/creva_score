// business-verification.service: resolves a business against the government directory.

import { createHash } from 'node:crypto';
import { CacheStore } from '../infra/cache';
import { SourceResult, sourceOk } from '../infra/types';
import { SiemClient } from '../siem/siem.client';
import { EstablishmentSummary, SIEM_SOURCE } from '../siem/siem.schemas';

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

export type VerificationStatus = 'verified' | 'not_listed' | 'unavailable';

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

    const candidates = search.data.establishments;
    const result = await this.resolveMatch(candidates, input.rfc);
    const verified = sourceOk<BusinessVerification>(SIEM_SOURCE, result, search.checked_at ?? undefined);

    await this.cache.set(cacheKey, verified, this.options.cacheTtlMs);
    return verified;
  }

  private async resolveMatch(
    candidates: EstablishmentSummary[],
    rfc: string | undefined,
  ): Promise<BusinessVerification> {
    const base: BusinessVerification = {
      matched: false,
      confirmed_by_rfc: false,
      establishment_id: null,
      commercial_name: null,
      state: null,
      candidates_found: candidates.length,
    };

    const first = candidates[0];
    if (!first) return base;

    const nameMatch: BusinessVerification = {
      ...base,
      matched: true,
      establishment_id: first.establishment_id,
      commercial_name: first.commercial_name,
      state: first.state,
    };

    const normalizedRfc = normalizeRfc(rfc);
    if (!normalizedRfc || this.options.maxDetailLookups <= 0) {
      return nameMatch;
    }

    const lookups = Math.min(this.options.maxDetailLookups, candidates.length);
    for (let index = 0; index < lookups; index++) {
      const candidate = candidates[index];
      if (!candidate) break;

      const detail = await this.siem.getEstablishment(candidate.establishment_id);
      if (!detail.available || detail.data === null || detail.data.found !== true) continue;

      const detailRfc = normalizeRfc(readField(detail.data, this.options.rfcField));
      if (detailRfc && detailRfc === normalizedRfc) {
        return {
          ...nameMatch,
          confirmed_by_rfc: true,
          establishment_id: candidate.establishment_id,
          commercial_name: candidate.commercial_name,
          state: candidate.state,
        };
      }
    }

    return nameMatch;
  }
}

export function getVerificationStatus(result: SourceResult<BusinessVerification>): VerificationStatus {
  if (!result.available || result.data === null) return 'unavailable';
  return result.data.matched ? 'verified' : 'not_listed';
}

function readField(payload: Record<string, unknown>, field: string): string | undefined {
  const value = payload[field];
  return typeof value === 'string' ? value : undefined;
}

function normalizeRfc(rfc: string | undefined): string | undefined {
  if (typeof rfc !== 'string') return undefined;
  const normalized = rfc.replace(/[\s-]/g, '').toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
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
  return `siem:v1:${normalizeName(input.businessName)}|${input.stateCode ?? 'any'}|${fingerprint}`;
}
