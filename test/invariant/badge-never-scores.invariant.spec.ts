import fc from 'fast-check';
import * as publicApi from '../../src/modules/creva-score/creva-score.factory';
import { sourceOk, sourceUnavailable } from '../../src/common/types/source-result.types';
import { BusinessVerification } from '../../src/modules/business-verification/business-verification.service';
import { buildVerificationBadge } from '../../src/modules/business-verification/business-verification.badge';

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

// Words that would mean a contribution to a number. "score" alone is not one of them:
// the package legitimately exposes a declaration *about* the score.
const CONTRIBUTION_KEY = /(point|weight|factor|bonus|penalt|component)/i;
// The product itself is called Creva Score, so the bare word cannot be forbidden.
// What must never exist is an export that produces a score value.
const PRODUCES_A_SCORE = /(calculate|compute|apply|assign|award|increment|add)[A-Za-z]*score/i;

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

  it('never puts a contribution-like value in the badge', () => {
    fc.assert(
      fc.property(arbResult, (result) => {
        const badge = buildVerificationBadge(result);
        if (badge === null) return;

        for (const [key, value] of Object.entries(badge)) {
          expect(CONTRIBUTION_KEY.test(key)).toBe(false);
          expect(/score/i.test(key)).toBe(false);
          expect(typeof value).not.toBe('number');
        }
      }),
    );
  });

  it('exposes no way, anywhere in the public API, to turn a verification into points', () => {
    for (const [name, exported] of Object.entries(publicApi)) {
      expect(CONTRIBUTION_KEY.test(name)).toBe(false);
      if (typeof exported === 'number') {
        throw new Error(`public API exports a bare number: ${name}`);
      }
    }

    expect('applyBusinessVerification' in publicApi).toBe(false);
    expect('buildBusinessVerificationComponent' in publicApi).toBe(false);
  });

  it('exposes nothing that produces a score value', () => {
    for (const name of Object.keys(publicApi)) {
      expect(PRODUCES_A_SCORE.test(name)).toBe(false);
    }

    // The guard has teeth: these are the shapes it is meant to stop.
    for (const forbidden of ['calculateScore', 'applyScoreComponent', 'awardScorePoints', 'addScore']) {
      expect(PRODUCES_A_SCORE.test(forbidden)).toBe(true);
    }
  });
});
