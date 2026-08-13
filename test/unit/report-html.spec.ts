import { buildReport } from '../../src/modules/creva-score/creva-report.builder';
import { buildScoreDisclosure } from '../../src/modules/score-disclosure/score-disclosure.service';
import { renderReportHtml } from '../../src/cli/report-html';
import { sourceOk, sourceUnavailable } from '../../src/common/types/source-result.types';
import { parseArgs, renderReportPaths } from '../../src/cli/demo';

const disclosure = buildScoreDisclosure({ scoreVersion: '1.0', windowDays: 30 });
const now = () => new Date('2026-08-13T12:00:00.000Z');

const verified = sourceOk(
  'mx.siem',
  {
    matched: true,
    confirmed_by_rfc: true,
    establishment_id: '1',
    commercial_name: 'ESTETICA ANITA',
    state: 'Chihuahua',
    candidates_found: 1,
  },
  '2026-08-13T00:00:00.000Z',
);

const radar = sourceOk(
  'mx.regulatory-radar',
  {
    alerts: [
      {
        source: 'mx.dof',
        kind: 'publication' as const,
        external_id: 'p1',
        title: 'ACUERDO sobre comisiones bancarias',
        published_at: '2026-08-07',
        agency: 'SHCP',
        url: null,
      },
    ],
    scanned_dates: ['2026-08-13'],
    failed_dates: ['2026-08-12'],
    sources_available: ['mx.dof'],
    sources_unavailable: ['mx.cnbv'],
  },
  '2026-08-13T00:00:00.000Z',
);

const rates = sourceOk(
  'mx.banxico.sie',
  {
    rates: [
      {
        series_id: 'SF60648',
        label: 'TIIE a 28 días',
        placement: 'headline' as const,
        unit: 'percent' as const,
        value: 6.7358,
        observed_on: '2026-08-14',
      },
    ],
    missing_series: [],
  },
  '2026-08-13T00:00:00.000Z',
);

function report(subject: { business_name: string; state_code: number | null } | null = { business_name: 'ESTETICA ANITA', state_code: 8 }) {
  return buildReport({ subject, verification: verified, radar, rates, disclosure, now });
}

describe('parseArgs', () => {
  it('reads --reporte even though it carries no value', () => {
    expect(parseArgs(['--reporte']).report).toBe(true);
    expect(parseArgs(['--negocio', 'ACME', '--reporte']).report).toBe(true);
  });

  it('leaves report unset when the flag is absent', () => {
    expect(parseArgs(['--negocio', 'ACME']).report).toBeUndefined();
  });
});

describe('buildReport', () => {
  it('turns a verified business into a positive signal naming its source', () => {
    const signal = report().signals.find((s) => s.category === 'business_verification');

    expect(signal).toMatchObject({ tone: 'positive', source: 'Directorio oficial de establecimientos (SIEM)' });
  });

  it('says out loud which gazette dates it could not read', () => {
    expect(report().notes.join(' ')).toContain('No pudimos leer 1 fecha');
  });

  it('marks an unreadable directory as unavailable, never as absent', () => {
    const built = buildReport({
      subject: { business_name: 'ACME', state_code: null },
      verification: sourceUnavailable('mx.siem', 'http_502'),
      radar,
      rates,
      disclosure,
      now,
    });
    const signal = built.signals.find((s) => s.category === 'business_verification');

    expect(signal?.tone).toBe('unavailable');
    expect(signal?.detail).toContain('no dice nada sobre tu negocio');
  });

  it('explains the empty badge when no business was asked about', () => {
    expect(buildReport({ subject: null, verification: null, radar, rates, disclosure, now }).notes.join(' ')).toContain(
      'no consultó ningún negocio',
    );
  });
});

describe('renderReportHtml', () => {
  it('produces one self-contained page with no external requests', () => {
    const html = renderReportHtml(report());

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });

  it('carries every signal with its source and date', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('ESTETICA ANITA');
    expect(html).toContain('Directorio oficial de establecimientos (SIEM)');
    expect(html).toContain('TIIE a 28 días');
    expect(html).toContain('07 de agosto de 2026');
  });

  it('shows what the score refuses to claim', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('Sobre este análisis');
    expect(html).toContain('Lo que NO hace');
    expect(html).toContain('dejes de pagar');
  });

  it('never grades the business, it only states a fact about the registry', () => {
    const html = renderReportHtml(report()).toLowerCase();

    for (const verdict of ['favorable', 'desfavorable', 'aprob', 'rechaz', 'riesgo bajo', 'riesgo alto', 'confianza']) {
      expect(html).not.toContain(verdict);
    }
    expect(renderReportHtml(report())).toContain('Verificado');
  });

  it('puts a real count in the hero, never an invented figure', () => {
    const built = report();
    const html = renderReportHtml(built);

    expect(html).toContain(`data-count="${built.signals.length}"`);
    expect(html).toContain('señales públicas encontradas');
  });

  it('says "sin sello" rather than implying something is wrong', () => {
    const html = renderReportHtml(
      buildReport({
        subject: { business_name: 'CAÑONERI', state_code: 29 },
        verification: sourceOk('mx.siem', {
          matched: false,
          confirmed_by_rfc: false,
          establishment_id: null,
          commercial_name: null,
          state: null,
          candidates_found: 0,
        }),
        radar,
        rates,
        disclosure,
        now,
      }),
    );

    expect(html).toContain('Sin sello');
    expect(html).toContain('su ausencia no dice nada');
  });

  it('lays out one lane per source so evidence stays folded', () => {
    const html = renderReportHtml(report());

    for (const lane of ['lane-siem', 'lane-dof', 'lane-cnbv', 'lane-banxico']) {
      expect(html).toContain(lane);
    }
  });

  it('keeps motion optional', () => {
    expect(renderReportHtml(report())).toContain('prefers-reduced-motion');
  });

  it('opens the evidence with the keyboard, not only with a mouse', () => {
    const html = renderReportHtml(report());
    const heads = html.match(/<button class="panel-head"[^>]*>/g) ?? [];

    expect(heads.length).toBe(4);
    for (const head of heads) {
      expect(head).toContain('aria-expanded="false"');
      expect(head).toContain('aria-controls="body-');
    }
  });

  it('leaves every panel folded and says how to unfold it', () => {
    const html = renderReportHtml(report());

    expect(html).not.toMatch(/class="panel[^"]*\bopen\b/);
    expect(html).toContain('Ver evidencia');
  });

  it('wires each rail stop to the panel it reveals', () => {
    const html = renderReportHtml(report());

    for (const lane of ['siem', 'dof', 'cnbv', 'banxico']) {
      expect(html).toContain(`<button class="stop" data-lane="${lane}" type="button" aria-controls="lane-${lane}">`);
      expect(html).toContain(`id="lane-${lane}"`);
    }
  });

  it('escapes anything that came from a source', () => {
    const hostile = buildReport({
      subject: { business_name: '<script>alert(1)</script>', state_code: null },
      verification: null,
      radar,
      rates,
      disclosure,
      now,
    });

    const html = renderReportHtml(hostile);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('embeds the data without letting it close the script tag', () => {
    const hostile = buildReport({
      subject: { business_name: '</script><img src=x>', state_code: null },
      verification: null,
      radar,
      rates,
      disclosure,
      now,
    });

    const html = renderReportHtml(hostile);
    const scriptOpens = (html.match(/<script/g) ?? []).length;

    expect(scriptOpens).toBe(1);
    expect(html).toContain('\\u003c/script>');
  });
});

describe('renderReportPaths', () => {
  const html = String.raw`C:\IA Hackathon - Creva score\creva-report.html`;
  const json = String.raw`C:\IA Hackathon - Creva score\creva-report.json`;

  it('states where the files landed, not just that they were written', () => {
    const out = renderReportPaths(html, json);

    expect(out).toContain(html);
    expect(out).toContain(json);
  });

  it('quotes the path, because it almost always contains spaces', () => {
    expect(renderReportPaths(html, json)).toContain(`"${html}"`);
  });

  it('offers an opener that matches the platform it is running on', () => {
    const expected = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';

    expect(renderReportPaths(html, json)).toContain(`${expected} "`);
  });
});
