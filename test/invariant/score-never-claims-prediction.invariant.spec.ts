import fc from 'fast-check';
import { buildScoreDisclosure, renderScoreDisclosure } from '../../src/modules/score-disclosure/score-disclosure.service';

const PREDICTIVE_WORDS = /(predic|probabilidad|estima|pronóstic|riesgo de impago|scoring de riesgo)/i;

const arbConfig = fc.record({
  scoreVersion: fc.stringMatching(/^[0-9]\.[0-9]$/),
  windowDays: fc.integer({ min: 1, max: 365 }),
});

describe('D-07 invariants — the score never claims to predict', () => {
  it('always declares itself descriptive, for any configuration', () => {
    fc.assert(
      fc.property(arbConfig, (config) => {
        expect(buildScoreDisclosure(config).kind).toBe('descriptive');
      }),
    );
  });

  it('never claims prediction in what it says it describes', () => {
    fc.assert(
      fc.property(arbConfig, (config) => {
        expect(PREDICTIVE_WORDS.test(buildScoreDisclosure(config).describes)).toBe(false);
      }),
    );
  });

  it('always states the window it covers, and only ever looks backwards', () => {
    fc.assert(
      fc.property(arbConfig, (config) => {
        const disclosure = buildScoreDisclosure(config);

        expect(disclosure.window_days).toBe(config.windowDays);
        expect(disclosure.describes).toContain(String(config.windowDays));
        expect(disclosure.describes).toMatch(/últimos/);
        expect(JSON.stringify(disclosure)).not.toMatch(/próxim|siguientes|futur|dentro de/i);
      }),
    );
  });

  it('always denies estimating default, and says so where a reader will see it', () => {
    fc.assert(
      fc.property(arbConfig, (config) => {
        const disclosure = buildScoreDisclosure(config);
        const rendered = renderScoreDisclosure(disclosure);

        expect(disclosure.does_not_estimate.some((claim) => /dejes de pagar/i.test(claim))).toBe(true);
        expect(rendered).toContain('Lo que NO hace');
      }),
    );
  });

  it('always names the three provenance levels, so a self-declared figure can never pass as verified', () => {
    fc.assert(
      fc.property(arbConfig, (config) => {
        const levels = buildScoreDisclosure(config).provenance_levels.map((level) => level.level);

        expect(levels).toEqual(['observed', 'documentary', 'self_declared']);
      }),
    );
  });
});
