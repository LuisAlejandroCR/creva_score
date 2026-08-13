import fc from 'fast-check';
import * as publicApi from '../../src/index';
import { sourceOk, sourceUnavailable } from '../../src/infra/types';
import { BusinessVerification } from '../../src/business-verification/business-verification.service';
import { buildVerificationBadge } from '../../src/business-verification/business-verification.badge';

const arbVerification = fc.record({
  matched: fc.boolean(),
  confirmed_by_rfc: fc.boolean(),
  establishment_id: fc.option(fc.string(), { nil: null }),
  commercial_name: fc.option(fc.string(), { nil: null }),
  state: fc.option(fc.string(), { nil: null }),
  candidates_found: fc.nat({ max: 20_000 }),
});

const arbResult = fc.oneof(
  arbVerification.map((v: BusinessVerification) => sourceOk('mx.siem', v)),
  fc
    .constantFrom('missing_api_key', 'http_500', 'http_429', 'job_failed', 'invalid_response_shape')
    .map((e) => sourceUnavailable<BusinessVerification>('mx.siem', e)),
);

const SCORE_LIKE_KEY = /(score|point|weight|factor|bonus|penalt)/i;

describe('D-02 invariants — the directory check never becomes a number', () => {
  it('issues a badge exactly when the business was found, and never otherwise', () => {
    fc.assert(
      fc.property(arbResult, (result) => {
        const badge = buildVerificationBadge(result);
        const shouldIssue = result.available && result.data !== null && result.data.matched;

        expect(badge !== null).toBe(shouldIssue);
      }),
    );
  });

  it('never puts a score-like value in the badge', () => {
    fc.assert(
      fc.property(arbResult, (result) => {
        const badge = buildVerificationBadge(result);
        if (badge === null) return;

        for (const [key, value] of Object.entries(badge)) {
          expect(SCORE_LIKE_KEY.test(key)).toBe(false);
          expect(typeof value).not.toBe('number');
        }
      }),
    );
  });

  it('exposes no way, anywhere in the public API, to turn a verification into points', () => {
    for (const [name, exported] of Object.entries(publicApi)) {
      expect(SCORE_LIKE_KEY.test(name)).toBe(false);
      if (typeof exported === 'number') {
        throw new Error(`public API exports a bare number: ${name}`);
      }
    }

    expect('applyBusinessVerification' in publicApi).toBe(false);
    expect('buildBusinessVerificationComponent' in publicApi).toBe(false);
  });
});
