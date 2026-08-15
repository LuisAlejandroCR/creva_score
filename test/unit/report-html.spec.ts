import { buildReport } from '../../src/modules/creva-score/creva-report.builder';
import { buildScoreDisclosure } from '../../src/modules/score-disclosure/score-disclosure.service';
import { moreLabel, nextVisible, renderReportHtml } from '../../src/cli/report';
import { reportShape, signalSplit, summaryKpis } from '../../src/cli/report/sections';
import { buildLanes } from '../../src/cli/report/lanes';
import { script } from '../../src/cli/report/script';
import ts from 'typescript';
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
        // Real CNBV entries carry a document; the badge and the rates do not, which is
        // what lets one fixture cover both the linked row and the inert one.
        url: `https://www.cnbv.gob.mx/norma-${i}`,
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

  it('lands the announced total in the middle of the ring, never on a second card', () => {
    const built = report();
    const html = renderReportHtml(built);
    const app = html.slice(0, html.indexOf('<article class="paper"'));

    // The intro's figure travels into the ring centre. A KPI card saying the same number
    // beside it was the second "25 señales" the reader was seeing.
    expect(html).toContain(`id="kpi-count" data-count="${built.signals.length}"`);
    expect(app).toMatch(/<text class="ring-n" x="60" y="\d+" id="kpi-count"/);
    expect(app).not.toContain('<p class="kpi-label">Señales</p>');
    expect(html).toContain("var figure=document.getElementById('kpi-count')");
  });

  it('states each summary figure once, and draws no chart a stage already draws', () => {
    const built = report();
    const html = renderReportHtml(built);
    const app = html.slice(0, html.indexOf('<article class="paper"'));
    const summary = app.slice(app.indexOf('id="pane-summary"'), app.indexOf('id="pane-signals"'));
    const documented = built.signals.filter((signal) => signal.evidence_url !== null).length;

    // One ring in the whole application, and it is the landing. Anchored to the <svg>:
    // "ring" is also the prefix of ring-track, ring-arc, ring-n and ring-l.
    expect(app.match(/<svg class="ring/g)).toHaveLength(1);
    expect(summary).toContain('<svg class="ring big"');
    // Name and seal live in the bar permanently, so the summary must not repeat them.
    expect(summary).not.toContain('class="subject big"');
    expect(summary).not.toContain('class="status pill-');
    // The doors carry figures the KPI strip does not: documented evidence, declared limits.
    expect(summary).toContain(`class="jump-figure">${documented}<`);
    expect(summary).toContain('con documento oficial');
    expect(summary).toContain(`class="jump-figure">${built.disclosure.does_not_estimate.length}<`);
  });

  it('gives the landing figure its turning circle, and gives it to nothing else', () => {
    const html = renderReportHtml(report());
    const start = html.indexOf('<article class="paper"');
    const paper = html.slice(start, html.indexOf('</article>', start));

    // One gradient definition in the document, so its id cannot collide with the
    // printable's ring, which keeps flat colour because a printer has no animation.
    expect(html.match(/id="ring-fill"/g)).toHaveLength(1);
    expect(html.match(/class="ring-dash"/g)).toHaveLength(1);
    expect(html.match(/class="ring-glow"/g)).toHaveLength(1);
    expect(paper).not.toContain('ring-dash');
    expect(paper).not.toContain('ring-fill');
    // The digits fill and the circle turns: both belong to the landing only.
    expect(html).toMatch(/\.ring\.big \.ring-n\{[^}]*fill:url\(#ring-fill\)/);
    expect(html).toMatch(/\.ring-dash\{[^}]*animation:ringSpin/);
    expect(html).toMatch(/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\.ring-dash,[\s\S]*?animation:none/);
  });

  it('says the ranked rows are the filter, because nothing else says it', () => {
    const html = renderReportHtml(report());
    const app = html.slice(0, html.indexOf('<article class="paper"'));

    // Merging the stages left one selector; without a hint its rows read as a static
    // chart, and the evidence below looks unfilterable.
    expect(app).toContain('class="hint"');
    expect(app).toContain('Toca una fuente para filtrar la línea de tiempo y la evidencia de abajo.');
    expect(app.indexOf('¿De qué fuente salió cada señal?')).toBeLessThan(app.indexOf('class="hint"'));
    expect(app.indexOf('class="hint"')).toBeLessThan(app.indexOf('<div class="ranked"'));
  });

  it('draws the coverage of the sources instead of only naming it', () => {
    const built = report();
    const lanes = buildLanes(built);
    const html = renderReportHtml(built);
    const answered = lanes.filter((lane) => lane.signals.length > 0).length;
    const app = html.slice(0, html.indexOf('<article class="paper"'));

    expect(app.match(/class="cell"/g)?.length).toBe(lanes.length - answered);
    expect(app.match(/class="cell lit"/g)).toHaveLength(answered);
    expect(app).toContain(`<p class="kpi-sub">${answered} devolvieron algo</p>`);
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

  it('offers exactly one source selector, and it is the ranked list', () => {
    const html = renderReportHtml(report());
    const app = html.slice(0, html.indexOf('<article class="paper"'));
    const rows = app.match(/<button class="rank a\d"[^>]*>/g) ?? [];

    // Three controls used to select the same four sources: the ranked rows, the timeline
    // chips and the evidence filters. Only the rows are left.
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row).toContain('aria-pressed="false"');
    for (const lane of ['siem', 'dof', 'cnbv', 'banxico']) {
      expect(app).toContain(`data-lane="${lane}"`);
    }
    expect(app).not.toContain('data-filter=');
    expect(app).not.toContain('data-tlfilter=');
    expect(app).toContain('id="rank-clear"');
  });

  it('makes the row itself the way to the document, with nothing in between', () => {
    const html = renderReportHtml(reportWithManyRules(18));
    const app = html.slice(0, html.indexOf('<article class="paper"'));
    const linked = /<div class="item [\s\S]*?<a class="item-pick"[\s\S]*?\n<\/div>/.exec(app)?.[0] ?? '';

    // A modal for a hyperlink is friction: open, read, click, close, find your place.
    // Neither the dialog nor the parked side card survives.
    expect(app).not.toContain('<dialog');
    expect(app).not.toContain('Señal seleccionada');
    expect(app).not.toContain('class="ev-board"');
    expect(app).not.toContain('id="tl-detail"');

    // A row is two lines and one link: what it says, when it is from, and out.
    expect(linked).toContain('target="_blank" rel="noopener"');
    expect(linked).toContain('class="item-detail"');
    expect(linked).toContain('documento oficial');
    expect(linked).not.toContain('class="item-label"');
    expect(app).not.toContain('aria-haspopup');
  });

  it('never dresses a signal without a document as a link', () => {
    const html = renderReportHtml(reportWithManyRules(18));
    const app = html.slice(0, html.indexOf('<article class="paper"'));
    // The badge and Banxico's rates carry no document, so those rows must not look clickable.
    const rows = [...app.matchAll(/<div class="item [\s\S]*?\n<\/div>/g)].map((match) => match[0]);
    const inert = rows.filter((row) => row.includes('class="item-pick inert"'));

    expect(rows.length).toBeGreaterThan(inert.length);
    expect(inert.length).toBeGreaterThan(0);
    for (const row of inert) {
      expect(row).toContain('sin documento');
      expect(row).not.toContain('<a class="item-pick"');
    }
    expect(app).toMatch(/\.item-pick\.inert\{cursor:default\}/);
  });

  it('sends a timeline dot to the row that already holds its record', () => {
    const built = reportWithManyRules(18);
    const html = renderReportHtml(built);
    const app = html.slice(0, html.indexOf('<article class="paper"'));
    const keys = [...app.matchAll(/<button class="tl-dot[^>]*data-key="([^"]+)"/g)].map((match) => match[1]);

    expect(keys.length).toBeGreaterThan(1);
    // Every dot must land on a row that exists, or clicking it would do nothing at all.
    for (const key of keys) expect(app).toContain(`data-key="${key}"`);
    expect(html).toContain("revealSignal(tlDot.getAttribute('data-key'))");
    // A folded row is revealed the way the reader would, so the counter stays honest.
    expect(html).toContain('showMore(panel);guard+=1;');
    // The dot no longer carries a copy of the record; the row is the only place it lives.
    expect(app).not.toMatch(/<button class="tl-dot[^>]*data-source=/);
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

  it('drops the narration that restated the stages, and calls nothing that is gone with it', () => {
    const html = renderReportHtml(report());

    // "Por qué importa" retold what the lanes already show, and the closing block
    // repeated the hero tally. Both are gone, markup and stylesheet together.
    expect(html).not.toContain('Por qué importa');
    expect(html).not.toContain('why-step');
    expect(html).not.toContain('closing-tally');
    // The handler for that block was called but never defined: opening Auditoría threw
    // ReferenceError, which left the stage marks stale and the read indicator unset.
    expect(html).not.toContain('runWhy');
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

    // Señales and Evidencia were the same question split across a stage boundary: the
    // same four counts, three selectors for four sources and two detail cards.
    expect(stages).toEqual(['summary', 'signals', 'market', 'audit']);
    for (const stage of stages) {
      expect(html).toContain(`aria-controls="pane-${stage}"`);
      expect(html).toContain(`id="pane-${stage}"`);
      expect(html).toContain(`aria-labelledby="tab-${stage}"`);
    }
    for (const name of ['Resumen', 'Señales', 'Mercado', 'Auditoría']) {
      expect(html).toContain(name);
    }
    // The numbers are derived from the order, so dropping a stage cannot leave a gap.
    expect([...html.matchAll(/<span class="stage-num">(\d+)<\/span>/g)].map((m) => m[1])).toEqual([
      '01',
      '02',
      '03',
      '04',
    ]);
  });

  it('opens on the first stage and leaves the rest out of the way', () => {
    const html = renderReportHtml(report());
    const panes = html.match(/<section class="pane"[^>]*>/g) ?? [];

    expect(panes).toHaveLength(4);
    expect(panes.filter((pane) => pane.includes(' hidden'))).toHaveLength(3);
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
    expect(html.match(/<section class="pane"[^>]*>/g)).toHaveLength(3);
    expect([...html.matchAll(/<span class="stage-num">(\d+)<\/span>/g)].map((m) => m[1])).toEqual(['01', '02', '03']);
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

  it('hands off from one stage to the next in a line the reader can follow', () => {
    const html = renderReportHtml(report());
    const app = html.slice(0, html.indexOf('<article class="paper"'));
    const signalsPane = app.slice(app.indexOf('id="pane-signals"'), app.indexOf('id="pane-market"'));

    // B90 removed the descriptive blurbs, which restated the heading. These are the
    // opposite: each one says what just happened and what the next stage answers.
    expect(app.match(/class="lead"/g)).toHaveLength(4);
    expect(signalsPane).toContain('Elige una fuente para seguirla hasta su documento');
    expect(app).toContain('class="lead-go" type="button" data-step="signals"');
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

  it('keeps the timeline on screen and off the printable', () => {
    const html = renderReportHtml(reportWithManyRules(20));

    expect(html).toContain('class="tl"');
    expect(html.match(/class="tl-dot/g)?.length).toBeGreaterThan(1);
    // Twenty-five dots over fourteen years is an instrument to explore, not a figure to
    // read once on paper. The printable is an executive summary; it does not carry it.
    expect(html).not.toContain('p-tl');
  });

  it('folds every source past the first few without dropping a single item', () => {
    const html = renderReportHtml(reportWithManyRules(18));
    const cnbvPanel = html.slice(html.indexOf('id="lane-cnbv"'), html.indexOf('id="lane-banxico"'));

    // All 18 stay in the document; 15 of them simply start folded. Counting bare
    // " hidden>" measured a wider region than the rule: the year-slice empty message is
    // also hidden at rest, and it is not an item.
    const folded = [...cnbvPanel.matchAll(/<div class="item [^>]*>/g)].filter((match) => match[0].endsWith(' hidden>'));

    expect(cnbvPanel.match(/class="item /g)).toHaveLength(18);
    expect(folded).toHaveLength(15);
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

    expect(jumps).toEqual(['signals', 'market', 'audit']);
    for (const jump of jumps) expect(html).toContain(`id="pane-${jump}"`);
    // The insights duplicated the composition stage, so they are gone rather than restyled.
    expect(html).not.toContain('class="insight"');
    expect(html).not.toContain('Explorar evidencia ↓');
  });

  it('splits the signals into shares that add up to what was found', () => {
    const html = renderReportHtml(reportWithManyRules(20));
    // Bounded at both ends, and the far end has to exist: the printable carries the same
    // graphics again, and slicing past it counted every bar twice.
    const start = html.indexOf('<div class="ranked"');
    const end = html.indexOf('<article class="paper"');

    expect(end).toBeGreaterThan(start);
    const ranked = html.slice(start, end);
    const shares = [...ranked.matchAll(/class="rank-share">(\d+)%/g)].map((match) => Number(match[1]));

    expect(shares.reduce((sum, share) => sum + share, 0)).toBeGreaterThanOrEqual(99);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeLessThanOrEqual(101);
    // A lane with nothing in it gets no bar at all: a stub would draw a quantity that is not there.
    expect(ranked.match(/class="rank-track">\s*<\/span>/g)?.length).toBe(1);
  });

  it('draws one ring arc per source that actually returned something', () => {
    const built = reportWithManyRules(20);
    const html = renderReportHtml(built);
    const start = html.indexOf('<div class="landing-ring"');
    const end = html.indexOf('</svg>', start);

    expect(end).toBeGreaterThan(start);
    const landing = html.slice(start, end);

    // SIEM, CNBV and Banxico answered; DOF did not.
    expect(landing.match(/class="ring-arc/g)).toHaveLength(3);
    // Read from the report, not typed in: the fixture's total is whatever it built.
    expect(landing).toContain(`data-count="${built.signals.length}">${built.signals.length}</text>`);
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
    expect(words).toBeLessThan(240);

    for (const graphic of ['p-kpi', 'p-date', 'p-ring', 'p-ranked', 'p-ev', 'p-rate', 'p-src', 'p-limits']) {
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
    expect(html).toContain("dot.classList.toggle('muted',out)");
    // One selection drives all three: the rows, the timeline and the evidence list.
    expect(html).toContain('focusTimeline(lane);');
    expect(html).toContain('filterEvidence(lane,picked);');
  });

  it('slices the timeline by a range of years, not by a control per year', () => {
    const built = reportAcrossYears();
    const html = renderReportHtml(built);
    const app = html.slice(0, html.indexOf('<article class="paper"'));
    const years = (/data-years="([^"]+)"/.exec(app)?.[1] ?? '').split(',').map(Number);

    // Twelve years for twenty-five signals is twelve checkboxes or thirteen chips, most
    // of them revealing one dot. Years are an axis: a reader asks for a span.
    expect(app).toContain('id="tl-slice"');
    expect(years.length).toBeGreaterThan(2);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
    // Only years that hold a signal, so a handle can never land on an empty one.
    const dated = new Set(built.signals.filter((s) => s.checked_at !== null).map((s) => Number(s.checked_at?.slice(0, 4))));
    for (const year of years) expect(dated.has(year)).toBe(true);

    // Two handles on one rail, each a native range with its year spoken aloud.
    const handles = [...app.matchAll(/<input class="tl-slice-in"[^>]*>/g)].map((match) => match[0]);

    expect(handles).toHaveLength(2);
    expect(handles[0]).toContain('aria-label="Desde el año"');
    expect(handles[1]).toContain('aria-label="Hasta el año"');
    expect(handles[0]).toContain(`aria-valuetext="${years[0]}"`);
    expect(handles[1]).toContain(`aria-valuetext="${years[years.length - 1]}"`);
    // The static file must already show the full span selected, never an empty rail.
    expect(app).toContain('style="--a:0%;--b:100%"');
    expect(app).toContain(`<span>${years[0]}</span><span>${years[years.length - 1]}</span>`);

    // Source and year are two dimensions of one view; muting composes, never replaces.
    expect(html).toContain('year<yearFrom||year>yearTo');
    expect(html).toContain("dot.getAttribute('data-lane')!==laneFilter");

    // Measured by hit-testing the running page: ::after paints after the inputs, so the
    // shaded rail sat on top of both thumbs and neither could be grabbed. Only the thumbs
    // may take the pointer, or the upper input swallows the lower one's handle.
    expect(html).toMatch(/\.tl-slice-rails::before,\.tl-slice-rails::after\{[^}]*pointer-events:none/);
    expect(html).toMatch(/\.tl-slice-in\{[^}]*pointer-events:none/);
    expect(html).toMatch(/::-webkit-slider-thumb\{[^}]*pointer-events:auto/);
    expect(html).toMatch(/::-moz-range-thumb\{[^}]*pointer-events:auto/);
  });

  it('lets the year slice govern the whole stage, not only the chart', () => {
    const html = renderReportHtml(reportAcrossYears());
    const app = html.slice(0, html.indexOf('<article class="paper"'));

    // It sits with the source selector, above the bars, because it narrows everything
    // below it. Inside the timeline card it read as a control for the chart alone.
    expect(app.indexOf('class="hint"')).toBeLessThan(app.indexOf('id="tl-slice"'));
    expect(app.indexOf('id="tl-slice"')).toBeLessThan(app.indexOf('<div class="ranked"'));
    expect(app.indexOf('id="tl-slice"')).toBeLessThan(app.indexOf('class="card tl-card"'));
    expect(app).toContain('El rango de años recorta esta pantalla entera.');

    // The bars, the evidence and the fold arithmetic all read the sliced list, or the
    // chart would state a quantity the list below no longer shows.
    expect(html).toContain('function inSlice(item)');
    expect(html).toContain(".filter(inSlice)");
    expect(html).toContain('function rerank()');
    expect(html).toContain('rerank();');
    // A lane emptied by the years is a different sentence from a lane that gave nothing.
    expect(app).toContain('Ninguna señal de esta fuente en los años elegidos.');
    expect(app.match(/class="empty sliced" hidden/g)?.length).toBe(4);
  });

  it('never lets the slice invert when the handles cross', () => {
    const html = renderReportHtml(reportAcrossYears());
    // Measured: dragging the far handle past the near one swaps them, it does not produce
    // a backwards range that would quietly mute every dot.
    expect(html).toContain('if(a>b){var swap=a;a=b;b=swap;');
  });

  it('lets the years be typed as well as dragged', () => {
    const html = renderReportHtml(reportAcrossYears());
    const app = html.slice(0, html.indexOf('<article class="paper"'));
    const fields = [...app.matchAll(/<input class="tl-year-in"[^>]*>/g)].map((match) => match[0]);
    const years = (/data-years="([^"]+)"/.exec(app)?.[1] ?? '').split(',').map(Number);

    expect(fields).toHaveLength(2);
    for (const field of fields) {
      expect(field).toContain('type="number"');
      expect(field).toContain('inputmode="numeric"');
      expect(field).toContain(`min="${years[0]}"`);
      expect(field).toContain(`max="${years[years.length - 1]}"`);
    }
    // The static file already states the full span, before any script runs.
    expect(fields[0]).toContain(`value="${years[0]}"`);
    expect(fields[1]).toContain(`value="${years[years.length - 1]}"`);
    // Each field is labelled for a screen reader without printing the label twice.
    expect(app.match(/<span class="sr-only">Desde el año<\/span>/g)).toHaveLength(1);
    expect(app.match(/<span class="sr-only">Hasta el año<\/span>/g)).toHaveLength(1);

    // A year the corpus does not hold still has a meaning: snap outward, never refuse.
    expect(html).toContain('function typedSlice()');
    expect(html).toContain('if(years[k]>=a)');
    expect(html).toContain('if(years[k]<=b)');
    // change, not input: a number field fires per keystroke and would snap on "2".
    expect(html).toMatch(/document\.addEventListener\('change',function\(e\)\{[\s\S]{0,140}?tl-year-in/);
    expect(html).not.toMatch(/document\.addEventListener\('input',function\(e\)\{[\s\S]{0,140}?tl-year-in/);
  });

  it('offers no year control when there is only one year to choose', () => {
    // "2026 … 2026" slices nothing, and an inert control is worse than none.
    expect(renderReportHtml(reportWithManyRules(20))).not.toContain('id="tl-slice"');
  });

  it('puts a way back to the top only where the reader can get stranded', () => {
    const html = renderReportHtml(report());
    const app = html.slice(0, html.indexOf('<article class="paper"'));
    const signalsPane = app.slice(app.indexOf('id="pane-signals"'), app.indexOf('id="pane-market"'));
    const marketPane = app.slice(app.indexOf('id="pane-market"'), app.indexOf('id="pane-audit"'));

    // Señales measured 2360px on a phone; the other stages are 369–619px.
    expect(app.match(/class="to-top"/g)).toHaveLength(1);
    expect(signalsPane).toContain('class="to-top"');
    expect(marketPane).not.toContain('class="to-top"');
    expect(html).toContain("t.closest('.to-top')");
  });

  it('previews a dot before the click spends the reader position', () => {
    const html = renderReportHtml(reportAcrossYears());
    const app = html.slice(0, html.indexOf('<article class="paper"'));

    // Clicking a dot now scrolls to its row, so the reader needs to know where it goes
    // before paying for it. Focus fills the same line, so the keyboard is not left out.
    expect(app).toContain('id="tl-peek"');
    expect(app).toContain('Pasa el cursor por un punto para verlo');
    expect(html).toContain("['mouseover','focusin']");
    expect(html).toContain("['mouseout','focusout']");
    // A fixed line under the chart, never a floating panel over the dots it explains.
    expect(html).toMatch(/\.tl-peek\{[^}]*min-height:2\.6rem/);
    expect(html).not.toMatch(/\.tl-peek\{[^}]*position:(absolute|fixed)/);
    // Its content comes from the dot, and every dot has to carry it.
    for (const attr of ['data-short=', 'data-when=', 'data-detail=', 'data-year=']) {
      expect(/<button class="tl-dot[\s\S]{0,460}?<\/button>/.exec(app)?.[0]).toContain(attr);
    }
  });

  it('gives the timeline a row per source that actually carries dates', () => {
    const html = renderReportHtml(reportWithManyRules(20));

    // DOF returned nothing in this fixture, so it earns no row.
    expect(html.match(/class="tl-name d\d"/g)).toEqual([
      'class="tl-name d0"',
      'class="tl-name d2"',
      'class="tl-name d3"',
    ]);
    expect(html.match(/class="tl-track"/g)).toHaveLength(3);
  });

  it('marks its most recent signal before any script runs, and marks only one', () => {
    const built = report();
    const html = renderReportHtml(built);
    const newest = built.signals
      .filter((signal) => signal.checked_at !== null)
      .reduce((top, signal) => ((signal.checked_at as string) > (top.checked_at as string) ? signal : top));

    // The static file must already state the truth; the script only moves the choice.
    const picked = /<button class="tl-dot d\d picked"[^>]*data-key="([^"]+)"/.exec(html)?.[1];

    expect(html.match(/class="tl-dot d\d picked"/g)).toHaveLength(1);
    expect(picked).toBe(newest.key);
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
    // lost and a 375px phone kept a 200px-wide evidence list. The evidence board is gone,
    // but the landing is the same shape of rule and inherits the same trap.
    const base = html.indexOf('.landing{display:grid');
    const override = html.indexOf('.landing{grid-template-columns:1fr');

    expect(base).toBeGreaterThan(-1);
    expect(override).toBeGreaterThan(base);
  });

  it('lets the rail shrink, so it cannot widen the page on a phone', () => {
    const html = renderReportHtml(report());
    // A grid item defaults to min-width:auto and refuses to go below its content width.
    // Without this the rail pushed the document 43px past a 375px screen.
    const rail = /\.rail\{([^}]*)\}/.exec(html)?.[1] ?? '';

    expect(rail).toContain('min-width:0');
    expect(html).toMatch(/\.panes\{[^}]*min-width:0/);
  });

  it('follows a document without leaving the stage behind', () => {
    const html = renderReportHtml(reportWithManyRules(18));

    // Following the link is the act worth marking; nothing else earns the tick.
    expect(html).toContain("if(row&&pick.tagName==='A')row.classList.add('seen')");
    // Choosing is not navigating: nothing here changes stage.
    expect(html).not.toMatch(/revealSignal\([^)]*\);\s*goToStage/);
    expect(html).not.toMatch(/pickDot\([^)]*\);\s*goToStage/);
    // Filtering re-marks the newest dot of the lane; it must not scroll the page.
    expect(html).toMatch(/pickDot\(picked\);/);
    expect(html).not.toMatch(/pickDot\(picked\);revealSignal/);
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

  it('says the total in one place, and puts it away before the scene moves', () => {
    const html = renderReportHtml(report());
    const investigate = /\n\.investigate\{([^}]*)\}/.exec(html)?.[1] ?? '';

    // Measured before the fix: the flash sat at 404px, drifted to 604px and then jumped
    // to 128px at full opacity. .flash is absolute, .investigate was not positioned, so
    // it anchored to main until .collapse's transform made the scene the containing
    // block mid-animation. One line settles it; without it the line reads as a second
    // announcement of the same number.
    expect(investigate).toContain('position:relative');
    expect(html).toMatch(/\.flash\{position:absolute/);
    // The rect is read while the line is still up, and the line goes away in the same
    // frame the collapse starts — never 700ms later, on top of a transformed scene.
    const collapse = /var from=flash\?flash\.getBoundingClientRect\(\):null;([\s\S]{0,200}?)travelIntoFigure/.exec(
      html,
    )?.[1];

    expect(collapse).toContain("flash.classList.remove('on')");
    expect(collapse).toContain("investigate.classList.add('collapse')");
    expect(html).not.toMatch(/travelIntoFigure\([\s\S]{0,120}?flash\.classList\.remove/);
  });

  it('places every timeline dot inside the span it draws', () => {
    const built = reportWithManyRules(20);
    const html = renderReportHtml(built);
    // Each button is matched whole, then read: a fixed-width window silently stopped
    // matching the moment the dot gained the attributes the preview line needs.
    const positions = [...html.matchAll(/<button class="tl-dot[\s\S]*?<\/button>/g)].map((match) =>
      Number(/style="left:([\d.]+)%/.exec(match[0])?.[1]),
    );

    // One dot per dated signal: none dropped, none invented.
    expect(positions).toHaveLength(built.signals.filter((signal) => signal.checked_at !== null).length);
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...positions)).toBeLessThanOrEqual(100);
  });

  it('shows when the report was taken and how far back it looked, out of the reading column', () => {
    const html = renderReportHtml(report());
    const rail = html.slice(html.indexOf('class="rail"'), html.indexOf('class="panes"'));

    // The two dates sit in the rail beside the stages, not stacked in the summary.
    expect(rail).toContain('Consultado');
    expect(rail).toContain('Ventana');
    expect(rail).toContain('13 de agosto de 2026');
    expect(rail).toContain('30 días');
  });

  it('leads the summary with figures that carry their own source', () => {
    const html = renderReportHtml(report());

    expect(html).toContain('<p class="kpi-label">Fuentes</p>');
    expect(html).toContain('<p class="kpi-label">Directorio</p>');
    expect(html).toContain('TIIE a 28 días');
    // No trend, no delta: the report holds one observation per figure, not a series.
    expect(html).not.toMatch(/[+-]\d+(\.\d+)?%\s*(vs|respecto)/i);
  });

  it('prints the same figures the screen leads with, from one definition', () => {
    const built = report();
    const html = renderReportHtml(built);
    const start = html.indexOf('<article class="paper"');
    const end = html.indexOf('</article>', start);

    expect(end).toBeGreaterThan(start);
    const paper = html.slice(start, end);
    const kpis = summaryKpis(built, buildLanes(built));

    expect(kpis).toHaveLength(3);
    // The paper used to compute its own KPIs and had already drifted: it said "3/4
    // respondieron" where the screen said "4 registros de gobierno".
    for (const kpi of kpis) {
      expect(paper).toContain(`<p class="p-kpi-label">${kpi.label}</p>`);
      expect(paper).toContain(`<p class="p-kpi-value">${kpi.value}</p>`);
      expect(html).toContain(`<p class="kpi-label">${kpi.label}</p>`);
      if (kpi.sub !== null) expect(paper).toContain(`<p class="p-kpi-sub">${kpi.sub}</p>`);
    }
  });

  it('counts the investigation out loud without inventing a source', () => {
    const built = report();
    const html = renderReportHtml(built);

    expect(html.match(/class="tick"/g)).toHaveLength(4);
    expect(html).toContain('fuentes conectadas');
    expect(html).toContain(`<strong>${built.signals.length}</strong> señales encontradas`);
  });

  it('never calls a function the inlined script does not define', () => {
    // The browser script ships as a template string, so the compiler cannot see it.
    // `runWhy()` survived a rename that way: it threw ReferenceError the first time a
    // reader opened Auditoría, which left the stage marks stale and the read bar unset.
    // Parsed, not pattern-matched. Regex kept mistaking a comment apostrophe, a regex
    // literal and CSS inside a string for code, which is how this check first passed
    // while the defect was still there.
    const source = ts.createSourceFile('report.js', script(), ts.ScriptTarget.ES5, true, ts.ScriptKind.JS);

    expect(renderReportHtml(report())).toContain(script());

    const known = new Set([
      'setTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'parseInt', 'parseFloat',
      'String', 'Number', 'Boolean', 'File', 'Date', 'Math', 'JSON', 'encodeURIComponent', 'isNaN',
    ]);
    const defined = new Set<string>();
    const called = new Set<string>();

    const walk = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name !== undefined) defined.add(node.name.text);
      // A parameter is a definition too: travelIntoFigure(done) calls its own argument.
      if (ts.isParameter(node) && ts.isIdentifier(node.name)) defined.add(node.name.text);
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) defined.add(node.name.text);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) called.add(node.expression.text);
      ts.forEachChild(node, walk);
    };
    walk(source);

    expect([...called].filter((name) => !known.has(name) && !defined.has(name))).toEqual([]);
    // Control: the check has teeth only if it really sees both sides.
    expect(defined.has('goToStage')).toBe(true);
    expect(called.has('revealSignal')).toBe(true);
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
  const folder = String.raw`C:\Users\x\Downloads\Creva_Score_acme_2026-08-14T21-30-05Z`;
  const html = String.raw`C:\Users\x\Downloads\Creva_Score_acme_2026-08-14T21-30-05Z\creva-reporte.html`;
  const json = String.raw`C:\Users\x\Downloads\Creva_Score_acme_2026-08-14T21-30-05Z\creva-reporte.json`;

  it('states where the files landed, not just that they were written', () => {
    const out = renderReportPaths(folder, html, json);

    expect(out).toContain(html);
    expect(out).toContain(json);
  });

  it('names the folder, which is what a person goes looking for', () => {
    expect(renderReportPaths(folder, html, json)).toContain(folder);
  });

  it('quotes the path, because it almost always contains spaces', () => {
    expect(renderReportPaths(folder, html, json)).toContain(`"${html}"`);
  });

  it('offers an opener that matches the platform it is running on', () => {
    const expected = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';

    expect(renderReportPaths(folder, html, json)).toContain(`${expected} "`);
  });
});

describe('the report does not claim the whole corpus is about the subject', () => {
  it('never says the registries were asked about this business', () => {
    // Only the directory is asked about her; the gazette, the rulebook and the rates are
    // identical for every reader. Claiming otherwise overstated the report by 24 signals.
    const html = renderReportHtml(report());

    expect(html).not.toContain('de gobierno por este negocio');
    expect(html).not.toMatch(/Preguntamos a \d+ registros? de gobierno por este negocio/);
  });

  it('states how many signals are about the business and how many are context', () => {
    const r = report();
    const split = signalSplit(r);
    const html = renderReportHtml(r);

    expect(split.subject).toBe(1);
    expect(split.context).toBe(r.signals.length - 1);
    expect(html).toContain(`${split.subject} de estas ${r.signals.length} señales es sobre tu negocio`);
    expect(html).toContain('las mismas para cualquiera');
  });

  it('counts only the directory signal as being about the subject', () => {
    const r = reportWithManyRules(20);
    const split = signalSplit(r);

    // However big the regulatory corpus grows, it never becomes a finding about her.
    expect(split.subject).toBe(1);
    expect(split.context).toBeGreaterThan(20);
  });
});

describe('the report takes a different shape when nothing public was found', () => {
  const notListed = sourceOk(
    'mx.siem',
    { matched: false, confirmed_by_rfc: false, establishment_id: null, commercial_name: null, state: null, candidates_found: 0 },
    '2026-08-13T00:00:00.000Z',
  );

  function personaFisica() {
    return buildReport({
      subject: { business_name: 'MARIA JOSE PEREZ', state_code: null },
      verification: notListed,
      radar,
      rates,
      disclosure,
      now,
    });
  }

  it('keeps the existing shape when the directory found her', () => {
    expect(reportShape(report())).toBe('expediente');
    expect(renderReportHtml(report())).toContain('de estas');
  });

  it('switches shape when the directory did not', () => {
    expect(reportShape(personaFisica())).toBe('sin-registro');
  });

  it('opens with the state, not with a count of signals that are not hers', () => {
    const html = renderReportHtml(personaFisica());

    expect(html).toContain('Todavía no hay nada público sobre tu negocio');
    expect(html).not.toContain('señales es sobre tu negocio');
    expect(html).not.toContain('señales son sobre tu negocio');
  });

  it('says the directory is voluntary and that the absence does not count against her', () => {
    const html = renderReportHtml(personaFisica());

    expect(html).toContain('voluntario');
    expect(html).toContain('Eso no te resta');
    expect(html).toContain('Tu puntaje no depende de esto');
  });

  it('never invents how to register, and never offers the tax registry as consultable', () => {
    // verificacion.md marks the obligation and the chamber process as unverified, and there
    // is no SAT connector. A fabricated how-to inside a document shown to a bank is the
    // exact failure this project refuses.
    //
    // Scoped to the empty state the rule is about: searching the whole document also reads
    // the emitted script's English comments, where the word "sat" occurs innocently.
    // The class name also appears in the stylesheet, so the start is anchored to the markup.
    // Slicing from the rule instead swept in the emitted script and its English comments.
    const html = renderReportHtml(personaFisica());
    const start = html.indexOf('<div class="landing landing-empty">');
    const end = html.indexOf('class="kpis"', start);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const landing = html.slice(start, end).toLowerCase();

    // A runaway slice must fail loudly rather than quietly measure the whole document.
    expect(landing.length).toBeLessThan(3000);

    for (const invented of ['canaco', 'cámara de comercio', 'ley de cámaras', 'inscríbete', 'constancia de situación fiscal']) {
      expect(landing).not.toContain(invented);
    }
    expect(landing).not.toMatch(/\bsat\b/);
  });

  it('still carries the context signals, labelled as context', () => {
    const built = personaFisica();
    const html = renderReportHtml(built);

    expect(signalSplit(built).context).toBeGreaterThan(0);
    expect(html).toContain('las mismas para cualquiera');
  });
});
