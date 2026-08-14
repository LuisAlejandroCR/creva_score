// paper: the printable executive summary. Two pages, screen-hidden, print-only.

import { CrevaReport, ReportSignal } from '../../common/types/creva-report.types';
import { SourceLane, escapeHtml, formatDate, isPercent, plural, statusWord } from './lanes';
import { ranked, ring, summaryKpis } from './sections';

const HIGHLIGHTS = 3;

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
  return `<p class="p-head">Creva · verificación pública | ${escapeHtml(name)}</p>`;
}

function coverPage(report: CrevaReport, lanes: SourceLane[], name: string): string {
  const kpis = summaryKpis(report, lanes)
    .map(
      (kpi) => `<div class="p-kpi">
      <p class="p-kpi-label">${escapeHtml(kpi.label)}</p>
      <p class="p-kpi-value">${escapeHtml(kpi.value)}</p>
      ${kpi.sub === null ? '' : `<p class="p-kpi-sub">${escapeHtml(kpi.sub)}</p>`}
      <p class="p-kpi-note">${escapeHtml(kpi.note)}</p>
    </div>`,
    )
    .join('');

  return `<section class="p-page">
  ${runningHead(name)}
  <p class="p-eyebrow">Verificación pública</p>
  <h1 class="p-title">${escapeHtml(name)}</h1>
  <p class="p-sub">${escapeHtml(statusWord(report))} · ${report.signals.length} ${plural(report.signals.length, 'señal', 'señales')} · ${report.sources.length} ${plural(report.sources.length, 'fuente', 'fuentes')}</p>

  <div class="p-kpis">${kpis}</div>

  <div class="p-dates">
    <div class="p-date a">
      <p class="p-date-label">Consultado</p>
      <p class="p-date-value">${escapeHtml(formatDate(report.generated_at.slice(0, 10)))}</p>
    </div>
    <div class="p-date b">
      <p class="p-date-label">Ventana</p>
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

  <h2 class="p-h2">Evidencia más reciente</h2>
  <div class="p-evs">${highlights(report, lanes)}</div>
</section>`;
}

function highlights(report: CrevaReport, lanes: SourceLane[]): string {
  return lanes
    .filter((lane) => lane.signals.every((signal) => signal.category !== 'reference_rate'))
    .flatMap((lane) => lane.signals.map((signal) => ({ lane, signal })))
    .sort((a, b) => (b.signal.checked_at ?? '').localeCompare(a.signal.checked_at ?? ''))
    .slice(0, HIGHLIGHTS)
    .map(
      ({ lane, signal }) => `<div class="p-ev">
      <p class="p-ev-top"><span class="p-chip c${lanes.indexOf(lane)}">${escapeHtml(lane.short)}</span><span class="p-ev-date">${signal.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(signal.checked_at))}</span></p>
      <p class="p-ev-text">${escapeHtml(signal.detail)}</p>
    </div>`,
    )
    .join('');
}

function detailPage(report: CrevaReport, lanes: SourceLane[], name: string): string {
  const rates = report.signals.filter((signal) => signal.category === 'reference_rate');

  const sources = report.sources
    .map(
      (source) =>
        `<span class="p-src"><strong>${escapeHtml(source.provider)}</strong> ${source.queried_at === null ? '—' : escapeHtml(formatDate(source.queried_at))}</span>`,
    )
    .join('');

  return `<section class="p-page">
  ${runningHead(name)}
  ${
    rates.length === 0
      ? ''
      : `<h2 class="p-h2">Contexto de mercado</h2>
  <div class="p-rates">${rates.map(rateCard).join('')}</div>`
  }

  <div class="p-limits">
    <p class="p-limits-title">Lo que NO hace</p>
    <ul class="p-limits-list">${report.disclosure.does_not_estimate.map((claim) => `<li>${escapeHtml(claim)}</li>`).join('')}</ul>
  </div>

  <p class="p-srcs-title">Fuentes consultadas</p>
  <div class="p-srcs">${sources}</div>
  <p class="p-foot">Registros públicos, con la fecha de cada consulta. No es un veredicto.</p>
</section>`;
}

function rateCard(rate: ReportSignal): string {
  return `<div class="p-rate${isPercent(rate) ? '' : ' apart'}">
    <p class="p-rate-value">${escapeHtml(rate.detail)}</p>
    <p class="p-rate-label">${escapeHtml(rate.label)}</p>
    <p class="p-rate-date">${rate.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(rate.checked_at))}</p>
  </div>`;
}
