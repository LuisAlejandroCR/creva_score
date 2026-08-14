// sections: the markup of every stage of the page.

import { CrevaReport, ReportSignal } from '../../common/types/creva-report.types';
import {
  SourceLane,
  escapeHtml,
  formatDate,
  formatDateTime,
  isPercent,
  moreLabel,
  plural,
  statusWord,
  visibleFor,
} from './lanes';
import { buildRateStrip } from './rate-strip';

const NODE_X = [90, 230, 370, 510];
const ROOT = { x: 300, y: 62 };

function linkPath(index: number): string {
  const x = NODE_X[index] ?? 300;
  return `M${ROOT.x} ${ROOT.y} C${ROOT.x} 110 ${x} 100 ${x} 143`;
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

export function hero(report: CrevaReport, lanes: SourceLane[]): string {
  const signals = report.signals.length;
  const verification = report.signals.find((s) => s.category === 'business_verification');
  const tone = verification?.tone ?? 'neutral';
  const headline = report.signals.find((s) => s.category === 'reference_rate' && isPercent(s));

  const kpis = [
    { label: 'Fuentes consultadas', value: String(report.sources.length), note: 'registros de gobierno' },
    { label: 'Sello del directorio', value: statusWord(report), note: 'SIEM · registro voluntario' },
    headline === undefined
      ? { label: 'Referencia de mercado', value: 'sin dato', note: 'Banco de México' }
      : {
          label: headline.label,
          value: headline.detail,
          note: headline.checked_at === null ? 'Banco de México' : formatDate(headline.checked_at),
        },
  ]
    .map(
      (kpi, index) => `<div class="kpi" style="--i:${index}">
    <p class="kpi-label">${escapeHtml(kpi.label)}</p>
    <p class="kpi-value">${escapeHtml(kpi.value)}</p>
    <p class="kpi-note">${escapeHtml(kpi.note)}</p>
  </div>`,
    )
    .join('');

  const jumps = jumpCards(report, lanes);

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

  <div class="kpis" id="kpis">${kpis}</div>
  ${verification === undefined ? '' : `<p class="hero-note">${escapeHtml(verification.detail)}</p>`}
  <div class="jumps" id="jumps">${jumps}</div>
</section>`;
}

function jumpCards(report: CrevaReport, lanes: SourceLane[]): string {
  const rates = report.signals.filter((signal) => signal.category === 'reference_rate').length;
  const cards = [
    { id: 'signals', num: '02', name: 'Señales', figure: String(lanes.length), note: 'fuentes, y qué aportó cada una' },
    {
      id: 'evidence',
      num: '03',
      name: 'Evidencia',
      figure: String(report.signals.length),
      note: 'señales con su fuente y su fecha',
    },
    ...(rates === 0
      ? []
      : [{ id: 'market', num: '04', name: 'Mercado', figure: String(rates), note: 'referencias del Banco de México' }]),
    { id: 'audit', num: '05', name: 'Auditoría', figure: '—', note: 'lo que este análisis no estima' },
  ];

  return cards
    .map(
      (card, index) => `<button class="jump" type="button" data-step="${card.id}" style="--i:${index}">
    <span class="jump-num">${card.num}</span>
    <span class="jump-name">${escapeHtml(card.name)}</span>
    <span class="jump-figure">${escapeHtml(card.figure)}</span>
    <span class="jump-note">${escapeHtml(card.note)}</span>
  </button>`,
    )
    .join('');
}

export function composition(report: CrevaReport, lanes: SourceLane[]): string {
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
    <div class="comp-detail" id="comp-detail" aria-live="polite">
      <p class="comp-detail-n"><span id="comp-detail-n" data-count="${report.signals.length}" data-total-count="${report.signals.length}">0</span></p>
      <p class="comp-detail-label" id="comp-detail-label">señales en total</p>
      <button class="comp-go" id="comp-go" type="button" hidden>Explorar evidencia →</button>
    </div>
    <div class="comp-rows" id="comp-rows">${rows}</div>
  </div>
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
  <p class="blurb">Cada señal con su fuente y su fecha. Se muestran las primeras; el resto se pide.</p>

  <div class="filters" role="group" aria-label="Filtrar evidencia por fuente">${filters}</div>
  <p class="filter-result" id="filter-result" aria-live="polite">${total} ${plural(total, 'resultado', 'resultados')}</p>

  <div class="panels">${lanes.map(panel).join('')}</div>
</section>`;
}

function panel(lane: SourceLane): string {
  const visible = visibleFor(lane.id);
  const total = lane.signals.length;
  const dated = lane.signals.filter((signal) => signal.checked_at !== null).length;

  const items =
    total === 0
      ? '<p class="empty">Sin señales de esta fuente en la revisión.</p>'
      : lane.signals.map((signal, index) => evidenceItem(signal, index, index >= visible)).join('');

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

function evidenceItem(signal: ReportSignal, index: number, folded: boolean): string {
  const link =
    signal.evidence_url === null
      ? ''
      : `<a class="doc" href="${escapeHtml(signal.evidence_url)}" target="_blank" rel="noopener">Ver documento oficial <span class="doc-go" aria-hidden="true">→</span></a>`;

  return `<div class="item tone-${signal.tone}" data-i="${index}" data-order="${index}" data-date="${signal.checked_at === null ? '' : escapeHtml(signal.checked_at)}"${folded ? ' hidden' : ''}>
  <p class="item-label">${escapeHtml(signal.label)}</p>
  <p class="item-detail">${escapeHtml(signal.detail)}</p>
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

  const stripBlock =
    strip === null
      ? ''
      : `<div class="strip">
    <div class="strip-line">${points}</div>
    <p class="strip-scale">Escala de ${strip.domain_low.toFixed(2)}% a ${strip.domain_high.toFixed(2)}%</p>
    <div class="strip-detail" id="strip-detail" aria-live="polite">
      <p class="strip-value" id="strip-value">${escapeHtml(strip.points[0]?.text ?? '')}</p>
      <p class="strip-label" id="strip-label">${escapeHtml(strip.points[0]?.label ?? '')}</p>
      <p class="meta" id="strip-date">${strip.points[0]?.checked_at === null || strip.points[0] === undefined ? 'sin fecha' : escapeHtml(formatDate(strip.points[0].checked_at as string))}</p>
    </div>
  </div>`;

  const asideBlock =
    others.length === 0
      ? ''
      : `<div class="aside-rates">
    <p class="label">No es una tasa, y por eso va aparte</p>
    ${others
      .map(
        (rate) => `<div class="aside-rate">
      <p class="rate-value">${escapeHtml(rate.detail)}</p>
      <p class="rate-label">${escapeHtml(rate.label)}</p>
      <p class="meta">${rate.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(rate.checked_at))}</p>
    </div>`,
      )
      .join('')}
  </div>`;

  return `<section class="block market" data-enter="market">
  <h2>Contexto de mercado</h2>
  <p class="blurb">Publicado por el Banco de México. Cada cifra trae su propia fecha, porque no se publican el mismo día.</p>
  ${stripBlock}
  ${asideBlock}
  <div class="pulse" aria-hidden="true"></div>
</section>`;
}

export function why(report: CrevaReport): string {
  const verified = report.signals.some((s) => s.category === 'business_verification' && s.tone === 'positive');

  const steps = [
    {
      head: verified ? 'Negocio verificado' : 'Negocio consultado',
      blurb: 'Contra el directorio oficial, con la fecha de la consulta.',
    },
    { head: 'Contexto normativo', blurb: 'Lo que se publicó y lo que ya estaba vigente.' },
    { head: 'Contexto financiero', blurb: 'La referencia contra la que se mide una oferta de crédito.' },
  ]
    .map(
      (step, index) => `<li class="why-step" data-step="${index}">
    <span class="why-rail" aria-hidden="true">
      <span class="why-n"><span class="why-num">${String(index + 1).padStart(2, '0')}</span><span class="why-check">✓</span></span>
      <span class="why-line"></span>
    </span>
    <span class="why-body">
      <span class="why-head">${escapeHtml(step.head)}</span>
      <span class="blurb">${escapeHtml(step.blurb)}</span>
    </span>
  </li>`,
    )
    .join('');

  return `<section class="block why" data-enter="market">
  <h2>Por qué importa</h2>
  <ol class="why-steps">${steps}</ol>
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
  <p class="blurb">${escapeHtml(report.disclosure.describes)} Ventana de ${report.disclosure.window_days} días · versión ${escapeHtml(report.disclosure.score_version)}.</p>

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

export function closing(report: CrevaReport): string {
  return `<section class="block closing" data-enter="audit">
  <p class="closing-arc">Información pública → Evidencia estructurada → Contexto para decidir</p>
  <p class="closing-tally">${report.signals.length} señales · ${report.sources.length} fuentes · ${escapeHtml(formatDateTime(report.generated_at))}</p>
</section>`;
}
