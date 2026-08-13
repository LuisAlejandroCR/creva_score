import fc from 'fast-check';
import { buildCrevaReport, countByTone } from '../../src/common/types/creva-report.types';
import type { ReportSignal, ReportSource } from '../../src/common/types/creva-report.types';
import { buildScoreDisclosure } from '../../src/modules/score-disclosure/score-disclosure.service';

const VERDICT_KEY = /(decision|approve|reject|aprob|rechaz|deneg|veredicto|confidence|confianza|probabilit|riesgo)/i;
const CONTRIBUTION_KEY = /(score_value|points|weight|penalt|bonus)/i;

const disclosure = buildScoreDisclosure({ scoreVersion: '1.0', windowDays: 30 });

const arbSignal: fc.Arbitrary<ReportSignal> = fc.record({
  key: fc.string({ minLength: 1, maxLength: 20 }),
  category: fc.constantFrom('business_verification', 'regulatory', 'reference_rate'),
  label: fc.string({ maxLength: 60 }),
  tone: fc.constantFrom('positive', 'neutral', 'unavailable'),
  detail: fc.string({ maxLength: 120 }),
  source: fc.string({ minLength: 1, maxLength: 20 }),
  checked_at: fc.option(fc.constant('2026-08-13T00:00:00.000Z'), { nil: null }),
  evidence_url: fc.option(fc.webUrl(), { nil: null }),
});

const arbSource: fc.Arbitrary<ReportSource> = fc.record({
  provider: fc.string({ minLength: 1, maxLength: 12 }),
  dataset: fc.string({ minLength: 1, maxLength: 12 }),
  queried_at: fc.option(fc.constant('2026-08-13T00:00:00.000Z'), { nil: null }),
});

describe('B14 invariants — the report describes, it never judges', () => {
  it('never carries a verdict or a confidence figure, whatever it is built from', () => {
    fc.assert(
      fc.property(fc.array(arbSignal, { maxLength: 12 }), fc.array(arbSource, { maxLength: 6 }), (signals, sources) => {
        const report = buildCrevaReport({ subject: null, signals, sources, disclosure });

        for (const key of Object.keys(report)) {
          expect(VERDICT_KEY.test(key)).toBe(false);
          expect(CONTRIBUTION_KEY.test(key)).toBe(false);
        }
        for (const signal of report.signals) {
          for (const key of Object.keys(signal)) expect(CONTRIBUTION_KEY.test(key)).toBe(false);
        }
      }),
    );
  });

  it('never lets a signal count against the subject', () => {
    fc.assert(
      fc.property(fc.array(arbSignal, { maxLength: 12 }), (signals) => {
        const report = buildCrevaReport({ subject: null, signals, sources: [], disclosure });
        const tones = report.signals.map((signal) => signal.tone);

        expect(tones).not.toContain('negative');
        expect(countByTone(report).positive + countByTone(report).neutral + countByTone(report).unavailable).toBe(
          signals.length,
        );
      }),
    );
  });

  it('always carries the declaration that the score does not predict', () => {
    fc.assert(
      fc.property(fc.array(arbSignal, { maxLength: 8 }), (signals) => {
        const report = buildCrevaReport({ subject: null, signals, sources: [], disclosure });

        expect(report.disclosure.kind).toBe('descriptive');
      }),
    );
  });

  it('never emits a signal without naming its source', () => {
    fc.assert(
      fc.property(fc.array(arbSignal, { minLength: 1, maxLength: 10 }), (signals) => {
        const report = buildCrevaReport({ subject: null, signals, sources: [], disclosure });

        for (const signal of report.signals) expect(signal.source.length).toBeGreaterThan(0);
      }),
    );
  });

  it('hands out copies, so a consumer cannot mutate the report it was given', () => {
    fc.assert(
      fc.property(fc.array(arbSignal, { minLength: 1, maxLength: 5 }), (signals) => {
        const input = { subject: null, signals, sources: [], disclosure };
        const report = buildCrevaReport(input);
        report.signals[0]!.label = 'alterado';

        expect(buildCrevaReport(input).signals[0]?.label).toBe(signals[0]?.label);
      }),
    );
  });
});
