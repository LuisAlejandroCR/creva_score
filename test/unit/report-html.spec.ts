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

// The standing rules the CNBV still enforces go back well over a decade, which is what
// gives the axis more than one year to name.
function reportAcrossYears() {
  const years = [2012, 2014, 2016, 2019, 2021, 2024, 2025];

  return buildReport({
    subject: { business_name: 'ACME', state_code: null },
    verification: verified,
    radar: sourceOk('mx.regulatory-radar', {
      alerts: years.map((year, i) => ({
        source: 'mx.cnbv' as const,
        kind: 'standing_rule' as const,
        external_id: `c${i}`,
        title: `Norma de ${year}`,
        published_at: `${year}-03-11`,
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
  it('produces one self-contained page that loads nothing from the network', () => {
    const html = renderReportHtml(report());

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/<(img|iframe|video|audio|source|embed|object)\b/i);
    expect(html).not.toMatch(/@import|url\(\s*['"]?https?:/i);
  });

  it('reaches the network only where a person chose to, and only to known hosts', () => {
    // A link the reader clicks is not a load. The allowlist is what keeps that honest:
    // w3.org is the SVG namespace, wa.me is the share the reader triggers.
    const hosts = new Set(
      [...renderReportHtml(report()).matchAll(/https?:\/\/([^/"'\s)]+)/g)].map((match) => match[1]),
    );

    expect([...hosts].sort()).toEqual(['wa.me', 'www.w3.org']);
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
    // Scoped to the audit block on purpose: "Fuentes consultadas" is also a KPI label
    // up in the summary, and searching the whole document finds that one first.
    const auditFrom = html.indexOf('<section class="block audit"');
    const audit = html.slice(auditFrom, html.indexOf('</section>', html.indexOf('</details>', auditFrom)));
    const foldedFrom = audit.indexOf('<details class="fold">');

    // Native folds bring their own keyboard handling and find-in-page behaviour.
    expect(audit.match(/<details class="fold">/g)?.length).toBeGreaterThanOrEqual(2);
    expect(audit).not.toContain('<details class="fold" open');
    // The claims the score refuses to make sit above the first fold, always open.
    expect(audit.indexOf('Lo que NO hace')).toBeLessThan(foldedFrom);
    expect(audit.indexOf('dejes de pagar')).toBeLessThan(foldedFrom);
    expect(audit.indexOf('Fuentes consultadas y sus fechas')).toBeGreaterThan(foldedFrom);
  });

  it('keeps a way out of the staged view for find-in-page', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('id="show-all"');
    expect(html).toContain('aria-pressed="false"');
    // Any class that sets display would otherwise beat the browser's own [hidden].
    expect(html).toContain('[hidden]{display:none!important}');
  });

  it('prints the executive summary, not the app', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('@media print');
    expect(html).toContain('body > *:not(.paper){display:none!important}');
    expect(html.match(/<section class="p-page">/g)).toHaveLength(2);
    expect(html).toContain('id="to-pdf"');
  });

  it('shares public figures and never an identifier', () => {
    const html = renderReportHtml(report());
    const share = /window\.CREVA_SHARE=(\{.*?\});window\.CREVA_REPORT/.exec(html)?.[1] ?? '';

    expect(share).toContain('ESTETICA ANITA');
    expect(share).toContain('señales públicas');
    // wa.me carries no number, so WhatsApp asks the sender to pick a contact.
    expect(html).toContain("window.open('https://wa.me/?text='");
    for (const forbidden of ['rfc', 'RFC', 'curp', 'establishment_id']) {
      expect(share).not.toContain(forbidden);
    }
  });

  it('names every stage and wires each tab to the pane it controls', () => {
    const html = renderReportHtml(report());
    const stages = [...html.matchAll(/data-stage="([a-z]+)"/g)].map((match) => match[1]);

    expect(stages).toEqual(['summary', 'signals', 'evidence', 'market', 'audit']);
    for (const stage of stages) {
      expect(html).toContain(`aria-controls="pane-${stage}"`);
      expect(html).toContain(`id="pane-${stage}"`);
      expect(html).toContain(`aria-labelledby="tab-${stage}"`);
    }
    for (const name of ['Resumen', 'Señales', 'Evidencia', 'Mercado', 'Auditoría']) {
      expect(html).toContain(name);
    }
  });

  it('opens on the first stage and leaves the rest out of the way', () => {
    const html = renderReportHtml(report());
    const panes = html.match(/<section class="pane"[^>]*>/g) ?? [];

    expect(panes).toHaveLength(5);
    expect(panes.filter((pane) => pane.includes(' hidden'))).toHaveLength(4);
    expect(panes[0]).not.toContain(' hidden');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
  });

  it('drops the market stage when there is no market data to show', () => {
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

    expect(html).not.toContain('data-stage="market"');
    expect(html).toContain('data-stage="audit"');
    expect(html.match(/<section class="pane"[^>]*>/g)).toHaveLength(4);
  });

  it('marks the evidence as consulted, never as verified by the act of opening it', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('Evidencia consultada');
    expect(html).toContain('✓ consultado');
    expect(html).not.toContain('Fuente verificada');
    expect(html).not.toContain('verificada por');
  });

  it('offers a way forward and back from every stage, and none off the ends', () => {
    const html = renderReportHtml(report());
    const summaryPane = html.slice(html.indexOf('id="pane-summary"'), html.indexOf('id="pane-signals"'));
    const auditPane = html.slice(html.indexOf('id="pane-audit"'));

    expect(summaryPane).toContain('data-step="signals"');
    expect(summaryPane).not.toContain('class="step back"');
    expect(auditPane).toContain('data-step="market"');
    expect(auditPane).not.toContain('class="step next"');

    const steps = [...html.matchAll(/data-step="([a-z]+)"/g)].map((match) => match[1]);
    for (const step of steps) expect(html).toContain(`id="pane-${step}"`);
  });

  it('says each source once, in the ranked list, and nowhere else', () => {
    const html = renderReportHtml(reportWithManyRules(20));
    const app = html.slice(0, html.indexOf('<article class="paper"'));

    // The dot rows repeated the very numbers the ranked list already carries.
    expect(app).not.toContain('comp-rows');
    expect(app).not.toContain('class="comp-dots"');
    expect(app.match(/class="rank a\d"/g)).toHaveLength(4);
    // One table left in the whole application: the one thing that is genuinely tabular.
    expect(app.match(/<table/g)).toHaveLength(1);
    expect(app).toContain('<table class="sources">');
  });

  it('draws the same timeline in the app and on paper', () => {
    const html = renderReportHtml(reportWithManyRules(20));

    expect(html).toContain('class="tl"');
    expect(html).toContain('class="p-tl"');
    expect(html.match(/class="tl-dot/g)?.length).toBeGreaterThan(1);
    expect(html.match(/class="p-tl-dot/g)?.length).toBeGreaterThan(1);
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
    expect(moreLabel(10, 18)).toBe('Mostrar todo · 8 más');
    expect(nextVisible(3, 4)).toBe(4);
  });

  it('keeps the rendered label and the one the page rebuilds in step', () => {
    // The script rebuilds this label in the browser from its own copy of the rule.
    // Testing moreLabel alone let the two drift: the page still said "Mostrar 10 más".
    const html = renderReportHtml(reportWithManyRules(18));

    expect(html).toContain(moreLabel(3, 18));
    expect(html).toContain("'Mostrar todo · '+step+' más'");
    expect(html).toContain("'Mostrar '+step+' más → quedan '+left");
  });

  it('makes the summary an index, with one card per stage it can reach', () => {
    const html = renderReportHtml(report());
    const jumps = [...html.matchAll(/<button class="jump"[^>]*data-step="([a-z]+)"/g)].map((match) => match[1]);

    expect(jumps).toEqual(['signals', 'evidence', 'market', 'audit']);
    for (const jump of jumps) expect(html).toContain(`id="pane-${jump}"`);
    // The insights duplicated the composition stage, so they are gone rather than restyled.
    expect(html).not.toContain('class="insight"');
    expect(html).not.toContain('Explorar evidencia ↓');
  });

  it('splits the signals into shares that add up to what was found', () => {
    const html = renderReportHtml(reportWithManyRules(20));
    // Bounded by the paper: the printable summary carries the same graphics again.
    const board = html.slice(html.indexOf('class="board"'), html.indexOf('<article class="paper"'));
    const shares = [...board.matchAll(/class="rank-share">(\d+)%/g)].map((match) => Number(match[1]));

    expect(shares.reduce((sum, share) => sum + share, 0)).toBeGreaterThanOrEqual(99);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeLessThanOrEqual(101);
    // A lane with nothing in it gets no bar at all: a stub would draw a quantity that is not there.
    expect(board.match(/class="rank-track">\s*<\/span>/g)?.length).toBe(1);
  });

  it('draws one ring arc per source that actually returned something', () => {
    const built = reportWithManyRules(20);
    const html = renderReportHtml(built);
    // Bounded by the paper: the printable summary carries the same graphics again.
    const board = html.slice(html.indexOf('class="board"'), html.indexOf('<article class="paper"'));

    // SIEM, CNBV and Banxico answered; DOF did not.
    expect(board.match(/class="ring-arc/g)).toHaveLength(3);
    // Read from the report, not typed in: the fixture's total is whatever it built.
    expect(board).toContain(`<text class="ring-n" x="60" y="58">${built.signals.length}</text>`);
  });

  it('keeps the chart true without the script, and only animates on top of it', () => {
    const html = renderReportHtml(report());

    // The bar carries its real length in CSS; the script rewinds it to play it forwards.
    expect(html).toContain('.rank-bar{display:block;height:100%;border-radius:5px;width:var(--w)');
    expect(html).not.toMatch(/\.rank-bar\{[^}]*width:0/);
    expect(html).not.toMatch(/\.ring-arc\{[^}]*opacity:0/);
  });

  it('hands the whole report to the share sheet, and falls back to text', () => {
    const html = renderReportHtml(report());
    const share = /window\.CREVA_SHARE=(\{.*?\});window\.CREVA_REPORT/.exec(html)?.[1] ?? '';

    expect(JSON.parse(share).file).toBe('creva-abarrotes-erendira'.replace('abarrotes-erendira', 'estetica-anita'));
    expect(html).toContain('navigator.canShare({files:[file]})');
    expect(html).toContain("window.open('https://wa.me/?text='");
  });

  it('says it in pictures: two pages, no table at all, and few words', () => {
    const html = renderReportHtml(reportWithManyRules(20));
    // Bounded at both ends on purpose, and the far end has to exist: slicing to the end of
    // the file swept the inline script into the word count once already.
    const start = html.indexOf('<article class="paper"');
    const end = html.indexOf('</article>', start);

    expect(end).toBeGreaterThan(start);
    const paper = html.slice(start, end);

    expect(paper).not.toContain('<table');
    // Prose is what the graphics replaced, so the word count is part of the contract.
    const words = paper
      .replace(/<[^>]+>/g, ' ')
      .trim()
      .split(/\s+/).length;
    expect(words).toBeLessThan(260);

    for (const graphic of ['p-kpi', 'p-date', 'p-ring', 'p-ranked', 'p-tl-dot', 'p-ev', 'p-rate', 'p-src', 'p-limits']) {
      expect(paper).toContain(`class="${graphic}`);
    }
    expect(paper.match(/class="ring-arc/g)?.length).toBeGreaterThan(0);
    // The source map printed the same four counts the ring and the bars already carry.
    expect(paper).not.toContain('p-node');
    // Three cards, not two per lane: eight of them was the repetition the reader saw.
    expect(paper.match(/class="p-ev"/g)).toHaveLength(3);
  });

  it('lets a chosen source quiet the rest of the timeline', () => {
    const html = renderReportHtml(reportWithManyRules(20));

    // Every dot is a control that names its lane, which is what the script dims and picks against.
    expect(html).toMatch(/<button class="tl-dot d\d[^"]*" data-lane="[a-z]+"/);
    expect(html).toContain('id="tl-count"');
    expect(html).toContain("dot.classList.toggle('muted',out)");
  });

  it('gives the timeline a row and a filter per source that actually carries dates', () => {
    const html = renderReportHtml(reportWithManyRules(20));

    // DOF returned nothing in this fixture, so it earns neither a row nor a filter.
    expect(html.match(/class="tl-name d\d"/g)).toEqual([
      'class="tl-name d0"',
      'class="tl-name d2"',
      'class="tl-name d3"',
    ]);
    expect([...html.matchAll(/data-tlfilter="([a-z]+)"/g)].map((match) => match[1])).toEqual([
      'all',
      'siem',
      'cnbv',
      'banxico',
    ]);
    expect(html.match(/class="tl-track"/g)).toHaveLength(3);
  });

  it('opens the timeline already showing its most recent signal, before any script runs', () => {
    const html = renderReportHtml(report());

    // The static file must already state the truth: the script only moves the choice.
    expect(html.match(/class="tl-dot d\d picked"/g)).toHaveLength(1);
    expect(html).toContain('<p class="tl-detail-text" id="tl-detail-text">6.7358%</p>');
    expect(html).toContain('id="tl-detail-chip">BANXICO</span>');
  });

  it('keeps every timeline year label inside the axis it labels', () => {
    // The real corpus of standing rules runs from 2012, so the axis has years to name.
    const html = renderReportHtml(reportAcrossYears());
    const ticks = [...html.matchAll(/class="tl-tick[^"]*" style="left:([\d.]+)%"/g)].map((match) => Number(match[1]));

    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(Math.min(...ticks)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ticks)).toBeLessThanOrEqual(100);
  });

  it('names dates instead of years when everything happened inside one year', () => {
    // "2026 … 2026" would label nothing, so the axis falls back to the two full dates.
    const html = renderReportHtml(reportWithManyRules(20));

    expect(html).not.toContain('class="tl-tick');
    expect(html).toContain('<div class="tl-ends">');
    expect(html).toContain('de agosto de 2026');
  });

  it('lets the narrow screen beat the two-column default, not the other way round', () => {
    const html = renderReportHtml(report());
    // Same specificity, so source order decides. Written above the base rule, the override
    // lost and a 375px phone kept a 200px-wide evidence list.
    const base = html.indexOf('.ev-board{display:grid');
    const override = html.indexOf('.ev-board{grid-template-columns:1fr}');

    expect(base).toBeGreaterThan(-1);
    expect(override).toBeGreaterThan(base);
  });

  it('drills into one signal without leaving the evidence stage', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('class="ev-board"');
    expect(html).toContain('id="ev-detail"');
    // Each item carries what the detail reads, and its own control to choose it.
    expect(html).toContain('<button class="item-pick" type="button">');
    expect(html).toContain('data-source="Directorio oficial de establecimientos (SIEM)"');
    expect(html).toContain("pickEvidence(pick.closest('.item'))");
    // Choosing is not navigating: nothing here scrolls or changes stage.
    expect(html).not.toMatch(/pickEvidence\([^)]*\);\s*goToStage/);
  });

  it('announces the total only after the network has finished fading, never over it', () => {
    const html = renderReportHtml(report());
    const cleared = Number(
      /investigate\.classList\.add\('cleared'\);[\s\S]*?\},settled\+(\d+)\);/.exec(html)?.[1] ?? 0,
    );
    const fade = Number(/\.investigate \.net,[^{]*\{transition:opacity (\d+)ms/.exec(html)?.[1] ?? 0);
    const flash = Number(/flash\.classList\.add\('on'\);\},settled\+(\d+)\)/.exec(html)?.[1] ?? 0);

    expect(cleared).toBeGreaterThan(0);
    expect(fade).toBeGreaterThan(0);
    // The gap is the whole point of the scene: the tree has to be gone before the number lands.
    expect(flash).toBeGreaterThanOrEqual(cleared + fade + 200);
  });

  it('holds the total on screen long enough to be read', () => {
    const html = renderReportHtml(report());
    const on = Number(/flash\.classList\.add\('on'\);\},settled\+(\d+)\)/.exec(html)?.[1] ?? 0);
    const off = Number(/investigate\.classList\.add\('collapse'\);[\s\S]*?\},settled\+(\d+)\);/.exec(html)?.[1] ?? 0);

    expect(off - on).toBeGreaterThanOrEqual(2000);
  });

  it('places every timeline dot inside the span it prints', () => {
    const paper = renderReportHtml(reportWithManyRules(20)).match(/<div class="p-tl">[\s\S]*?<\/div>/)?.[0] ?? '';
    const positions = [...paper.matchAll(/left:([\d.]+)%/g)].map((match) => Number(match[1]));

    expect(positions.length).toBeGreaterThan(1);
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...positions)).toBeLessThanOrEqual(100);
  });

  it('shows when the report was taken and how far back it looked', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('Consultado el');
    expect(html).toContain('Ventana revisada');
    expect(html).toContain('13 de agosto de 2026');
  });

  it('leads the summary with figures that carry their own source', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('Fuentes consultadas');
    expect(html).toContain('Sello del directorio');
    expect(html).toContain('TIIE a 28 días');
    // No trend, no delta: the report holds one observation per figure, not a series.
    expect(html).not.toMatch(/[+-]\d+(\.\d+)?%\s*(vs|respecto)/i);
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
