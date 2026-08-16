// report: renders a report into one self-contained page. Presentation only.

import { CrevaReport } from '../../common/types/creva-report.types';
import { buildLanes, escapeHtml, formatDate, statusWord } from './lanes';
import { audit, hero, investigation, market, reportShape, signals } from './sections';
import { paper, paperTitle } from './paper';
import { script } from './script';
import { styles } from './styles';

export { moreLabel, nextVisible } from './lanes';

interface Stage {
  id: string;
  name: string;
  body: string;
}

export function renderReportHtml(report: CrevaReport): string {
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  const lanes = buildLanes(report);
  const name = report.subject?.business_name ?? 'Revisión general';
  // With nothing found about the subject, the evidence and market stages hold only material
  // that is identical for every reader. Keeping them would pad the report with content the
  // summary has just said is not hers.
  const empty = reportShape(report) === 'sin-registro';
  const marketBody = empty ? '' : market(report);

  const stages: Stage[] = [
    { id: 'summary', name: 'Resumen', body: hero(report, lanes) },
    ...(empty ? [] : [{ id: 'signals', name: 'Señales', body: signals(report, lanes) }]),
    ...(marketBody === '' ? [] : [{ id: 'market', name: 'Mercado', body: marketBody }]),
    { id: 'audit', name: 'Auditoría', body: audit(report) },
  ];

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
  <button class="bar-all" id="show-all" type="button" aria-pressed="false">Ver todo</button>
  <button class="bar-all" id="to-pdf" type="button">Descargar PDF</button>
  <button class="bar-all share" id="to-whatsapp" type="button">Compartir</button>
</header>

<main>
  ${investigation(report, lanes, name)}

  <section class="stage report staging" id="stage-report">
    <div class="workspace">
      <div class="rail" id="rail">
        <nav class="stages" id="stages" role="tablist" aria-label="Etapas del reporte">${stages.map(tab).join('')}</nav>
        <div class="rail-dates">
          <div class="date-card a"><p class="date-label">Consultado</p><p class="date-value">${escapeHtml(formatDate(report.generated_at.slice(0, 10)))}</p></div>
          <div class="date-card b"><p class="date-label">Ventana</p><p class="date-value">${report.disclosure.window_days} días</p></div>
        </div>
      </div>
      <div class="panes">${stages.map((stage, index) => pane(stage, index, stages)).join('')}</div>
    </div>
  </section>
</main>

${paper(report, lanes)}

<script>window.CREVA_SHARE=${JSON.stringify({ title: paperTitle(report), summary: shareSummary(report), file: shareFileName(report) }).replace(/</g, '\\u003c')};window.CREVA_REPORT=${data};${script()}</script>
</body>
</html>`;
}

// What travels in a share message: public figures and the source. Never an RFC,
// never anything that identifies a person — a URL is not a private channel.
function shareSummary(report: CrevaReport): string {
  const signals = report.signals.length;
  const sources = report.sources.length;
  const word = statusWord(report);

  return `${signals} ${signals === 1 ? 'señal pública' : 'señales públicas'} de ${sources} ${sources === 1 ? 'fuente de gobierno' : 'fuentes de gobierno'}, cada una con su fuente y su fecha. Directorio oficial: ${word}.`;
}

function shareFileName(report: CrevaReport): string {
  const name = report.subject?.business_name ?? 'revision-general';
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `creva-${slug === '' ? 'reporte' : slug}`;
}

function tab(stage: Stage, index: number): string {
  const first = index === 0;

  return `<button class="stage-tab${first ? ' current' : ''}" type="button" role="tab" id="tab-${stage.id}"
    data-stage="${stage.id}" aria-controls="pane-${stage.id}" aria-selected="${first ? 'true' : 'false'}" tabindex="${first ? '0' : '-1'}">
    <span class="stage-num">${String(index + 1).padStart(2, '0')}</span>
    <span class="stage-name">${escapeHtml(stage.name)}</span>
    <span class="stage-mark" aria-hidden="true">${first ? '●' : '○'}</span>
  </button>`;
}

function pane(stage: Stage, index: number, all: Stage[]): string {
  const previous = all[index - 1];
  const next = all[index + 1];

  const steps = `<nav class="steps" aria-label="Moverse entre etapas">
    ${previous === undefined ? '<span></span>' : `<button class="step back" type="button" data-step="${previous.id}">← ${escapeHtml(previous.name)}</button>`}
    ${next === undefined ? '<span></span>' : `<button class="step next" type="button" data-step="${next.id}">${escapeHtml(next.name)} →</button>`}
  </nav>`;

  // Only Señales is long enough to strand a reader at the bottom; the other stages fit
  // in a screen or two, where the control would be noise.
  const top =
    stage.id === 'signals'
      ? `<button class="to-top" type="button">Volver arriba <span class="to-top-go" aria-hidden="true">↑</span></button>`
      : '';

  return `<section class="pane" role="tabpanel" id="pane-${stage.id}" data-pane="${stage.id}"
    aria-labelledby="tab-${stage.id}" tabindex="-1"${index === 0 ? '' : ' hidden'}>${stage.body}${steps}${top}</section>`;
}
