import { sourceOk, sourceUnavailable } from '../../src/infra/types';
import { BusinessVerification } from '../../src/business-verification/business-verification.service';
import {
  BUSINESS_VERIFICATION_BADGE_KEY,
  buildVerificationBadge,
} from '../../src/business-verification/business-verification.badge';

function verification(overrides: Partial<BusinessVerification> = {}): BusinessVerification {
  return {
    matched: true,
    confirmed_by_rfc: false,
    establishment_id: '3417757',
    commercial_name: 'ESTETICA ANITA',
    state: 'Chihuahua',
    candidates_found: 1,
    ...overrides,
  };
}

describe('buildVerificationBadge', () => {
  it('carries the provenance a reader needs to audit the claim', () => {
    const result = sourceOk('mx.siem', verification({ confirmed_by_rfc: true }), '2026-08-13T10:00:00.000Z');

    expect(buildVerificationBadge(result)).toEqual({
      key: BUSINESS_VERIFICATION_BADGE_KEY,
      source: 'mx.siem',
      checked_at: '2026-08-13T10:00:00.000Z',
      confirmed_by_rfc: true,
      commercial_name: 'ESTETICA ANITA',
      state: 'Chihuahua',
    });
  });

  it('issues no badge when the business is not listed', () => {
    expect(buildVerificationBadge(sourceOk('mx.siem', verification({ matched: false, candidates_found: 0 })))).toBeNull();
  });

  it('issues no badge when the provider is unavailable', () => {
    expect(buildVerificationBadge(sourceUnavailable('mx.siem', 'http_500'))).toBeNull();
    expect(buildVerificationBadge(sourceUnavailable('mx.siem', 'missing_api_key'))).toBeNull();
  });

  it('distinguishes a name-only match from one confirmed by RFC', () => {
    const nameOnly = buildVerificationBadge(sourceOk('mx.siem', verification({ confirmed_by_rfc: false })));

    expect(nameOnly?.confirmed_by_rfc).toBe(false);
  });
});
