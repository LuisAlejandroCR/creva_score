// business-verification.badge: informational credential from the directory check. Carries no
// score contribution; see D-02.

import { SourceResult } from '../../common/types/source-result.types';
import { BusinessVerification } from './business-verification.service';

export const BUSINESS_VERIFICATION_BADGE_KEY = 'business_verification';

export interface VerificationBadge {
  key: string;
  source: string;
  checked_at: string | null;
  confirmed_by_rfc: boolean;
  commercial_name: string | null;
  state: string | null;
}

export function buildVerificationBadge(
  result: SourceResult<BusinessVerification>,
): VerificationBadge | null {
  if (!result.available || result.data === null || !result.data.matched) {
    return null;
  }

  return {
    key: BUSINESS_VERIFICATION_BADGE_KEY,
    source: result.source,
    checked_at: result.checked_at,
    confirmed_by_rfc: result.data.confirmed_by_rfc,
    commercial_name: result.data.commercial_name,
    state: result.data.state,
  };
}
