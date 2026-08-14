// report: renders a report into one self-contained page. Presentation only.

import { CrevaReport } from '../../common/types/creva-report.types';
import { buildLanes, escapeHtml, statusWord } from './lanes';
import { audit, closing, composition, evidence, hero, investigation, market, why } from './sections';
import { paper, paperTitle } from './paper';
import { script } from './script';
import { styles } from './styles';

export { moreLabel, nextVisible } from './lanes';

interface Stage {
  id: string;
  num: string;
  name: string;
  body: string;
}

export function renderReportHtml(report: CrevaReport): string {
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  const lanes = buildLanes(report);
  const name = report.subject?.business_name ?? 'Revisión general';
  const marketBody = market(report);

  const stages: Stage[] = [
    { id: 'summary', num: '01', name: 'Resumen', body: hero(report, lanes) },
    { id: 'signals', num: '02', name: 'Señales', body: composition(report, lanes) },
    { id: 'evidence', num: '03', name: 'Evidencia', body: evidence(lanes) },
    ...(marketBody === '' ? [] : [{ id: 'market', num: '04', name: 'Mercado', body: marketBody }]),
    { id: 'audit', num: '05', name: 'Auditoría', body: `${why(report)}${audit(report)}${closing(report)}` },
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
      <nav class="stages" id="stages" role="tablist" aria-label="Etapas del reporte">${stages.map(tab).join('')}</nav>
      <div class="panes">${stages.map((stage, index) => pane(stage, index, stages)).join('')}</div>
    </div>
  </section>
</main>

${paper(report, lanes)}

<script>window.CREVA_SHARE=${JSON.stringify({ title: paperTitle(report), summary: shareSummary(report) }).replace(/</g, '\\u003c')};window.CREVA_REPORT=${data};${script()}</script>
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

function tab(stage: Stage, index: number): string {
  const first = index === 0;

  return `<button class="stage-tab${first ? ' current' : ''}" type="button" role="tab" id="tab-${stage.id}"
    data-stage="${stage.id}" aria-controls="pane-${stage.id}" aria-selected="${first ? 'true' : 'false'}" tabindex="${first ? '0' : '-1'}">
    <span class="stage-num">${stage.num}</span>
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

  return `<section class="pane" role="tabpanel" id="pane-${stage.id}" data-pane="${stage.id}"
    aria-labelledby="tab-${stage.id}" tabindex="-1"${index === 0 ? '' : ' hidden'}>${stage.body}${steps}</section>`;
}
