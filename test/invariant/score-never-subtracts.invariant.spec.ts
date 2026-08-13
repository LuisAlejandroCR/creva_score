import fc from 'fast-check';
import Decimal from 'decimal.js';
import { sourceOk, sourceUnavailable } from '../../src/infra/types';
import { BusinessVerification } from '../../src/business-verification/business-verification.service';
import {
  applyBusinessVerification,
  buildBusinessVerificationComponent,
} from '../../src/business-verification/business-verification.factor';

const arbVerification = fc.record({
  matched: fc.boolean(),
  confirmed_by_rfc: fc.boolean(),
  establishment_id: fc.option(fc.string(), { nil: null }),
  commercial_name: fc.option(fc.string(), { nil: null }),
  state: fc.option(fc.string(), { nil: null }),
  candidates_found: fc.nat({ max: 10_000 }),
});

const arbResult = fc.oneof(
  arbVerification.map((v: BusinessVerification) => sourceOk('mx.siem', v)),
  fc
    .constantFrom('missing_api_key', 'http_500', 'http_429', 'job_failed', 'invalid_response_shape')
    .map((e) => sourceUnavailable<BusinessVerification>('mx.siem', e)),
);

const arbBase = fc.double({ min: 0, max: 100, noNaN: true });
const arbConfig = fc.record({
  points: fc.double({ min: 0, max: 100, noNaN: true }),
  maxScore: fc.double({ min: 1, max: 100, noNaN: true }),
});

describe('D-01 invariants', () => {
  it('never returns a score below the base score', () => {
    fc.assert(
      fc.property(arbBase, arbResult, arbConfig, (base, result, config) => {
        const component = buildBusinessVerificationComponent(result, config);
        const applied = applyBusinessVerification(base, component, config);
        const capped = Decimal.min(new Decimal(base), new Decimal(config.maxScore));

        expect(new Decimal(applied.score).greaterThanOrEqualTo(capped)).toBe(true);
      }),
    );
  });

  it('never returns a score above the declared maximum', () => {
    fc.assert(
      fc.property(arbBase, arbResult, arbConfig, (base, result, config) => {
        const component = buildBusinessVerificationComponent(result, config);
        const applied = applyBusinessVerification(base, component, config);

        expect(new Decimal(applied.score).lessThanOrEqualTo(new Decimal(config.maxScore))).toBe(true);
      }),
    );
  });

  it('produces exactly the no-feature score whenever the business is not verified', () => {
    const notVerified = fc.oneof(
      arbVerification
        .map((v: BusinessVerification) => ({ ...v, matched: false }))
        .map((v) => sourceOk('mx.siem', v)),
      fc.constantFrom('missing_api_key', 'http_500').map((e) => sourceUnavailable<BusinessVerification>('mx.siem', e)),
    );

    fc.assert(
      fc.property(arbBase, notVerified, arbConfig, (base, result, config) => {
        const withFeature = applyBusinessVerification(base, buildBusinessVerificationComponent(result, config), config);
        const withoutFeature = applyBusinessVerification(base, null, config);

        expect(withFeature.score).toBe(withoutFeature.score);
        expect(withFeature.verification_included).toBe(false);
        expect(withFeature.components).toHaveLength(0);
      }),
    );
  });

  it('flags verification_included exactly when a component is present', () => {
    fc.assert(
      fc.property(arbBase, arbResult, arbConfig, (base, result, config) => {
        const component = buildBusinessVerificationComponent(result, config);
        const applied = applyBusinessVerification(base, component, config);

        expect(applied.verification_included).toBe(component !== null);
        expect(applied.components).toHaveLength(component === null ? 0 : 1);
      }),
    );
  });

  it('only ever builds a component from an available, matched result', () => {
    fc.assert(
      fc.property(arbResult, arbConfig, (result, config) => {
        const component = buildBusinessVerificationComponent(result, config);
        if (component === null) return;

        expect(result.available).toBe(true);
        expect(result.data?.matched).toBe(true);
        expect(new Decimal(component.points).greaterThanOrEqualTo(0)).toBe(true);
      }),
    );
  });
});
