import { buildReport } from '../../src/modules/creva-score/creva-report.builder';
import { buildScoreDisclosure } from '../../src/modules/score-disclosure/score-disclosure.service';
import { moreLabel, nextVisible, renderReportHtml } from '../../src/cli/report';
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

function reportWithManyRules(count: number) {
  return buildReport({
    subject: { business_name: 'ACME', state_code: null },
    verification: verified,
    radar: sourceOk('mx.regulatory-radar', {
      alerts: Array.from({ length: count }, (_, i) => ({
        source: 'mx.cnbv' as const,
        kind: 'standing_rule' as const,
        external_id: `c${i}`,
        title: `Norma ${i}`,
        published_at: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
        agency: 'CNBV',
        url: null,
      })),
      scanned_dates: ['2026-08-13'],
      failed_dates: [],
      sources_available: ['mx.cnbv'],
      sources_unavailable: [],
    }),
    rates,
    disclosure,
    now,
  });
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

  it('offers one filter per source plus the unfiltered view, all pressable', () => {
    const html = renderReportHtml(report());

    for (const filter of ['all', 'siem', 'dof', 'cnbv', 'banxico']) {
      expect(html).toContain(`data-filter="${filter}"`);
    }
    const buttons = html.match(/<button class="filter[^"]*"[^>]*>/g) ?? [];

    expect(buttons).toHaveLength(5);
    expect(buttons.filter((button) => button.includes('aria-pressed="true"'))).toHaveLength(1);
  });

  it('lets a category be re-ordered, and never offers a ranking it cannot compute', () => {
    const html = renderReportHtml(reportWithManyRules(18));
    const cnbvPanel = html.slice(html.indexOf('id="lane-cnbv"'), html.indexOf('id="lane-banxico"'));
    const siemPanel = html.slice(html.indexOf('id="lane-siem"'), html.indexOf('id="lane-dof"'));

    expect(cnbvPanel).toContain('data-sort="recent"');
    expect(cnbvPanel).toContain('data-sort="default"');
    expect(cnbvPanel).not.toContain('relevante');
    // One signal cannot be re-ordered, so SIEM gets no control at all.
    expect(siemPanel).not.toContain('data-sort=');
  });

  it('numbers the three reasons so they read as a sequence', () => {
    const html = renderReportHtml(report());

    expect(html.match(/class="why-step" data-step="\d"/g)).toHaveLength(3);
    for (const number of ['01', '02', '03']) expect(html).toContain(`<span class="why-num">${number}</span>`);
    // The steps must not be dimmed by the stylesheet alone: only the script may stage them,
    // because only the script can undo it. The qualified rule is the one allowed to dim.
    expect(html).toContain('.why-steps.staged .why-step{opacity:.32}');

    const unqualified = html.match(/^\.why-step\{[^}]*\}/m)?.[0] ?? '';

    expect(unqualified).toContain('display:grid');
    expect(unqualified).not.toContain('opacity:.32');
  });

  it('folds the reference material but never the disclosure itself', () => {
    const html = renderReportHtml(report());
    const foldedFrom = html.indexOf('<div class="audit-more"');

    expect(html).toContain('aria-controls="audit-more"');
    expect(html).toContain('id="audit-more" hidden');
    // The claims the score refuses to make sit above the fold, always open.
    expect(html.indexOf('Lo que NO hace')).toBeLessThan(foldedFrom);
    expect(html.indexOf('dejes de pagar')).toBeLessThan(foldedFrom);
    expect(html.indexOf('Fuentes consultadas')).toBeGreaterThan(foldedFrom);
  });

  it('gives every section a dot that points at a section that exists', () => {
    const html = renderReportHtml(report());
    const targets = [...html.matchAll(/data-goto="([a-z-]+)"/g)].map((match) => match[1]);

    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) expect(html).toContain(`id="${target}"`);
  });

  it('drops the market dot when there is no market section to reach', () => {
    const html = renderReportHtml(
      buildReport({
        subject: { business_name: 'ACME', state_code: null },
        verification: verified,
        radar,
        rates: sourceUnavailable('mx.banxico.sie', 'http_500'),
        disclosure,
        now,
      }),
    );

    expect(html).not.toContain('data-goto="sec-market"');
    expect(html).toContain('data-goto="sec-audit"');
  });

  it('marks the evidence as cited, never as verified by the act of opening it', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('Evidencia citada');
    expect(html).not.toContain('Fuente verificada');
  });

  it('folds every source past the first few without dropping a single item', () => {
    const html = renderReportHtml(reportWithManyRules(18));
    const cnbvPanel = html.slice(html.indexOf('id="lane-cnbv"'), html.indexOf('id="lane-banxico"'));

    // All 18 stay in the document; 15 of them simply start folded.
    expect(cnbvPanel.match(/class="item /g)).toHaveLength(18);
    expect(cnbvPanel.match(/ hidden>/g)).toHaveLength(15);
    expect(cnbvPanel).toContain('data-visible="3"');
    for (let i = 0; i < 18; i++) expect(cnbvPanel).toContain(`Norma ${i}`);
  });

  it('promises only what one press reveals, and says how many are left', () => {
    expect(moreLabel(3, 18)).toBe('Mostrar 3 más → quedan 12');
    expect(moreLabel(6, 18)).toBe('Mostrar 4 más → quedan 8');
    expect(moreLabel(10, 18)).toBe('Mostrar 8 más →');
    expect(nextVisible(3, 4)).toBe(4);
  });

  it('turns each summary insight into a jump to the evidence it names', () => {
    const html = renderReportHtml(report());

    for (const lane of ['siem', 'dof', 'cnbv']) {
      expect(html).toContain(`data-target="${lane}"`);
      expect(html).toContain(`id="lane-${lane}"`);
    }
    expect(html).toContain('Negocio encontrado en SIEM');
    expect(html).toContain('Explorar evidencia');
  });

  it('counts the investigation out loud without inventing a source', () => {
    const built = report();
    const html = renderReportHtml(built);

    expect(html.match(/class="tick"/g)).toHaveLength(4);
    expect(html).toContain('fuentes conectadas');
    expect(html).toContain(`<strong>${built.signals.length}</strong> señales encontradas`);
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
