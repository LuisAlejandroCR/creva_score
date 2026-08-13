// business-verification.factor: score contribution of the directory check. Adds only; see D-01.

import Decimal from 'decimal.js';
import { SourceResult } from '../infra/types';
import { BusinessVerification } from './business-verification.service';

export const BUSINESS_VERIFICATION_KEY = 'business_verification_score';

export interface ScoreComponent {
  key: string;
  points: string;
  max_points: string;
  source: string;
  checked_at: string | null;
  confirmed_by_rfc: boolean;
}

export interface ScoreWithVerification {
  score: string;
  verification_included: boolean;
  components: ScoreComponent[];
}

export interface BusinessVerificationFactorConfig {
  points: number;
  maxScore: number;
}

export function buildBusinessVerificationComponent(
  result: SourceResult<BusinessVerification>,
  config: BusinessVerificationFactorConfig,
): ScoreComponent | null {
  if (!result.available || result.data === null || !result.data.matched) {
    return null;
  }

  const points = new Decimal(config.points);
  return {
    key: BUSINESS_VERIFICATION_KEY,
    points: points.toFixed(),
    max_points: points.toFixed(),
    source: result.source,
    checked_at: result.checked_at,
    confirmed_by_rfc: result.data.confirmed_by_rfc,
  };
}

export function applyBusinessVerification(
  baseScore: Decimal.Value,
  component: ScoreComponent | null,
  config: BusinessVerificationFactorConfig,
): ScoreWithVerification {
  const base = new Decimal(baseScore);
  const max = new Decimal(config.maxScore);

  if (component === null) {
    return {
      score: Decimal.min(base, max).toFixed(),
      verification_included: false,
      components: [],
    };
  }

  const total = base.plus(new Decimal(component.points));
  return {
    score: Decimal.min(total, max).toFixed(),
    verification_included: true,
    components: [component],
  };
}
