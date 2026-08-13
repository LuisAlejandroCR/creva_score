import { buildScoreDisclosure, renderScoreDisclosure } from '../../src/score-disclosure/score-disclosure';

const config = { scoreVersion: '1.0', windowDays: 30, now: () => new Date('2026-08-13T12:00:00.000Z') };

describe('buildScoreDisclosure', () => {
  it('states the version, the window and the moment it was produced', () => {
    const disclosure = buildScoreDisclosure(config);

    expect(disclosure).toMatchObject({
      score_version: '1.0',
      kind: 'descriptive',
      window_days: 30,
      checked_at: '2026-08-13T12:00:00.000Z',
    });
    expect(disclosure.describes).toBe('Cómo ha operado tu negocio en los últimos 30 días.');
  });

  it('lists what the score refuses to claim', () => {
    const disclosure = buildScoreDisclosure(config);

    expect(disclosure.does_not_estimate).toHaveLength(3);
    expect(disclosure.does_not_estimate.join(' ')).toContain('historial crediticio');
  });

  it('hands out copies, so a caller cannot mutate the declaration', () => {
    const first = buildScoreDisclosure(config);
    first.does_not_estimate.push('esto no debería sobrevivir');
    first.provenance_levels[0]!.label = 'Alterado';

    const second = buildScoreDisclosure(config);

    expect(second.does_not_estimate).toHaveLength(3);
    expect(second.provenance_levels[0]?.label).toBe('Observado');
  });
});

describe('renderScoreDisclosure', () => {
  it('reads as something a person can act on', () => {
    const rendered = renderScoreDisclosure(buildScoreDisclosure(config));

    expect(rendered).toContain('Describe: Cómo ha operado tu negocio en los últimos 30 días.');
    expect(rendered).toContain('Ventana:  30 días · versión 1.0');
    expect(rendered).toContain('Autodeclarado');
  });
});
