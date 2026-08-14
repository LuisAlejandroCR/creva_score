// paper: the printable executive summary. Three pages, screen-hidden, print-only.

import { CrevaReport, ReportSignal } from '../../common/types/creva-report.types';
import { SourceLane, escapeHtml, formatDate, formatDateTime, isPercent, plural, statusWord } from './lanes';

const HIGHLIGHTS_PER_LANE = 2;

export function paperTitle(report: CrevaReport): string {
  const name = report.subject?.business_name ?? 'Revisión general';
  return `Creva — Verificación de ${name}`;
}

export function paper(report: CrevaReport, lanes: SourceLane[]): string {
  const name = report.subject?.business_name ?? 'Revisión general';

  return `<article class="paper" id="paper" aria-hidden="true">
  ${coverPage(report, lanes, name)}
  ${signalsPage(report, lanes, name)}
  ${auditPage(report, name)}
</article>`;
}

function runningHead(name: string): string {
  return `<p class="p-head">Verificación pública · Creva | ${escapeHtml(name)}</p>`;
}

function foot(): string {
  return '<p class="p-foot">Documento generado a partir de registros públicos, con la fecha de cada consulta.</p>';
}

function coverPage(report: CrevaReport, lanes: SourceLane[], name: string): string {
  const frame = [
    {
      key: 'Para',
      value:
        'La dueña del negocio y quien evalúe una solicitud de crédito: banca, fintech, fondeador o programa público.',
    },
    {
      key: 'Qué es',
      value: `${report.disclosure.describes} Ventana de ${report.disclosure.window_days} días · versión ${report.disclosure.score_version}.`,
    },
    {
      key: 'Cómo leerlo',
      value:
        'Cada señal trae la fuente que la emitió y la fecha en que se consultó. Nada aquí es una opinión sobre el negocio.',
    },
    {
      key: 'Qué NO decide',
      value: report.disclosure.does_not_estimate.join(' · '),
    },
  ]
    .map(
      (row) => `<tr><th scope="row">${escapeHtml(row.key)}</th><td>${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');

  const map = lanes
    .map(
      (lane, index) => `<div class="p-node n${index}">
      <p class="p-node-name">${escapeHtml(lane.short)}</p>
      <p class="p-node-blurb">${escapeHtml(lane.blurb)}</p>
      <p class="p-node-count">${lane.signals.length} ${plural(lane.signals.length, 'señal', 'señales')}</p>
    </div>`,
    )
    .join('');

  const headline = report.signals.find((signal) => signal.category === 'reference_rate' && isPercent(signal));
  const kpis = [
    { label: 'Señales públicas', value: String(report.signals.length), note: 'con fuente y fecha' },
    { label: 'Fuentes consultadas', value: String(report.sources.length), note: 'registros de gobierno' },
    { label: 'Sello del directorio', value: statusWord(report), note: 'SIEM · registro voluntario' },
    headline === undefined
      ? { label: 'Referencia', value: 'sin dato', note: 'Banco de México' }
      : {
          label: headline.label,
          value: headline.detail,
          note: headline.checked_at === null ? 'Banco de México' : formatDate(headline.checked_at),
        },
  ]
    .map(
      (kpi) => `<div class="p-kpi">
      <p class="p-kpi-label">${escapeHtml(kpi.label)}</p>
      <p class="p-kpi-value">${escapeHtml(kpi.value)}</p>
      <p class="p-kpi-note">${escapeHtml(kpi.note)}</p>
    </div>`,
    )
    .join('');

  return `<section class="p-page">
  ${runningHead(name)}
  <p class="p-eyebrow">Reporte de verificación pública</p>
  <h1 class="p-title">${escapeHtml(name)}</h1>
  <p class="p-sub">${escapeHtml(statusWord(report))} · ${report.signals.length} ${plural(report.signals.length, 'señal pública', 'señales públicas')} · ${report.sources.length} ${plural(report.sources.length, 'fuente consultada', 'fuentes consultadas')}</p>

  <div class="p-kpis">${kpis}</div>

  <table class="p-frame"><tbody>${frame}</tbody></table>

  <div class="p-map">
    <p class="p-map-title">De dónde sale cada señal</p>
    <p class="p-map-sub">Cuatro registros públicos, consultados el mismo día</p>
    <div class="p-nodes">${map}</div>
    <div class="p-arrow" aria-hidden="true"></div>
    <p class="p-pill">Evidencia citada, con fuente y fecha — no un veredicto sobre el negocio</p>
    <p class="p-map-foot">No aparecer en un registro voluntario no dice nada sobre un negocio.</p>
  </div>

  <table class="p-callout"><tbody><tr>
    <th scope="row">Para qué sirve</th>
    <td>Demostrar con datos de gobierno que el negocio existe y opera, cuando todavía no hay historial crediticio que enseñar.</td>
  </tr></tbody></table>
  ${foot()}
</section>`;
}

function signalsPage(report: CrevaReport, lanes: SourceLane[], name: string): string {
  // The bar is the count, scaled to the largest lane. Nothing is inferred.
  const largest = lanes.reduce((top, lane) => Math.max(top, lane.signals.length), 0);
  const rows = lanes
    .map(
      (lane) => `<tr>
      <th scope="row">${escapeHtml(lane.short)}</th>
      <td>${escapeHtml(lane.blurb)}</td>
      <td class="p-bar-cell">${lane.signals.length === 0 ? '' : `<span class="p-bar" style="width:${Math.round((lane.signals.length / largest) * 100)}%"></span>`}</td>
      <td class="p-num">${lane.signals.length}</td>
    </tr>`,
    )
    .join('');

  const highlights = lanes
    .flatMap((lane) => lane.signals.slice(0, HIGHLIGHTS_PER_LANE).map((signal) => ({ lane, signal })))
    .map(
      ({ lane, signal }) => `<tr>
      <th scope="row">${escapeHtml(lane.short)}</th>
      <td>${escapeHtml(signal.detail)}</td>
      <td>${signal.checked_at === null ? '—' : escapeHtml(formatDate(signal.checked_at))}</td>
    </tr>`,
    )
    .join('');

  return `<section class="p-page">
  ${runningHead(name)}
  <h2 class="p-h2">1. Señales por fuente</h2>
  <table class="p-table">
    <thead><tr><th>Fuente</th><th>Qué aporta</th><th>Peso relativo</th><th class="p-num">Señales</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2 class="p-h2">2. Evidencia destacada</h2>
  <p class="p-note">Las primeras de cada fuente. El reporte interactivo las trae todas, con su enlace al documento oficial.</p>
  <table class="p-table">
    <thead><tr><th>Fuente</th><th>Señal</th><th>Fecha</th></tr></thead>
    <tbody>${highlights}</tbody>
  </table>
  ${foot()}
</section>`;
}

function auditPage(report: CrevaReport, name: string): string {
  const rates = report.signals.filter((signal) => signal.category === 'reference_rate');
  const market =
    rates.length === 0
      ? ''
      : `<h2 class="p-h2">3. Contexto de mercado</h2>
  <p class="p-note">Publicado por el Banco de México. Cada cifra trae su propia fecha porque no se publican el mismo día.${
    rates.some((rate) => !isPercent(rate))
      ? ' El valor de la UDI no es una tasa y no se compara contra ellas.'
      : ''
  }</p>
  <table class="p-table">
    <thead><tr><th>Referencia</th><th class="p-num">Valor</th><th>Fecha</th></tr></thead>
    <tbody>${rates.map(rateRow).join('')}</tbody>
  </table>`;

  const provenance = report.disclosure.provenance_levels
    .map(
      (level) => `<tr><th scope="row">${escapeHtml(level.label)}</th><td>${escapeHtml(level.meaning)}</td></tr>`,
    )
    .join('');

  const sources = report.sources
    .map(
      (source) =>
        `<tr><th scope="row">${escapeHtml(source.provider)}</th><td>${escapeHtml(source.dataset)}</td><td>${source.queried_at === null ? '—' : escapeHtml(formatDate(source.queried_at))}</td></tr>`,
    )
    .join('');

  const notes =
    report.notes.length === 0
      ? ''
      : `<table class="p-callout warn"><tbody><tr>
    <th scope="row">Lo que no pudimos ver</th>
    <td>${report.notes.map(escapeHtml).join(' · ')}</td>
  </tr></tbody></table>`;

  return `<section class="p-page">
  ${runningHead(name)}
  ${market}

  <h2 class="p-h2">${rates.length === 0 ? '3' : '4'}. Sobre este análisis</h2>
  <table class="p-callout"><tbody><tr>
    <th scope="row">Lo que NO hace</th>
    <td>${report.disclosure.does_not_estimate.map(escapeHtml).join(' · ')}</td>
  </tr></tbody></table>

  <table class="p-table"><tbody>${provenance}</tbody></table>

  <h2 class="p-h2">${rates.length === 0 ? '4' : '5'}. Fuentes consultadas</h2>
  <table class="p-table">
    <thead><tr><th>Proveedor</th><th>Conjunto de datos</th><th>Consultado</th></tr></thead>
    <tbody>${sources}</tbody>
  </table>
  ${notes}

  <p class="p-generated">Generado el ${escapeHtml(formatDateTime(report.generated_at))}.</p>
  ${foot()}
</section>`;
}

function rateRow(rate: ReportSignal): string {
  return `<tr>
    <th scope="row">${escapeHtml(rate.label)}</th>
    <td class="p-num">${escapeHtml(rate.detail)}</td>
    <td>${rate.checked_at === null ? '—' : escapeHtml(formatDate(rate.checked_at))}</td>
  </tr>`;
}
