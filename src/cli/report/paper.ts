// paper: the printable executive summary. Three pages, screen-hidden, print-only.

import { CrevaReport, ReportSignal } from '../../common/types/creva-report.types';
import { SourceLane, escapeHtml, formatDate, formatDateTime, isPercent, plural, statusWord } from './lanes';
import { ranked, ring, timeline } from './sections';

const HIGHLIGHTS_PER_LANE = 2;

export function paperTitle(report: CrevaReport): string {
  const name = report.subject?.business_name ?? 'Revisión general';
  return `Creva — Verificación de ${name}`;
}

export function paper(report: CrevaReport, lanes: SourceLane[]): string {
  const name = report.subject?.business_name ?? 'Revisión general';

  return `<article class="paper" id="paper" aria-hidden="true">
  ${coverPage(report, lanes, name)}
  ${detailPage(report, lanes, name)}
</article>`;
}

function runningHead(name: string): string {
  return `<p class="p-head">Verificación pública · Creva | ${escapeHtml(name)}</p>`;
}

function foot(): string {
  return '<p class="p-foot">Documento generado a partir de registros públicos, con la fecha de cada consulta.</p>';
}


function coverPage(report: CrevaReport, lanes: SourceLane[], name: string): string {
  const headline = report.signals.find((signal) => signal.category === 'reference_rate' && isPercent(signal));
  const kpis = [
    { label: 'Señales públicas', value: String(report.signals.length), note: 'con fuente y fecha' },
    {
      label: 'Fuentes que respondieron',
      value: `${lanes.filter((lane) => lane.signals.length > 0).length}/${lanes.length}`,
      note: 'registros de gobierno',
    },
    { label: 'Sello del directorio', value: statusWord(report), note: 'SIEM · voluntario' },
    headline === undefined
      ? { label: 'Referencia', value: 'sin dato', note: 'Banco de México' }
      : {
          label: headline.label,
          value: headline.detail,
          note: headline.checked_at === null ? 'Banxico' : formatDate(headline.checked_at),
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

  const map = lanes
    .map(
      (lane, index) => `<div class="p-node n${index}">
      <p class="p-node-name">${escapeHtml(lane.short)}</p>
      <p class="p-node-count">${lane.signals.length}</p>
    </div>`,
    )
    .join('');

  return `<section class="p-page">
  ${runningHead(name)}
  <p class="p-eyebrow">Reporte de verificación pública</p>
  <h1 class="p-title">${escapeHtml(name)}</h1>
  <p class="p-sub">${escapeHtml(statusWord(report))} · ${report.signals.length} ${plural(report.signals.length, 'señal pública', 'señales públicas')} · ${report.sources.length} ${plural(report.sources.length, 'fuente', 'fuentes')}</p>

  <div class="p-kpis">${kpis}</div>

  <div class="p-dates">
    <div class="p-date a">
      <p class="p-date-label">Consultado el</p>
      <p class="p-date-value">${escapeHtml(formatDate(report.generated_at.slice(0, 10)))}</p>
    </div>
    <div class="p-date b">
      <p class="p-date-label">Ventana revisada</p>
      <p class="p-date-value">${report.disclosure.window_days} días</p>
    </div>
  </div>

  <div class="p-board">
    <div class="p-card">
      <p class="p-card-title">Reparto</p>
      <div class="p-ring">${ring(lanes, report.signals.length)}</div>
    </div>
    <div class="p-card wide">
      <p class="p-card-title">Señales por fuente</p>
      <div class="p-ranked">${ranked(lanes, report.signals.length)}</div>
    </div>
  </div>

  <div class="p-map">
    <div class="p-nodes">${map}</div>
    <div class="p-arrow" aria-hidden="true"></div>
    <p class="p-pill">Evidencia citada, con fuente y fecha — no un veredicto</p>
  </div>
  ${foot()}
</section>`;
}

function detailPage(report: CrevaReport, lanes: SourceLane[], name: string): string {
  const rates = report.signals.filter((signal) => signal.category === 'reference_rate');

  const highlights = lanes
    .flatMap((lane) => lane.signals.slice(0, HIGHLIGHTS_PER_LANE).map((signal) => ({ lane, signal })))
    .map(
      ({ lane, signal }) => `<div class="p-ev">
      <p class="p-ev-top"><span class="p-chip c${lanes.indexOf(lane)}">${escapeHtml(lane.short)}</span><span class="p-ev-date">${signal.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(signal.checked_at))}</span></p>
      <p class="p-ev-text">${escapeHtml(signal.detail)}</p>
    </div>`,
    )
    .join('');

  const sources = report.sources
    .map(
      (source) =>
        `<span class="p-src"><strong>${escapeHtml(source.provider)}</strong> ${escapeHtml(source.dataset)} · ${source.queried_at === null ? '—' : escapeHtml(formatDate(source.queried_at))}</span>`,
    )
    .join('');

  return `<section class="p-page">
  ${runningHead(name)}
  ${timeline(lanes).replace('card tl-card', 'p-card').replace(/"tl/g, '"p-tl')}

  <h2 class="p-h2">Evidencia destacada</h2>
  <div class="p-evs">${highlights}</div>

  ${rates.length === 0 ? '' : `<h2 class="p-h2">Contexto de mercado</h2>
  <div class="p-rates">${rates.map(rateCard).join('')}</div>`}

  <table class="p-callout"><tbody><tr>
    <th scope="row">Lo que NO hace</th>
    <td>${report.disclosure.does_not_estimate.map(escapeHtml).join(' · ')}</td>
  </tr></tbody></table>

  <p class="p-srcs-title">Fuentes consultadas</p>
  <div class="p-srcs">${sources}</div>
  <p class="p-generated">Generado el ${escapeHtml(formatDateTime(report.generated_at))}.</p>
  ${foot()}
</section>`;
}

function rateCard(rate: ReportSignal): string {
  return `<div class="p-rate${isPercent(rate) ? '' : ' apart'}">
    <p class="p-rate-value">${escapeHtml(rate.detail)}</p>
    <p class="p-rate-label">${escapeHtml(rate.label)}</p>
    <p class="p-rate-date">${rate.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(rate.checked_at))}</p>
  </div>`;
}
