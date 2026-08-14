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
import { timeline } from './timeline';

const NODE_X = [90, 230, 370, 510];
const ROOT = { x: 300, y: 62 };

function linkPath(index: number): string {
  const x = NODE_X[index] ?? 300;
  return `M${ROOT.x} ${ROOT.y} C${ROOT.x} 110 ${x} 100 ${x} 143`;
}


const RING = 2 * Math.PI * 52;

export function ring(lanes: SourceLane[], total: number): string {
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

  return `<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="Reparto de las ${total} señales entre las fuentes" xmlns="http://www.w3.org/2000/svg">
    <circle class="ring-track" cx="60" cy="60" r="52"/>
    ${arcs}
    <text class="ring-n" x="60" y="58">${total}</text>
    <text class="ring-l" x="60" y="74">señales</text>
  </svg>`;
}

export function ranked(lanes: SourceLane[], total: number): string {
  const largest = lanes.reduce((top, lane) => Math.max(top, lane.signals.length), 0);

  return lanes
    .map((lane, index) => {
      const share = total === 0 ? 0 : Math.round((lane.signals.length / total) * 100);
      const width = largest === 0 ? 0 : Math.round((lane.signals.length / largest) * 100);

      return `<button class="rank a${index}" type="button" data-lane="${lane.id}" style="--i:${index}">
      <span class="rank-i">${index + 1}</span>
      <span class="rank-name">${escapeHtml(lane.short)}</span>
      <span class="rank-track">${lane.signals.length === 0 ? '' : `<span class="rank-bar" style="--w:${width}%"></span>`}</span>
      <span class="rank-n">${lane.signals.length}</span>
      <span class="rank-share">${share}%</span>
    </button>`;
    })
    .join('');
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

export interface Kpi {
  label: string;
  value: string;
  note: string;
  count: boolean;
}

// One definition, read by the screen and by the printable, so the two cannot drift apart.
export function summaryKpis(report: CrevaReport): Kpi[] {
  const headline = report.signals.find((s) => s.category === 'reference_rate' && isPercent(s));

  return [
    { label: 'Señales', value: String(report.signals.length), note: 'con fuente y fecha', count: true },
    { label: 'Fuentes', value: String(report.sources.length), note: 'registros de gobierno', count: false },
    { label: 'Directorio', value: statusWord(report), note: 'SIEM · voluntario', count: false },
    headline === undefined
      ? { label: 'Referencia', value: 'sin dato', note: 'Banco de México', count: false }
      : {
          label: headline.label,
          value: headline.detail,
          note: headline.checked_at === null ? 'Banco de México' : formatDate(headline.checked_at),
          count: false,
        },
  ];
}

// The summary is the index. It states each figure once and hands off; every chart is
// drawn in the stage it belongs to, never previewed here as a second copy.
export function hero(report: CrevaReport, lanes: SourceLane[]): string {
  const kpis = summaryKpis(report)
    .map(
      (kpi, index) => `<div class="kpi" style="--i:${index}">
    <p class="kpi-label">${escapeHtml(kpi.label)}</p>
    <p class="kpi-value"${kpi.count ? ` id="kpi-count" data-count="${report.signals.length}"` : ''}>${escapeHtml(kpi.value)}</p>
    <p class="kpi-note">${escapeHtml(kpi.note)}</p>
  </div>`,
    )
    .join('');

  return `<section class="block hero" data-enter="hero">
  <div class="kpis" id="kpis">${kpis}</div>
  <div class="jumps" id="jumps">${jumpCards(report, lanes)}</div>
</section>`;
}

function jumpCards(report: CrevaReport, lanes: SourceLane[]): string {
  const rates = report.signals.filter((signal) => signal.category === 'reference_rate');
  const documented = report.signals.filter((signal) => signal.evidence_url !== null).length;

  const doors = [
    {
      id: 'signals',
      num: '02',
      name: 'Señales',
      figure: `${lanes.filter((lane) => lane.signals.length > 0).length}/${lanes.length}`,
      note: 'fuentes devolvieron algo',
    },
    {
      id: 'evidence',
      num: '03',
      name: 'Evidencia',
      figure: String(documented),
      note: 'con documento oficial',
    },
    ...(rates.length === 0
      ? []
      : [{ id: 'market', num: '04', name: 'Mercado', figure: String(rates.length), note: 'referencias de Banxico' }]),
    {
      id: 'audit',
      num: '05',
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

export function composition(report: CrevaReport, lanes: SourceLane[]): string {
  const total = report.signals.length;
  const answered = lanes.filter((lane) => lane.signals.length > 0).length;

  return `<section class="block composition" data-enter="rail">
  <h2>Señales por fuente</h2>

  <div class="board">
    <div class="card">
      <p class="card-title">¿De qué fuente salió cada señal?</p>
      <div class="ranked" id="ranked">${ranked(lanes, total)}</div>
    </div>
    <div class="card" id="comp-detail" aria-live="polite">
      <p class="card-title">Reparto</p>
      <div class="ring-wrap">${ring(lanes, total)}</div>
      <p class="card-note" id="comp-detail-label"><strong>${answered}</strong> de ${lanes.length} fuentes devolvieron algo</p>
      <button class="comp-go" id="comp-go" type="button" hidden>Explorar evidencia →</button>
    </div>
  </div>

  ${timeline(lanes)}
</section>`;
}

export function evidence(lanes: SourceLane[]): string {
  const total = lanes.reduce((sum, lane) => sum + lane.signals.length, 0);

  const filters = [{ id: 'all', short: 'Todas' }, ...lanes.map((lane) => ({ id: lane.id, short: lane.short }))]
    .map(
      (filter, index) =>
        `<button class="filter${index === 0 ? ' selected' : ''}" type="button" data-filter="${filter.id}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(filter.short)}</button>`,
    )
    .join('');

  return `<section class="block evidence" data-enter="evidence">
  <h2>Evidencia</h2>

  <div class="filters" role="group" aria-label="Filtrar evidencia por fuente">${filters}</div>
  <p class="filter-result" id="filter-result" aria-live="polite">${total} ${plural(total, 'resultado', 'resultados')}</p>

  <div class="ev-board">
    <div class="panels">${lanes.map(panel).join('')}</div>
    ${selected(lanes)}
  </div>
</section>`;
}

// The detail is the drill-down: choosing an item fills it in place, without leaving the stage.
function selected(lanes: SourceLane[]): string {
  const lane = lanes.find((candidate) => candidate.signals.length > 0);
  const signal = lane?.signals[0];
  if (lane === undefined || signal === undefined) return '';

  return `<aside class="card ev-detail" id="ev-detail" aria-live="polite">
    <p class="card-title">Señal seleccionada</p>
    <p class="ev-top">
      <span class="ev-chip d${lanes.indexOf(lane)}" id="ev-chip">${escapeHtml(lane.short)}</span>
      <span class="ev-date" id="ev-date">${signal.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(signal.checked_at))}</span>
    </p>
    <p class="ev-label" id="ev-label">${escapeHtml(signal.label)}</p>
    <p class="ev-text" id="ev-text">${escapeHtml(signal.detail)}</p>
    <p class="ev-source" id="ev-source">${escapeHtml(signal.source)}</p>
    <a class="doc" id="ev-doc" href="${signal.evidence_url === null ? '' : escapeHtml(signal.evidence_url)}" target="_blank" rel="noopener"${signal.evidence_url === null ? ' hidden' : ''}>Ver documento oficial <span class="doc-go" aria-hidden="true">→</span></a>
  </aside>`;
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
  <div class="panel-body" id="body-${lane.id}"><div class="panel-inner">${sort}${items}${more}</div></div>
</article>`;
}

function evidenceItem(
  signal: ReportSignal,
  index: number,
  folded: boolean,
  lane: SourceLane,
  laneIndex: number,
): string {
  const link =
    signal.evidence_url === null
      ? ''
      : `<a class="doc" href="${escapeHtml(signal.evidence_url)}" target="_blank" rel="noopener">Ver documento oficial <span class="doc-go" aria-hidden="true">→</span></a>`;

  return `<div class="item tone-${signal.tone}" data-i="${index}" data-order="${index}" data-date="${signal.checked_at === null ? '' : escapeHtml(signal.checked_at)}"
  data-lane="${lane.id}" data-lane-i="${laneIndex}" data-short="${escapeHtml(lane.short)}"
  data-label="${escapeHtml(signal.label)}" data-detail="${escapeHtml(signal.detail)}" data-source="${escapeHtml(signal.source)}"
  data-when="${signal.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(signal.checked_at))}"
  data-url="${signal.evidence_url === null ? '' : escapeHtml(signal.evidence_url)}"${folded ? ' hidden' : ''}>
  <button class="item-pick" type="button">
    <span class="item-label">${escapeHtml(signal.label)}</span>
    <span class="item-detail">${escapeHtml(signal.detail)}</span>
  </button>
  <p class="meta"><span class="meta-dot" aria-hidden="true"></span>${escapeHtml(signal.source)}${signal.checked_at === null ? '' : ` · ${escapeHtml(formatDate(signal.checked_at))}`}<span class="item-seen">✓ consultado</span></p>
  ${link}
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

