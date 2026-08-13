// report-html: renders a report into one self-contained page. Presentation only.

import { CrevaReport, ReportSignal } from '../common/types/creva-report.types';

interface SourceLane {
  id: string;
  short: string;
  name: string;
  mark: string;
  blurb: string;
  signals: ReportSignal[];
}

interface Insight {
  lane: string;
  mark: string;
  text: string;
}

const STATUS_WORD: Record<string, string> = {
  positive: 'Verificado',
  neutral: 'Sin sello',
  unavailable: 'No disponible',
};

// Banxico arrives as a compact group of four, so folding it to three would hide a quarter of it.
const INITIAL_VISIBLE: Record<string, number> = { banxico: 4 };
const DEFAULT_VISIBLE = 3;

const NODE_X = [90, 230, 370, 510];
const ROOT = { x: 300, y: 62 };

export function renderReportHtml(report: CrevaReport): string {
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  const lanes = buildLanes(report);
  const name = report.subject?.business_name ?? 'Revisión general';

  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Creva — ${escapeHtml(name)}</title>
<style>${styles()}</style>
</head>
<body>
<div class="ambient" aria-hidden="true"><span class="glow g1"></span><span class="glow g2"></span><span class="grain"></span></div>
<span class="morph" id="morph" aria-hidden="true"></span>

<header class="bar" id="bar" aria-hidden="true">
  <span class="bar-brand">CREVA</span>
  <span class="bar-name">${escapeHtml(name)}</span>
  <span class="bar-status">${escapeHtml(statusWord(report))}</span>
</header>

<main>
  ${investigation(report, lanes, name)}

  <section class="stage report staging" id="stage-report">
    ${hero(report, lanes)}
    ${composition(report, lanes)}
    ${evidence(lanes)}
    ${market(report)}
    ${why(report)}
    ${audit(report)}
    ${closing(report)}
  </section>
</main>

<script>window.CREVA_REPORT=${data};${script()}</script>
</body>
</html>`;
}

function buildLanes(report: CrevaReport): SourceLane[] {
  const of = (predicate: (signal: ReportSignal) => boolean): ReportSignal[] => report.signals.filter(predicate);

  return [
    {
      id: 'siem',
      short: 'SIEM',
      name: 'Directorio de establecimientos',
      mark: '●',
      blurb: 'Si el negocio está inscrito, y desde cuándo.',
      signals: of((s) => s.category === 'business_verification'),
    },
    {
      id: 'dof',
      short: 'DOF',
      name: 'Diario Oficial de la Federación',
      mark: '↗',
      blurb: 'Lo que se publicó en los últimos días.',
      signals: of((s) => s.category === 'regulatory' && s.label.startsWith('Novedad')),
    },
    {
      id: 'cnbv',
      short: 'CNBV',
      name: 'Normas bancarias vigentes',
      mark: '◎',
      blurb: 'Reglas que ya estaban y siguen aplicando.',
      signals: of((s) => s.category === 'regulatory' && !s.label.startsWith('Novedad')),
    },
    {
      id: 'banxico',
      short: 'BANXICO',
      name: 'Banco de México',
      mark: '≈',
      blurb: 'Cuánto cuesta el dinero hoy.',
      signals: of((s) => s.category === 'reference_rate'),
    },
  ];
}

function statusWord(report: CrevaReport): string {
  const verification = report.signals.find((s) => s.category === 'business_verification');
  if (verification === undefined) return 'Revisión general';
  return STATUS_WORD[verification.tone] ?? 'Sin sello';
}

function visibleFor(laneId: string): number {
  return INITIAL_VISIBLE[laneId] ?? DEFAULT_VISIBLE;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function linkPath(index: number): string {
  const x = NODE_X[index] ?? 300;
  return `M${ROOT.x} ${ROOT.y} C${ROOT.x} 110 ${x} 100 ${x} 143`;
}

function investigation(report: CrevaReport, lanes: SourceLane[], name: string): string {
  const links = lanes.map((_, i) => `<path class="link" data-link="${i}" d="${linkPath(i)}"/>`).join('');
  const sparks = lanes
    .map((_, i) => `<circle class="spark" data-spark="${i}" r="3" style="offset-path:path('${linkPath(i)}')"/>`)
    .join('');
  const nodes = lanes
    .map(
      (lane, i) =>
        `<g class="node" data-node="${i}"><circle cx="${NODE_X[i] ?? 300}" cy="150" r="7"/><text x="${NODE_X[i] ?? 300}" y="180">${escapeHtml(lane.short)}</text></g>`,
    )
    .join('');
  const ticks = lanes
    .map(
      (lane, i) =>
        `<li class="tick" data-tick="${i}"><span class="tick-mark">✓</span>${escapeHtml(lane.short)}</li>`,
    )
    .join('');

  return `<section class="stage investigate" id="stage-investigate">
    <p class="eyebrow">Creva · Inteligencia de datos públicos</p>
    <p class="investigating">Investigando</p>
    <h1 class="subject">${escapeHtml(name)}</h1>

    <svg class="net" viewBox="0 0 600 200" role="img" aria-label="Croma consultando cuatro fuentes de gobierno" xmlns="http://www.w3.org/2000/svg">
      <text class="root" x="300" y="40">CROMA</text>
      <circle class="root-dot" id="root-dot" cx="${ROOT.x}" cy="55" r="5"/>
      ${links}${sparks}${nodes}
    </svg>

    <ul class="ticks" aria-hidden="true">${ticks}</ul>
    <p class="progress" aria-hidden="true"><span class="progress-n" id="progress-n">0</span> <span id="progress-w">fuentes conectadas</span></p>
    <p class="flash" id="flash" aria-hidden="true"><strong>${report.signals.length}</strong> señales encontradas</p>
  </section>`;
}

function buildInsights(lanes: SourceLane[]): Insight[] {
  const list: Insight[] = [];

  for (const lane of lanes) {
    if (lane.id === 'banxico') continue;
    const count = lane.signals.length;

    if (lane.id === 'siem') {
      const tone = lane.signals[0]?.tone;
      if (tone === 'positive') list.push({ lane: lane.id, mark: '✓', text: 'Negocio encontrado en SIEM' });
      else if (tone === 'unavailable') list.push({ lane: lane.id, mark: '·', text: 'Directorio SIEM no disponible' });
      else if (tone === undefined) list.push({ lane: lane.id, mark: '·', text: 'Sin consulta al directorio SIEM' });
      else list.push({ lane: lane.id, mark: '·', text: 'Sin sello en SIEM' });
      continue;
    }

    if (lane.id === 'dof') {
      list.push({
        lane: lane.id,
        mark: count > 0 ? '✓' : '·',
        text:
          count > 0
            ? `${count} ${plural(count, 'novedad reciente', 'novedades recientes')} en DOF`
            : 'Sin novedades en DOF',
      });
      continue;
    }

    list.push({
      lane: lane.id,
      mark: count > 0 ? '✓' : '·',
      text:
        count > 0
          ? `${count} ${plural(count, 'referencia vigente', 'referencias vigentes')} en CNBV`
          : 'Sin referencias de CNBV',
    });
  }

  return list;
}

function hero(report: CrevaReport, lanes: SourceLane[]): string {
  const signals = report.signals.length;
  const verification = report.signals.find((s) => s.category === 'business_verification');
  const tone = verification?.tone ?? 'neutral';
  const cards = buildInsights(lanes)
    .map(
      (insight, index) => `<button class="insight" type="button" data-target="${insight.lane}" style="--i:${index}">
    <span class="insight-mark">${insight.mark}</span>
    <span class="insight-text">${escapeHtml(insight.text)}</span>
    <span class="insight-go" aria-hidden="true">→</span>
  </button>`,
    )
    .join('');

  return `<section class="block hero" data-enter="hero">
  <p class="eyebrow">Perfil público del negocio</p>
  <h1 class="subject big">${escapeHtml(report.subject?.business_name ?? 'Revisión general')}</h1>
  <p class="status pill-${tone}">${escapeHtml(statusWord(report))}</p>

  <div class="metric" id="metric">
    <span class="halo" aria-hidden="true"></span>
    <svg class="arc" viewBox="0 0 200 200" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="92"/></svg>
    <p class="figure" data-count="${signals}">0</p>
  </div>
  <p class="figure-label">señales públicas encontradas</p>
  <p class="tally"><strong>${report.sources.length}</strong> fuentes consultadas</p>

  <div class="insights" id="insights">${cards}</div>
  <p class="summary-done" id="summary-done" aria-hidden="true">Perfil público listo</p>
  ${verification === undefined ? '' : `<p class="hero-note">${escapeHtml(verification.detail)}</p>`}
  <p class="explore-cue" id="explore-cue">Explorar evidencia ↓</p>
</section>`;
}

function composition(report: CrevaReport, lanes: SourceLane[]): string {
  const rows = lanes
    .map((lane, index) => {
      const dots = lane.signals.map((_, i) => `<span class="dot" style="--d:${i}"></span>`).join('');

      return `<button class="comp-row" type="button" data-lane="${lane.id}" style="--i:${index}" aria-controls="comp-detail">
    <span class="comp-name">${escapeHtml(lane.short)}</span>
    <span class="comp-dots">${dots}</span>
    <span class="comp-n" data-count="${lane.signals.length}">0</span>
  </button>`;
    })
    .join('');

  return `<section class="block composition" data-enter="rail">
  <h2>Composición de las señales</h2>
  <p class="blurb">Toca una fuente para aislarla.</p>

  <div class="comp">
    <div class="comp-rows" id="comp-rows">${rows}</div>
    <div class="comp-detail" id="comp-detail" aria-live="polite">
      <p class="comp-detail-n"><span id="comp-detail-n" data-count="${report.signals.length}" data-total-count="${report.signals.length}">0</span></p>
      <p class="comp-detail-label" id="comp-detail-label">señales en total</p>
      <button class="comp-go" id="comp-go" type="button" hidden>Explorar evidencia →</button>
    </div>
  </div>
</section>`;
}

function evidence(lanes: SourceLane[]): string {
  const total = lanes.reduce((sum, lane) => sum + lane.signals.length, 0);

  const filters = [{ id: 'all', short: 'Todas' }, ...lanes.map((lane) => ({ id: lane.id, short: lane.short }))]
    .map(
      (filter, index) =>
        `<button class="filter${index === 0 ? ' selected' : ''}" type="button" data-filter="${filter.id}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(filter.short)}</button>`,
    )
    .join('');

  const panels = lanes.map(panel).join('');

  return `<section class="block evidence" data-enter="evidence">
  <h2>Evidencia</h2>
  <p class="blurb">Cada señal con su fuente y su fecha. Se muestran las primeras; el resto se pide.</p>

  <div class="filters" role="group" aria-label="Filtrar evidencia por fuente">${filters}</div>
  <p class="filter-result" id="filter-result" aria-live="polite">${total} ${plural(total, 'resultado', 'resultados')}</p>

  <div class="panels">${panels}</div>
</section>`;
}

function panel(lane: SourceLane): string {
  const visible = visibleFor(lane.id);
  const total = lane.signals.length;
  const items =
    total === 0
      ? '<p class="empty">Sin señales de esta fuente en la revisión.</p>'
      : lane.signals.map((signal, index) => evidenceItem(signal, index, index >= visible)).join('');

  const more =
    total > visible
      ? `<div class="more-wrap"><button class="more" type="button" data-lane="${lane.id}" aria-controls="body-${lane.id}">${moreLabel(visible, total)}</button></div>`
      : '';

  return `<article class="panel" id="lane-${lane.id}" data-panel="${lane.id}" data-visible="${visible}" data-total="${total}">
  <button class="panel-head" type="button" aria-expanded="false" aria-controls="body-${lane.id}">
    <span class="stop-mark">${lane.mark}</span>
    <span class="panel-title"><span class="panel-name">${escapeHtml(lane.name)}</span><span class="blurb">${escapeHtml(lane.blurb)}</span></span>
    <span class="panel-count">${total}</span>
    <span class="panel-cta">Ver evidencia</span>
    <span class="panel-toggle" aria-hidden="true">+</span>
  </button>
  <div class="panel-body" id="body-${lane.id}"><div class="panel-inner">${items}${more}</div></div>
</article>`;
}

// The label promises only what one press reveals, and states the remainder separately.
export function moreLabel(visible: number, total: number): string {
  const next = nextVisible(visible, total);
  const step = next - visible;
  const left = total - next;

  return left === 0 ? `Mostrar ${step} más →` : `Mostrar ${step} más → quedan ${left}`;
}

export function nextVisible(visible: number, total: number): number {
  if (visible < 6) return Math.min(6, total);
  if (visible < 10) return Math.min(10, total);
  return total;
}

function evidenceItem(signal: ReportSignal, index: number, folded: boolean): string {
  const link =
    signal.evidence_url === null
      ? ''
      : `<a class="doc" href="${escapeHtml(signal.evidence_url)}" target="_blank" rel="noopener">Ver documento oficial →</a>`;

  return `<div class="item tone-${signal.tone}" data-i="${index}"${folded ? ' hidden' : ''}>
  <p class="item-label">${escapeHtml(signal.label)}</p>
  <p class="item-detail">${escapeHtml(signal.detail)}</p>
  <p class="meta">${escapeHtml(signal.source)}${signal.checked_at === null ? '' : ` · ${escapeHtml(formatDate(signal.checked_at))}`}</p>
  ${link}
</div>`;
}

function market(report: CrevaReport): string {
  const rates = report.signals.filter((signal) => signal.category === 'reference_rate');
  if (rates.length === 0) return '';

  const figures = rates
    .map(
      (rate, index) => `<div class="rate" style="--i:${index}">
  <p class="rate-value">${escapeHtml(rate.detail)}</p>
  <p class="rate-label">${escapeHtml(rate.label)}</p>
  <p class="meta">${rate.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(rate.checked_at))}</p>
</div>`,
    )
    .join('');

  return `<section class="block" data-enter="market">
  <h2>Contexto de mercado</h2>
  <p class="blurb">Publicado por el Banco de México. Cada cifra trae su propia fecha, porque no se publican el mismo día.</p>
  <div class="rates">${figures}</div>
  <div class="pulse" aria-hidden="true"></div>
</section>`;
}

function why(report: CrevaReport): string {
  const verified = report.signals.some((s) => s.category === 'business_verification' && s.tone === 'positive');

  return `<section class="block why" data-enter="market">
  <h2>Por qué importa</h2>
  <div class="why-steps">
    <div class="why-step"><p class="why-head">${verified ? 'Negocio verificado' : 'Negocio consultado'}</p><p class="blurb">Contra el directorio oficial, con la fecha de la consulta.</p></div>
    <div class="why-step"><p class="why-head">Contexto normativo</p><p class="blurb">Lo que se publicó y lo que ya estaba vigente.</p></div>
    <div class="why-step"><p class="why-head">Contexto financiero</p><p class="blurb">La referencia contra la que se mide una oferta de crédito.</p></div>
  </div>
</section>`;
}

function audit(report: CrevaReport): string {
  const notes =
    report.notes.length === 0
      ? ''
      : `<div class="audit-card">
  <p class="label">Lo que no pudimos ver</p>
  <ul class="notes">${report.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
</div>`;

  const levels = report.disclosure.provenance_levels
    .map(
      (level) => `<div class="audit-card">
  <p class="label">${escapeHtml(level.label)}</p>
  <p class="blurb">${escapeHtml(level.meaning)}</p>
</div>`,
    )
    .join('');

  const rows = report.sources
    .map(
      (source) =>
        `<tr><td>${escapeHtml(source.provider)}</td><td>${escapeHtml(source.dataset)}</td><td>${source.queried_at === null ? '—' : escapeHtml(formatDate(source.queried_at))}</td></tr>`,
    )
    .join('');

  return `<section class="block audit" data-enter="audit">
  <h2>Sobre este análisis</h2>
  <p class="blurb">${escapeHtml(report.disclosure.describes)} Ventana de ${report.disclosure.window_days} días · versión ${escapeHtml(report.disclosure.score_version)}.</p>

  <div class="audit-card wide">
    <p class="label">Lo que NO hace</p>
    <ul class="notes">${report.disclosure.does_not_estimate.map((claim) => `<li>${escapeHtml(claim)}</li>`).join('')}</ul>
  </div>

  <p class="label spaced">De dónde sale cada dato</p>
  <div class="audit-grid">${levels}</div>
  ${notes}

  ${
    rows === ''
      ? ''
      : `<p class="label spaced">Fuentes consultadas</p>
  <table class="sources"><thead><tr><th>Proveedor</th><th>Conjunto de datos</th><th>Consultado</th></tr></thead><tbody>${rows}</tbody></table>`
  }
</section>`;
}

function closing(report: CrevaReport): string {
  return `<section class="block closing" data-enter="audit">
  <p class="closing-arc">Información pública → Evidencia estructurada → Contexto para decidir</p>
  <p class="closing-tally">${report.signals.length} señales · ${report.sources.length} fuentes · ${escapeHtml(formatDateTime(report.generated_at))}</p>
</section>`;
}

function formatDate(value: string): string {
  const iso = value.length === 10 ? `${value}T12:00:00.000Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function styles(): string {
  return `
:root{--bg:#F6F1E7;--s1:#FFFFFF;--s2:#FFE8EE;--tx:#1A1613;
--muted:rgba(26,22,19,.72);--subtle:rgba(26,22,19,.60);--bd:rgba(26,22,19,.10);
--crimson:#C41E3A;--crimson-dark:#9E1329;--rosa:#FF8FAE;--ok:#2E6A48;
--grad:linear-gradient(135deg,#D62E52 0%,#9E1329 100%);
--ease:cubic-bezier(.22,.61,.36,1);--slow:640ms;--mid:420ms}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--tx);
font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55;
-webkit-font-smoothing:antialiased;overflow-x:hidden}
button{font-family:inherit}
:focus-visible{outline:2px solid var(--crimson);outline-offset:3px;border-radius:6px}

.ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;
transition:opacity 900ms var(--ease)}
.glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5}
.g1{width:46vw;height:46vw;left:-10vw;top:-12vw;background:radial-gradient(circle,#FF8FAE55,transparent 70%);animation:drift1 34s var(--ease) infinite alternate}
.g2{width:38vw;height:38vw;right:-8vw;top:38vh;background:radial-gradient(circle,#C41E3A33,transparent 70%);animation:drift2 44s var(--ease) infinite alternate}
.grain{position:absolute;inset:0;opacity:.045;background-image:radial-gradient(#1A1613 1px,transparent 1px);background-size:3px 3px}
@keyframes drift1{to{transform:translate3d(6vw,7vh,0) scale(1.12)}}
@keyframes drift2{to{transform:translate3d(-7vw,-5vh,0) scale(1.08)}}

.morph{position:fixed;z-index:4;width:10px;height:10px;border-radius:50%;
background:var(--crimson);opacity:0;pointer-events:none;
box-shadow:0 0 0 0 rgba(196,30,58,.28)}
.morph.travel{animation:morphGlow 760ms var(--ease) forwards}
@keyframes morphGlow{0%{box-shadow:0 0 0 0 rgba(196,30,58,.28)}100%{box-shadow:0 0 0 46px rgba(196,30,58,0)}}

main{position:relative;z-index:1;max-width:60rem;margin:0 auto;padding:0 clamp(1.2rem,4vw,2.5rem)}
/* .stage sets display, so the escape hatch has to outrank it */
.stage.hidden{display:none}
.staging{opacity:0;pointer-events:none}
.eyebrow{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:0 0 1.2rem}
.blurb{color:var(--muted);margin:0 0 1rem;font-size:.95rem}
.label{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 .6rem}
.label.spaced{margin-top:2rem}
.meta{margin:0;font-size:.8rem;color:var(--muted)}

.investigate{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;
transition:opacity 560ms var(--ease),transform 560ms var(--ease),filter 560ms var(--ease)}
.investigate.collapse{opacity:0;transform:scale(.9);filter:blur(7px)}
.investigating{font-size:.82rem;letter-spacing:.28em;text-transform:uppercase;color:var(--crimson-dark);margin:0 0 1rem}
.investigating::after{content:'';display:inline-block;width:1.6em;text-align:left;animation:dots 1.6s steps(4,end) infinite}
@keyframes dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
.subject{font-size:clamp(2.4rem,7vw,4.6rem);line-height:1.02;margin:0;font-weight:700;letter-spacing:-.02em;
background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.net{width:min(100%,38rem);margin-top:3.5rem;overflow:visible;transition:transform 560ms var(--ease)}
.investigate.collapse .net{transform:scale(.34)}
.net .root{fill:var(--tx);font-size:13px;letter-spacing:.22em;text-anchor:middle;font-weight:600}
.net .root-dot{fill:var(--crimson)}
.net text{font-family:inherit}
.net .node text{fill:var(--subtle);font-size:11px;letter-spacing:.14em;text-anchor:middle;transition:fill var(--mid) var(--ease)}
.net .node circle{fill:var(--bg);stroke:var(--subtle);stroke-width:1.5;transition:all var(--mid) var(--ease)}
.net .node.on circle{fill:var(--ok);stroke:var(--ok);animation:nodePop 520ms var(--ease)}
.net .node.on text{fill:var(--tx)}
@keyframes nodePop{0%{r:7}45%{r:13}100%{r:7}}
/* the dash has to be longer than the longest path, or the outer links show through undrawn */
.net .link{fill:none;stroke:var(--bd);stroke-width:1.5;stroke-dasharray:400;stroke-dashoffset:400;
transition:stroke-dashoffset var(--slow) var(--ease),stroke var(--slow) var(--ease)}
.net .link.on{stroke-dashoffset:0;stroke:var(--rosa)}
.net .spark{fill:var(--crimson);opacity:0;offset-distance:0%}
.net .spark.on{animation:travel 1400ms var(--ease) infinite}
@keyframes travel{0%{offset-distance:0%;opacity:0}12%{opacity:1}88%{opacity:1}100%{offset-distance:100%;opacity:0}}

.ticks{list-style:none;display:flex;flex-wrap:wrap;gap:.4rem .9rem;justify-content:center;padding:0;margin:1.8rem 0 0;
font-size:.76rem;letter-spacing:.14em;color:var(--subtle)}
.tick{display:flex;align-items:center;gap:.35rem;opacity:.3;transition:opacity var(--mid) var(--ease)}
.tick-mark{color:var(--bd);transition:color var(--mid) var(--ease)}
.tick.on{opacity:1}
.tick.on .tick-mark{color:var(--ok);animation:tickPop 420ms var(--ease)}
@keyframes tickPop{0%{transform:scale(.4)}55%{transform:scale(1.5)}100%{transform:scale(1)}}
.progress{margin:.9rem 0 0;font-size:.76rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.progress-n{font-weight:700;color:var(--crimson-dark);font-size:1rem}
.flash{position:absolute;margin:0;font-size:clamp(1.2rem,3.4vw,2rem);font-weight:700;letter-spacing:-.01em;
opacity:0;transform:translateY(10px);transition:opacity 320ms var(--ease),transform 320ms var(--ease)}
.flash strong{color:var(--crimson)}
.flash.on{opacity:1;transform:none}

.bar{position:fixed;top:0;left:0;right:0;z-index:5;display:flex;gap:1rem;align-items:center;
padding:.85rem clamp(1.2rem,4vw,2.5rem);background:rgba(246,241,231,0);
border-bottom:1px solid transparent;opacity:0;
transition:opacity var(--slow) var(--ease),background var(--slow) var(--ease),
border-color var(--slow) var(--ease),box-shadow var(--slow) var(--ease),backdrop-filter var(--slow) var(--ease)}
.bar.on{opacity:1;background:rgba(246,241,231,.78);backdrop-filter:blur(14px);
border-bottom-color:var(--bd);box-shadow:0 8px 24px rgba(26,22,19,.05)}
.bar-brand{font-weight:700;letter-spacing:.18em;font-size:.78rem;color:var(--crimson-dark)}
.bar-name{font-weight:600;font-size:.92rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-status{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}

.block{margin:0 0 5rem}
.block h2{font-size:1.05rem;letter-spacing:.02em;margin:0 0 .3rem;font-weight:650}
[data-enter]{opacity:0;transition:opacity var(--slow) var(--ease),transform var(--slow) var(--ease),filter var(--slow) var(--ease),clip-path var(--slow) var(--ease)}
[data-enter="hero"]{transform:scale(.965);filter:blur(9px)}
[data-enter="rail"]{transform:translateY(22px)}
[data-enter="evidence"]{clip-path:inset(0 0 100% 0)}
[data-enter="market"]{transform:translateY(12px)}
[data-enter="audit"]{transform:none}
[data-enter].on{opacity:1;transform:none;filter:none;clip-path:inset(0 0 0 0)}
[data-enter="audit"].on{opacity:.92}

.hero{padding-top:6rem;text-align:center;margin-bottom:7rem}
.subject.big{font-size:clamp(1.9rem,5vw,3.2rem)}
.status{display:inline-block;margin:1rem 0 0;padding:.35rem 1rem;border-radius:999px;
font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;font-weight:600;
background:var(--s1);border:1px solid var(--bd);color:var(--muted)}
.status.pill-positive{background:var(--s2);border-color:rgba(46,106,72,.3);color:var(--ok)}

.metric{position:relative;margin:3rem auto 0;width:min(30rem,86vw);aspect-ratio:1/.62;
display:flex;align-items:center;justify-content:center}
.halo{position:absolute;inset:-12% -6%;border-radius:50%;
background:radial-gradient(circle,rgba(255,143,174,.34),transparent 62%);filter:blur(26px)}
.arc{position:absolute;width:min(22rem,64vw);height:min(22rem,64vw);opacity:.5}
.arc circle{fill:none;stroke:var(--rosa);stroke-width:1;stroke-dasharray:4 10;
transform-origin:50% 50%;animation:spin 90s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.figure{position:relative;font-size:clamp(6rem,20vw,17rem);line-height:.86;margin:0;font-weight:700;letter-spacing:-.04em;
background:linear-gradient(115deg,#D62E52 0%,#9E1329 42%,#D62E52 100%);background-size:260% 100%;
-webkit-background-clip:text;background-clip:text;color:transparent;
animation:sheen 14s linear infinite;
transform:translateY(14px);opacity:0;transition:transform 760ms var(--ease),opacity 760ms var(--ease)}
.figure.settled{transform:none;opacity:1}
@keyframes sheen{to{background-position:260% 0}}
.figure-label{margin:1.4rem 0 0;font-size:.78rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.tally{margin:.7rem 0 0;font-size:.88rem;color:var(--muted)}
.tally strong{color:var(--tx);font-weight:650}
.hero-note{max-width:34rem;margin:1.4rem auto 0;color:var(--muted);font-size:.92rem}

.insights{display:grid;gap:.5rem;max-width:30rem;margin:2.4rem auto 0}
.insight{display:flex;align-items:center;gap:.8rem;width:100%;padding:.9rem 1.1rem;
background:rgba(255,255,255,.66);border:1px solid var(--bd);border-radius:14px;
cursor:pointer;font-size:.95rem;color:inherit;text-align:left;
opacity:0;transform:translateY(10px);
transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease),
border-color var(--mid) var(--ease),box-shadow var(--mid) var(--ease)}
.insight.on{opacity:1;transform:none}
.insight:hover,.insight:focus-visible{border-color:rgba(196,30,58,.35);box-shadow:0 8px 22px rgba(196,30,58,.07)}
.insight-mark{color:var(--ok);font-weight:700;width:1rem;text-align:center}
.insight.on .insight-mark{animation:tickPop 420ms var(--ease)}
.insight-text{flex:1}
.insight-go{color:var(--crimson-dark);transition:transform var(--mid) var(--ease)}
.insight:hover .insight-go{transform:translateX(4px)}
.summary-done{margin:1.4rem 0 0;font-size:.74rem;letter-spacing:.18em;text-transform:uppercase;
color:var(--ok);opacity:0;transition:opacity var(--slow) var(--ease)}
.summary-done.on{opacity:1}
.explore-cue{margin:2rem 0 0;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);
opacity:0;transition:opacity var(--slow) var(--ease)}
.explore-cue.on{opacity:1;animation:nudge 2.6s var(--ease) infinite}
@keyframes nudge{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}

.comp{display:grid;gap:1.6rem;grid-template-columns:minmax(0,1fr) minmax(11rem,15rem);align-items:center}
.comp-rows{display:grid;gap:.3rem;min-width:0}
.comp-row{display:flex;align-items:center;gap:.9rem;width:100%;padding:.7rem .5rem;
background:none;border:0;border-radius:10px;cursor:pointer;color:inherit;text-align:left;
transition:background var(--mid) var(--ease),opacity var(--mid) var(--ease)}
.comp-row:hover{background:rgba(255,255,255,.5)}
.comp-name{font-size:.72rem;letter-spacing:.14em;color:var(--muted);width:4.6rem;flex:none}
.comp-dots{flex:1;display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-width:0}
.dot{width:9px;height:9px;border-radius:50%;background:var(--rosa);
transform:scale(0);transition:transform 320ms var(--ease) calc(var(--d) * 34ms)}
.comp-row.grown .dot{transform:scale(1)}
.comp-n{font-size:1.15rem;font-weight:700;width:2.2rem;text-align:right;flex:none}
.comp-rows.picking .comp-row:not(.picked){opacity:.28}
.comp-rows.picking .comp-row.picked .dot{background:var(--crimson)}
.comp-detail{text-align:center;padding:1.4rem 1rem;background:rgba(255,255,255,.62);
border:1px solid var(--bd);border-radius:18px}
.comp-detail-n{margin:0;font-size:clamp(2.6rem,7vw,4rem);font-weight:700;letter-spacing:-.03em;line-height:1;
background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.comp-detail-label{margin:.35rem 0 0;font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.comp-go{margin-top:1rem;padding:.5rem 1rem;border-radius:999px;border:1px solid rgba(196,30,58,.35);
background:none;color:var(--crimson-dark);font-size:.82rem;font-weight:600;cursor:pointer;
transition:background var(--mid) var(--ease)}
.comp-go:hover{background:var(--s2)}

.filters{display:flex;gap:.35rem;flex-wrap:wrap;margin:1rem 0 .6rem}
.filter{padding:.45rem .95rem;border-radius:999px;border:1px solid var(--bd);background:rgba(255,255,255,.6);
color:var(--muted);font-size:.78rem;letter-spacing:.1em;cursor:pointer;white-space:nowrap;
transition:all var(--mid) var(--ease)}
.filter:hover{border-color:var(--rosa)}
.filter.selected{background:var(--crimson);border-color:var(--crimson);color:#fff;font-weight:600}
.filter-result{margin:0 0 1.2rem;font-size:.8rem;color:var(--muted);transition:opacity 200ms var(--ease)}
.filter-result.blip{opacity:.25}

.panels{display:grid;gap:.6rem}
.panel{background:var(--s1);border:1px solid var(--bd);border-radius:16px;overflow:hidden;
transition:border-color var(--mid) var(--ease),box-shadow var(--mid) var(--ease)}
.panel.active{border-color:rgba(196,30,58,.34);box-shadow:0 10px 30px rgba(196,30,58,.07)}
.panel-head{display:flex;gap:1rem;align-items:center;width:100%;padding:1.1rem 1.3rem;
background:none;border:0;cursor:pointer;font-size:1rem;color:inherit;text-align:left}
.panel-title{flex:1;display:flex;flex-direction:column;min-width:0}
.panel-name{font-weight:640}
.panel-title .blurb{margin:.15rem 0 0;font-size:.85rem}
.panel-count{font-size:.78rem;font-weight:700;color:var(--crimson-dark);background:var(--s2);
padding:.15rem .55rem;border-radius:999px;flex:none}
.panel-cta{font-size:.8rem;color:var(--crimson-dark);font-weight:600;white-space:nowrap}
.panel.open .panel-cta{opacity:0}
.panel-toggle{font-size:1.3rem;color:var(--muted);width:1.2rem;text-align:center;line-height:1}
.panel.open .panel-toggle{color:var(--crimson-dark)}
.panel-body{max-height:0;overflow:hidden;transition:max-height var(--slow) var(--ease)}
.panel-inner{opacity:0;transform:translateY(8px);transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease)}
.panel.open .panel-body{max-height:400rem}
.panel.open .panel-inner{opacity:1;transform:none}
.item{padding:1rem 1.3rem;border-top:1px solid var(--bd)}
.item.fresh{animation:slideIn 420ms var(--ease)}
@keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.item-label{margin:0 0 .25rem;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--crimson-dark)}
.item.tone-positive .item-label{color:var(--ok)}
.item-detail{margin:0 0 .4rem}
.doc{display:inline-block;margin-top:.5rem;font-size:.82rem;color:var(--crimson-dark);font-weight:600}
.empty{padding:1rem 1.3rem;margin:0;border-top:1px solid var(--bd);color:var(--subtle)}
.more-wrap{padding:1rem 1.3rem;border-top:1px solid var(--bd)}
.more{padding:.55rem 1.1rem;border-radius:999px;border:1px solid var(--bd);background:none;
color:var(--crimson-dark);font-size:.84rem;font-weight:600;cursor:pointer;
transition:all var(--mid) var(--ease)}
.more:hover{border-color:var(--crimson);background:var(--s2)}

.rates{display:flex;flex-wrap:wrap;gap:3.4rem}
.rate{transition:opacity var(--slow) var(--ease) calc(var(--i) * 90ms),transform var(--slow) var(--ease) calc(var(--i) * 90ms)}
.rate-value{font-size:clamp(2.2rem,5.5vw,3.4rem);margin:0;font-weight:700;letter-spacing:-.03em;color:var(--tx)}
.rate-label{margin:.2rem 0 .25rem;font-size:.82rem;letter-spacing:.06em;color:var(--muted)}
.pulse{height:1px;margin-top:2.2rem;background:linear-gradient(90deg,transparent,var(--rosa),transparent);
background-size:200% 100%;animation:sweep 6s linear infinite}
@keyframes sweep{to{background-position:200% 0}}

.why-steps{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}
.why-step{background:rgba(255,255,255,.62);border:1px solid var(--bd);border-radius:16px;padding:1.2rem}
.why-head{margin:0 0 .3rem;font-weight:650}

.audit{margin-bottom:3rem}
.audit-card{background:rgba(255,255,255,.5);border:1px solid rgba(26,22,19,.06);border-radius:14px;padding:1.1rem 1.2rem;margin-bottom:.6rem}
.audit-grid{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}
.notes{margin:0;padding-left:1.1rem;color:var(--muted)}
.notes li{margin:.3rem 0}
.sources{width:100%;border-collapse:collapse;font-size:.84rem;margin-top:.4rem;color:var(--muted)}
.sources th{text-align:left;font-weight:600;padding:.45rem .6rem .45rem 0;border-bottom:1px solid var(--bd)}
.sources td{padding:.5rem .6rem;border-bottom:1px solid var(--bd)}
.sources td:first-child{padding-left:0}

.closing{text-align:center;padding-bottom:4rem}
.closing-arc{font-size:clamp(1rem,2.6vw,1.5rem);font-weight:650;margin:0 0 .6rem;letter-spacing:-.01em}
.closing-tally{margin:0;color:var(--muted);font-size:.86rem}

@media(max-width:640px){
  .net{width:100%}
  .figure{font-size:clamp(4.5rem,26vw,8rem)}
  .metric{aspect-ratio:1/.8}
  .comp{grid-template-columns:1fr}
  .comp-name{width:3.8rem}
  .filters{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:.2rem}
  .filters::-webkit-scrollbar{display:none}
  .filter{flex:none;min-height:40px}
  .panel-head{min-height:56px}
  .panel-cta{display:none}
  .bar-status{display:none}
  .rates{gap:2rem}
}

@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .glow,.pulse,.investigating::after,.arc circle,.figure,.net .spark.on,.morph.travel,
  .explore-cue.on,.item.fresh,.tick.on .tick-mark,.insight.on .insight-mark,.net .node.on circle{animation:none}
  [data-enter],.bar,.panel-body,.panel-inner,.net .link,.net .node circle,.net .node text,
  .investigate,.net,.figure,.rate,.insight,.dot,.tick,.flash,.summary-done,.explore-cue,.filter-result{transition:none}
  .net .spark{display:none}
}
`;
}

function script(): string {
  return `
(function(){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var investigate=document.getElementById('stage-investigate');
  var report=document.getElementById('stage-report');
  var bar=document.getElementById('bar');
  var morph=document.getElementById('morph');
  var ambient=document.querySelector('.ambient');
  var links=[].slice.call(document.querySelectorAll('.net .link'));
  var sparks=[].slice.call(document.querySelectorAll('.net .spark'));
  var nodes=[].slice.call(document.querySelectorAll('.net .node'));
  var ticks=[].slice.call(document.querySelectorAll('.tick'));
  var figure=report.querySelector('.figure');
  var progressN=document.getElementById('progress-n');
  var progressW=document.getElementById('progress-w');
  var flash=document.getElementById('flash');

  function countUp(el,dur){
    var target=parseInt(el.getAttribute('data-count'),10)||0;
    if(reduce||target===0){el.textContent=String(target);return;}
    var started=null,span=dur||1000;
    function tick(now){
      if(started===null)started=now;
      var p=Math.min((now-started)/span,1);
      el.textContent=String(Math.round(target*(1-Math.pow(1-p,3))));
      if(p<1)requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // A hidden tab never runs an animation frame, and a count stuck at 0 would
    // state a figure the report does not hold.
    setTimeout(function(){el.textContent=String(target);},span+400);
  }

  function connected(i){
    if(ticks[i])ticks[i].classList.add('on');
    var n=i+1;
    if(progressN)progressN.textContent=String(n);
    if(progressW)progressW.textContent=n===1?'fuente conectada':'fuentes conectadas';
  }

  function enterBlocks(){
    var blocks=[].slice.call(report.querySelectorAll('[data-enter]'));
    blocks.forEach(function(b,i){setTimeout(function(){b.classList.add('on');},reduce?0:i*150);});
  }

  function revealSummary(){
    var cards=[].slice.call(document.querySelectorAll('.insight'));
    var done=document.getElementById('summary-done');
    var cue=document.getElementById('explore-cue');
    cards.forEach(function(c,i){setTimeout(function(){c.classList.add('on');},reduce?0:i*260);});
    setTimeout(function(){
      if(done)done.classList.add('on');
      if(cue)cue.classList.add('on');
    },reduce?0:cards.length*260+240);
  }

  function growComposition(){
    [].slice.call(document.querySelectorAll('.comp-row')).forEach(function(row,i){
      setTimeout(function(){
        row.classList.add('grown');
        countUp(row.querySelector('.comp-n'),700);
      },reduce?0:i*160);
    });
    var total=document.getElementById('comp-detail-n');
    if(total)setTimeout(function(){countUp(total,900);},reduce?0:420);
  }

  function settle(){
    report.classList.remove('staging');
    bar.classList.add('on');
    bar.setAttribute('aria-hidden','false');
    if(ambient)ambient.style.opacity='.55';
    enterBlocks();
    if(figure){
      setTimeout(function(){figure.classList.add('settled');countUp(figure);},reduce?0:220);
    }
    setTimeout(revealSummary,reduce?0:1300);
    setTimeout(growComposition,reduce?0:1900);
  }

  // The dot leaves the network and lands where the figure will be, so the two scenes read as one.
  function travelIntoFigure(done){
    var dot=document.getElementById('root-dot');
    if(!dot||!figure||!morph||typeof dot.getBoundingClientRect!=='function'){done();return;}

    var from=dot.getBoundingClientRect();
    var to=figure.getBoundingClientRect();
    if(!to.width||!from.width){done();return;}

    // The report still sits below the investigation, so the figure lands
    // exactly one investigation-height higher once that stage leaves the flow.
    var lift=investigate.getBoundingClientRect().height;
    var fromX=from.left+from.width/2;
    var fromY=from.top+from.height/2;

    morph.style.left=(fromX-5)+'px';
    morph.style.top=(fromY-5)+'px';
    morph.style.opacity='1';
    morph.style.transition='transform 760ms cubic-bezier(.22,.61,.36,1),opacity 240ms ease 620ms';
    morph.classList.add('travel');

    requestAnimationFrame(function(){
      var dx=(to.left+to.width/2)-fromX;
      var dy=(to.top+to.height/2-lift)-fromY;
      morph.style.transform='translate3d('+dx+'px,'+dy+'px,0) scale(9)';
      morph.style.opacity='0';
    });
    setTimeout(done,700);
  }

  if(reduce){
    links.forEach(function(l){l.classList.add('on');});
    nodes.forEach(function(n,i){n.classList.add('on');connected(i);});
    investigate.classList.add('hidden');
    settle();
  } else {
    if(ambient)ambient.style.opacity='1';
    links.forEach(function(link,i){setTimeout(function(){link.classList.add('on');},260+i*260);});
    sparks.forEach(function(spark,i){setTimeout(function(){spark.classList.add('on');},420+i*260);});
    nodes.forEach(function(node,i){setTimeout(function(){node.classList.add('on');connected(i);},900+i*260);});

    var settled=900+nodes.length*260;
    setTimeout(function(){if(flash)flash.classList.add('on');},settled+240);
    setTimeout(function(){
      sparks.forEach(function(s){s.classList.remove('on');});
      if(flash)flash.classList.remove('on');
      investigate.classList.add('collapse');
      travelIntoFigure(function(){
        investigate.classList.add('hidden');
        settle();
      });
    },settled+1500);
  }

  function panels(){return [].slice.call(document.querySelectorAll('.panel'));}

  function setFilter(id){
    var shown=0;
    [].slice.call(document.querySelectorAll('.filter')).forEach(function(f){
      var on=f.getAttribute('data-filter')===id;
      f.classList.toggle('selected',on);
      f.setAttribute('aria-pressed',on?'true':'false');
    });
    panels().forEach(function(p){
      var lane=p.getAttribute('data-panel');
      var on=id==='all'||lane===id;
      p.hidden=!on;
      if(on)shown+=parseInt(p.getAttribute('data-total'),10)||0;
    });
    var out=document.getElementById('filter-result');
    if(out){
      var word=shown===1?'resultado':'resultados';
      var label=id==='all'?shown+' '+word:id.toUpperCase()+' · '+shown+' '+word;
      out.classList.add('blip');
      setTimeout(function(){out.textContent=label;out.classList.remove('blip');},reduce?0:120);
    }
  }

  function nextVisible(visible,total){
    if(visible<6)return Math.min(6,total);
    if(visible<10)return Math.min(10,total);
    return total;
  }

  function showMore(panel){
    var visible=parseInt(panel.getAttribute('data-visible'),10)||0;
    var total=parseInt(panel.getAttribute('data-total'),10)||0;
    var next=nextVisible(visible,total);
    var items=[].slice.call(panel.querySelectorAll('.item'));

    for(var i=visible;i<next;i++){
      if(!items[i])continue;
      items[i].hidden=false;
      if(!reduce)items[i].classList.add('fresh');
    }
    panel.setAttribute('data-visible',String(next));

    var button=panel.querySelector('.more');
    if(!button)return;
    if(next>=total){
      var wrap=button.parentNode;
      if(wrap&&wrap.parentNode)wrap.parentNode.removeChild(wrap);
      return;
    }
    var step=nextVisible(next,total)-next;
    var left=total-nextVisible(next,total);
    button.textContent=left===0?'Mostrar '+step+' más →':'Mostrar '+step+' más → quedan '+left;
  }

  function openPanel(panel){
    if(panel.classList.contains('open'))return;
    panel.classList.add('open');
    var head=panel.querySelector('.panel-head');
    if(head)head.setAttribute('aria-expanded','true');
    var mark=panel.querySelector('.panel-toggle');
    if(mark)mark.textContent='−';
  }

  function togglePanel(panel){
    if(panel.classList.contains('open')){
      panel.classList.remove('open');
      var head=panel.querySelector('.panel-head');
      if(head)head.setAttribute('aria-expanded','false');
      var mark=panel.querySelector('.panel-toggle');
      if(mark)mark.textContent='+';
      return;
    }
    openPanel(panel);
  }

  function jumpToLane(id){
    setFilter(id);
    pickComposition(id);
    var target=document.getElementById('lane-'+id);
    if(!target)return;
    panels().forEach(function(p){p.classList.toggle('active',p===target);});
    openPanel(target);
    target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});
  }

  function pickComposition(id,allowToggle){
    var rows=document.getElementById('comp-rows');
    if(!rows)return;
    var n=document.getElementById('comp-detail-n');
    var label=document.getElementById('comp-detail-label');
    var go=document.getElementById('comp-go');
    if(!n||!label||!go)return;

    var current=rows.querySelector('.comp-row.picked');
    var same=allowToggle===true&&current!==null&&current.getAttribute('data-lane')===id;
    var picked=null;

    [].slice.call(rows.querySelectorAll('.comp-row')).forEach(function(r){
      var on=!same&&r.getAttribute('data-lane')===id;
      r.classList.toggle('picked',on);
      if(on)picked=r;
    });
    rows.classList.toggle('picking',picked!==null);

    if(picked===null){
      n.setAttribute('data-count',n.getAttribute('data-total-count'));
      countUp(n,520);
      label.textContent='señales en total';
      go.hidden=true;
      return;
    }
    n.setAttribute('data-count',picked.querySelector('.comp-n').getAttribute('data-count'));
    countUp(n,520);
    label.textContent=picked.getAttribute('data-lane').toUpperCase();
    go.hidden=false;
    go.setAttribute('data-lane',picked.getAttribute('data-lane'));
  }

  document.addEventListener('click',function(e){
    var t=e.target;
    if(!t||!t.closest)return;

    var head=t.closest('.panel-head');
    if(head){togglePanel(head.parentNode);return;}

    var more=t.closest('.more');
    if(more){showMore(more.closest('.panel'));return;}

    var filter=t.closest('.filter');
    if(filter){setFilter(filter.getAttribute('data-filter'));return;}

    var insight=t.closest('.insight');
    if(insight){jumpToLane(insight.getAttribute('data-target'));return;}

    var row=t.closest('.comp-row');
    if(row){pickComposition(row.getAttribute('data-lane'),true);return;}

    var go=t.closest('.comp-go');
    if(go){jumpToLane(go.getAttribute('data-lane'));return;}
  });
})();
`;
}
