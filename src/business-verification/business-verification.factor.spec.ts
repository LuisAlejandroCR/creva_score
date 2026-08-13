import { sourceOk, sourceUnavailable } from '../infra/types';
import { BusinessVerification } from './business-verification.service';
import {
  BUSINESS_VERIFICATION_KEY,
  applyBusinessVerification,
  buildBusinessVerificationComponent,
} from './business-verification.factor';

const config = { points: 20, maxScore: 100 };

function verification(overrides: Partial<BusinessVerification> = {}): BusinessVerification {
  return {
    matched: true,
    confirmed_by_rfc: false,
    establishment_id: '3417757',
    commercial_name: 'ACME SA',
    state: 'Jalisco',
    candidates_found: 1,
    ...overrides,
  };
}

describe('buildBusinessVerificationComponent', () => {
  it('builds a component carrying provenance when the business is listed', () => {
    const result = sourceOk('mx.siem', verification({ confirmed_by_rfc: true }), '2026-08-12T10:00:00.000Z');

    expect(buildBusinessVerificationComponent(result, config)).toEqual({
      key: BUSINESS_VERIFICATION_KEY,
      points: '20',
      max_points: '20',
      source: 'mx.siem',
      checked_at: '2026-08-12T10:00:00.000Z',
      confirmed_by_rfc: true,
    });
  });

  it('returns no component when the business is not listed', () => {
    const result = sourceOk('mx.siem', verification({ matched: false, candidates_found: 0 }));

    expect(buildBusinessVerificationComponent(result, config)).toBeNull();
  });

  it('returns no component when the provider is unavailable', () => {
    expect(buildBusinessVerificationComponent(sourceUnavailable('mx.siem', 'http_500'), config)).toBeNull();
    expect(buildBusinessVerificationComponent(sourceUnavailable('mx.siem', 'missing_api_key'), config)).toBeNull();
  });
});

describe('applyBusinessVerification — D-01: only adds, never subtracts', () => {
  it('leaves the base score untouched when there is no component', () => {
    const applied = applyBusinessVerification(64, null, config);

    expect(applied).toEqual({ score: '64', verification_included: false, components: [] });
  });

  it.each([0, 1, 33.75, 64, 80, 100])('never lowers a base score of %p', (base) => {
    const notListed = sourceOk('mx.siem', verification({ matched: false, candidates_found: 0 }));
    const unavailable = sourceUnavailable<BusinessVerification>('mx.siem', 'http_500');

    for (const result of [notListed, unavailable]) {
      const applied = applyBusinessVerification(base, buildBusinessVerificationComponent(result, config), config);
      expect(Number(applied.score)).toBe(base);
      expect(applied.verification_included).toBe(false);
    }
  });

  it('produces the exact same score as if the component did not exist', () => {
    const notListed = sourceOk('mx.siem', verification({ matched: false, candidates_found: 0 }));

    const withFeature = applyBusinessVerification(72.5, buildBusinessVerificationComponent(notListed, config), config);
    const withoutFeature = applyBusinessVerification(72.5, null, config);

    expect(withFeature.score).toBe(withoutFeature.score);
  });

  it('adds the points and flags the score as including verification', () => {
    const component = buildBusinessVerificationComponent(sourceOk('mx.siem', verification()), config);
    const applied = applyBusinessVerification(64, component, config);

    expect(applied.score).toBe('84');
    expect(applied.verification_included).toBe(true);
    expect(applied.components).toHaveLength(1);
  });

  it('stays inside the declared range when the component would overflow it', () => {
    const component = buildBusinessVerificationComponent(sourceOk('mx.siem', verification()), config);
    const applied = applyBusinessVerification(95, component, config);

    expect(applied.score).toBe('100');
  });

  it('keeps decimal arithmetic exact', () => {
    const component = buildBusinessVerificationComponent(sourceOk('mx.siem', verification()), { points: 0.1, maxScore: 100 });
    const applied = applyBusinessVerification(0.2, component, { points: 0.1, maxScore: 100 });

    expect(applied.score).toBe('0.3');
  });
});
