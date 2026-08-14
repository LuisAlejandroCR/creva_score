// sections: the markup of every stage of the page.

import { CrevaReport, ReportSignal } from '../../common/types/creva-report.types';
import {
  SourceLane,
  escapeHtml,
  formatDate,
  isPercent,
  moreLabel,
  plural,
  statusWord,
  visibleFor,
} from './lanes';
import { buildRateStrip } from './rate-strip';
import { timeline, yearSlicer } from './timeline';

const NODE_X = [90, 230, 370, 510];
const ROOT = { x: 300, y: 62 };

function linkPath(index: number): string {
  const x = NODE_X[index] ?? 300;
  return `M${ROOT.x} ${ROOT.y} C${ROOT.x} 110 ${x} 100 ${x} 143`;
}


const RING = 2 * Math.PI * 52;

export function ring(lanes: SourceLane[], total: number, countId?: string): string {
  let offset = 0;
  const arcs = lanes
    .filter((lane) => lane.signals.length > 0)
    .map((lane, index) => {
      const share = total === 0 ? 0 : lane.signals.length / total;
      const dash = `${(share * RING).toFixed(2)} ${(RING - share * RING).toFixed(2)}`;
      const rotation = offset * 360 - 90;
      offset += share;
      return `<circle class="ring-arc a${index}" cx="60" cy="60" r="52" stroke-dasharray="${dash}" transform="rotate(${rotation.toFixed(2)} 60 60)"><title>${escapeHtml(lane.short)}: ${lane.signals.length}</title></circle>`;
    })
    .join('');

  const big = countId !== undefined;
  const count = big ? ` id="${countId}" data-count="${total}"` : '';

  // The landing keeps the figure large and the split thin around it: the dashed circle
  // turns, the digits fill in. Only this one carries the gradient, so its id stays unique.
  const halo = big
    ? `<defs><linearGradient id="ring-fill" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#D62E52"/><stop offset="1" stop-color="#9E1329"/>
    </linearGradient></defs>
    <circle class="ring-glow" cx="60" cy="60" r="45"/>
    <circle class="ring-dash" cx="60" cy="60" r="57"/>`
    : '';

  return `<svg class="ring${big ? ' big' : ''}" viewBox="0 0 120 120" role="img" aria-label="Reparto de las ${total} señales entre las fuentes" xmlns="http://www.w3.org/2000/svg">
    ${halo}<circle class="ring-track" cx="60" cy="60" r="52"/>
    ${arcs}
    <text class="ring-n" x="60" y="${big ? 72 : 58}"${count}>${total}</text>
    <text class="ring-l" x="60" y="${big ? 88 : 74}">señales</text>
  </svg>`;
}

export function ranked(lanes: SourceLane[], total: number): string {
  const largest = lanes.reduce((top, lane) => Math.max(top, lane.signals.length), 0);

  return lanes
    .map((lane, index) => {
      const share = total === 0 ? 0 : Math.round((lane.signals.length / total) * 100);
      const width = largest === 0 ? 0 : Math.round((lane.signals.length / largest) * 100);

      return `<button class="rank a${index}" type="button" data-lane="${lane.id}" data-total="${lane.signals.length}" style="--i:${index}" aria-pressed="false">
      <span class="rank-i">${index + 1}</span>
      <span class="rank-name">${escapeHtml(lane.short)}</span>
      <span class="rank-track">${lane.signals.length === 0 ? '' : `<span class="rank-bar" style="--w:${width}%"></span>`}</span>
      <span class="rank-n">${lane.signals.length}</span>
      <span class="rank-share">${share}%</span>
    </button>`;
    })
    .join('');
}

// A segment per source consulted, lit for the ones that came back with something.
function cells(meter: KpiMeter): string {
  const list = Array.from(
    { length: meter.total },
    (_, index) => `<span class="cell${index < meter.lit ? ' lit' : ''}" style="--i:${index}"></span>`,
  ).join('');

  return `<div class="cells" role="img" aria-label="${meter.lit} de ${meter.total}">${list}</div>`;
}


export function investigation(report: CrevaReport, lanes: SourceLane[], name: string): string {
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
    .map((lane, i) => `<li class="tick" data-tick="${i}"><span class="tick-mark">✓</span>${escapeHtml(lane.short)}</li>`)
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

export interface KpiMeter {
  total: number;
  lit: number;
}

export interface Kpi {
  label: string;
  value: string;
  note: string;
  sub: string | null;
  meter: KpiMeter | null;
}

// One definition, read by the screen and by the printable, so the two cannot drift apart.
export function summaryKpis(report: CrevaReport, lanes: SourceLane[]): Kpi[] {
  const headline = report.signals.find((s) => s.category === 'reference_rate' && isPercent(s));
  const answered = lanes.filter((lane) => lane.signals.length > 0).length;

  return [
    {
      label: 'Fuentes',
      value: String(report.sources.length),
      note: 'registros de gobierno',
      sub: `${answered} devolvieron algo`,
      meter: { total: lanes.length, lit: answered },
    },
    { label: 'Directorio', value: statusWord(report), note: 'SIEM · voluntario', sub: null, meter: null },
    headline === undefined
      ? { label: 'Referencia', value: 'sin dato', note: 'Banco de México', sub: null, meter: null }
      : {
          label: headline.label,
          value: headline.detail,
          note: headline.checked_at === null ? 'Banco de México' : formatDate(headline.checked_at),
          sub: null,
          meter: null,
        },
  ];
}

// The summary is where the investigation lands: the total the intro announced arrives in
// the centre of the ring, and everything else is a door. Each figure is stated once.
export function hero(report: CrevaReport, lanes: SourceLane[]): string {
  const kpis = summaryKpis(report, lanes)
    .map(
      (kpi, index) => `<div class="kpi" style="--i:${index}">
    <p class="kpi-label">${escapeHtml(kpi.label)}</p>
    <p class="kpi-value">${escapeHtml(kpi.value)}</p>
    ${kpi.sub === null ? '' : `<p class="kpi-sub">${escapeHtml(kpi.sub)}</p>`}
    ${kpi.meter === null ? '' : cells(kpi.meter)}
    <p class="kpi-note">${escapeHtml(kpi.note)}</p>
  </div>`,
    )
    .join('');

  return `<section class="block hero" data-enter="hero">
  <div class="landing">
    <div class="landing-ring">${ring(lanes, report.signals.length, 'kpi-count')}</div>
    <div class="landing-side">
      <p class="lead">Preguntamos a ${report.sources.length} ${plural(report.sources.length, 'registro', 'registros')} de gobierno por este negocio. Esto devolvieron, cada dato con su fuente y su fecha.</p>
      <button class="lead-go" type="button" data-step="signals">Ver de dónde salió cada señal <span class="jump-go" aria-hidden="true">→</span></button>
    </div>
  </div>

  <div class="kpis" id="kpis">${kpis}</div>
  <div class="jumps" id="jumps">${jumpCards(report)}</div>
</section>`;
}

function jumpCards(report: CrevaReport): string {
  const rates = report.signals.filter((signal) => signal.category === 'reference_rate');
  const documented = report.signals.filter((signal) => signal.evidence_url !== null).length;

  const doors = [
    {
      id: 'signals',
      num: '02',
      name: 'Señales',
      figure: String(documented),
      note: 'con documento oficial',
    },
    ...(rates.length === 0
      ? []
      : [{ id: 'market', num: '03', name: 'Mercado', figure: String(rates.length), note: 'referencias de Banxico' }]),
    {
      id: 'audit',
      num: rates.length === 0 ? '03' : '04',
      name: 'Auditoría',
      figure: String(report.disclosure.does_not_estimate.length),
      note: 'límites declarados',
    },
  ];

  return doors
    .map(
      (door, index) => `<button class="jump" type="button" data-step="${door.id}" style="--i:${index}">
    <span class="jump-num">${door.num}</span>
    <span class="jump-figure">${escapeHtml(door.figure)}</span>
    <span class="jump-name">${escapeHtml(door.name)}</span>
    <span class="jump-note">${escapeHtml(door.note)}<span class="jump-go" aria-hidden="true">→</span></span>
  </button>`,
    )
    .join('');
}

// One stage, one source selector. The ranked rows are that selector: choosing one quiets
// the timeline and narrows the evidence below, so the reader never crosses a stage
// boundary in the middle of the same question.
export function signals(report: CrevaReport, lanes: SourceLane[]): string {
  const total = report.signals.length;

  return `<section class="block composition" data-enter="rail">
  <p class="lead">Cada señal viene de un registro público. Elige una fuente para seguirla hasta su documento.</p>
  <h2>¿De qué fuente salió cada señal?</h2>
  <p class="hint"><span class="hint-mark" aria-hidden="true">☞</span> Toca una fuente para filtrar la línea de tiempo y la evidencia de abajo. El rango de años recorta esta pantalla entera.</p>

  ${yearSlicer(lanes)}

  <div class="card">
    <div class="ranked" id="ranked" role="group" aria-label="Elegir una fuente">${ranked(lanes, total)}</div>
    <button class="rank-clear" id="rank-clear" type="button" hidden>Ver las ${total} señales</button>
  </div>

  ${timeline(lanes)}

  <h2 class="ev-head">Los documentos detrás de cada señal</h2>
  <p class="filter-result" id="filter-result" aria-live="polite">${total} ${plural(total, 'resultado', 'resultados')}</p>

  <div class="panels">${lanes.map(panel).join('')}</div>
</section>`;
}

function panel(lane: SourceLane, laneIndex: number): string {
  const visible = visibleFor(lane.id);
  const total = lane.signals.length;
  const dated = lane.signals.filter((signal) => signal.checked_at !== null).length;

  const items =
    total === 0
      ? '<p class="empty">Sin señales de esta fuente en la revisión.</p>'
      : lane.signals.map((signal, index) => evidenceItem(signal, index, index >= visible, lane, laneIndex)).join('');

  const sort =
    dated >= 2 && total >= 2
      ? `<div class="sort" role="group" aria-label="Ordenar la evidencia de ${escapeHtml(lane.short)}">
    <button class="sort-btn selected" type="button" data-sort="default" data-lane="${lane.id}" aria-pressed="true">Todos</button>
    <button class="sort-btn" type="button" data-sort="recent" data-lane="${lane.id}" aria-pressed="false">Más recientes</button>
  </div>`
      : '';

  // Always emitted, always hidden at rest: the year slice can empty a lane the report
  // does hold signals for, and that is a different sentence from "this source gave none".
  const sliced = `<p class="empty sliced" hidden>Ninguna señal de esta fuente en los años elegidos.</p>`;

  const more =
    total > visible
      ? `<div class="more-wrap"><button class="more" type="button" data-lane="${lane.id}" aria-controls="body-${lane.id}">${moreLabel(visible, total)}</button></div>`
      : '';

  return `<article class="panel" id="lane-${lane.id}" data-panel="${lane.id}" data-visible="${visible}" data-total="${total}">
  <button class="panel-head" type="button" aria-expanded="false" aria-controls="body-${lane.id}">
    <span class="stop-mark">${lane.mark}</span>
    <span class="panel-title"><span class="panel-name">${escapeHtml(lane.name)}</span><span class="blurb">${escapeHtml(lane.blurb)}</span></span>
    <span class="panel-seen">✓ Evidencia consultada</span>
    <span class="panel-count">${total}</span>
    <span class="panel-cta">Ver evidencia</span>
    <span class="panel-toggle" aria-hidden="true">+</span>
  </button>
  <div class="panel-body" id="body-${lane.id}"><div class="panel-inner">${sort}${items}${sliced}${more}</div></div>
</article>`;
}

// A row carries what tells it apart from its neighbours — what it says and when — and is
// itself the way to the document. The category was identical on every row of a panel and
// the source is the panel's own heading, so neither earns a line here.
function evidenceItem(
  signal: ReportSignal,
  index: number,
  folded: boolean,
  lane: SourceLane,
  laneIndex: number,
): string {
  const when = signal.checked_at === null ? 'sin fecha' : formatDate(signal.checked_at);
  const has = signal.evidence_url !== null;

  const meta = `<span class="meta"><span class="meta-dot" aria-hidden="true"></span>${escapeHtml(when)}<span class="${has ? 'item-doc' : 'item-nodoc'}">${has ? 'documento oficial →' : 'sin documento'}</span><span class="item-seen">✓ consultado</span></span>`;
  const body = `<span class="item-detail">${escapeHtml(signal.detail)}</span>${meta}`;

  const inner = has
    ? `<a class="item-pick" href="${escapeHtml(signal.evidence_url as string)}" target="_blank" rel="noopener">${body}</a>`
    : `<div class="item-pick inert">${body}</div>`;

  return `<div class="item tone-${signal.tone}" data-i="${index}" data-order="${index}" data-date="${signal.checked_at === null ? '' : escapeHtml(signal.checked_at)}"
  data-year="${signal.checked_at === null ? '' : escapeHtml(signal.checked_at.slice(0, 4))}"
  data-lane="${lane.id}" data-lane-i="${laneIndex}" data-key="${escapeHtml(signal.key)}"${folded ? ' hidden' : ''}>
  ${inner}
</div>`;
}

export function market(report: CrevaReport): string {
  const rates = report.signals.filter((signal) => signal.category === 'reference_rate');
  if (rates.length === 0) return '';

  const strip = buildRateStrip(rates);
  const others = rates.filter((rate) => !isPercent(rate));

  const points =
    strip === null
      ? ''
      : strip.points
          .map(
            (point, index) => `<button class="point" type="button" data-point="${index}" style="--p:${point.position}%"
      aria-label="${escapeHtml(point.label)}, ${escapeHtml(point.text)}"
      data-label="${escapeHtml(point.label)}" data-text="${escapeHtml(point.text)}"
      data-date="${point.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(point.checked_at))}"><span class="point-tag">${escapeHtml(point.text)}</span></button>`,
          )
          .join('');

  // Each point already prints its own value, so the detail names what the point cannot:
  // which rate it is and the day it was observed.
  const stripBlock =
    strip === null
      ? ''
      : `<div class="strip">
    <div class="strip-line">${points}</div>
    <p class="strip-scale">Escala de ${strip.domain_low.toFixed(2)}% a ${strip.domain_high.toFixed(2)}%</p>
    <p class="strip-detail" id="strip-detail" aria-live="polite">
      <span class="strip-label" id="strip-label">${escapeHtml(strip.points[0]?.label ?? '')}</span>
      <span class="strip-date" id="strip-date">${strip.points[0]?.checked_at === null || strip.points[0] === undefined ? 'sin fecha' : escapeHtml(formatDate(strip.points[0].checked_at as string))}</span>
    </p>
  </div>`;

  const asideBlock =
    others.length === 0
      ? ''
      : `<div class="aside-rates">
    ${others
      .map(
        (rate) => `<div class="aside-rate">
      <p class="rate-value">${escapeHtml(rate.detail)}</p>
      <p class="rate-label">${escapeHtml(rate.label)} · no es una tasa, por eso va aparte</p>
      <p class="meta">${rate.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(rate.checked_at))}</p>
    </div>`,
      )
      .join('')}
  </div>`;

  return `<section class="block market" data-enter="market">
  <p class="lead">Lo anterior es el negocio. Esto es el entorno: cuánto costaba el dinero el día que consultamos.</p>
  <h2>Contexto de mercado</h2>
  ${stripBlock}
  ${asideBlock}
</section>`;
}

export function audit(report: CrevaReport): string {
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

  const notes =
    report.notes.length === 0
      ? ''
      : fold(
          'Lo que no pudimos ver',
          `<ul class="notes">${report.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`,
        );

  const sources =
    rows === ''
      ? ''
      : fold(
          'Fuentes consultadas y sus fechas',
          `<table class="sources"><thead><tr><th>Proveedor</th><th>Conjunto de datos</th><th>Consultado</th></tr></thead><tbody>${rows}</tbody></table>`,
        );

  // The disclosure never folds. Everything behind it is reference material.
  return `<section class="block audit" data-enter="audit">
  <p class="lead">Ya viste el dato. Aquí está de dónde salió, y lo que este reporte no hace.</p>
  <h2>Sobre este análisis</h2>
  <p class="blurb">${escapeHtml(report.disclosure.describes)} Versión ${escapeHtml(report.disclosure.score_version)}.</p>

  <div class="audit-card wide">
    <p class="label">Lo que NO hace</p>
    <ul class="notes">${report.disclosure.does_not_estimate.map((claim) => `<li>${escapeHtml(claim)}</li>`).join('')}</ul>
  </div>

  ${fold('De dónde sale cada dato', `<div class="audit-grid">${levels}</div>`)}
  ${notes}
  ${sources}
</section>`;
}

function fold(title: string, body: string): string {
  return `<details class="fold">
    <summary>${escapeHtml(title)}</summary>
    <div class="fold-body">${body}</div>
  </details>`;
}

