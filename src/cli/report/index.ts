// report: renders a report into one self-contained page. Presentation only.

import { CrevaReport } from '../../common/types/creva-report.types';
import { buildLanes, escapeHtml, statusWord } from './lanes';
import { audit, closing, composition, evidence, hero, investigation, market, why } from './sections';
import { script } from './script';
import { styles } from './styles';

export { moreLabel, nextVisible } from './lanes';

const SECTIONS = [
  { id: 'sec-hero', label: 'Resumen' },
  { id: 'sec-composition', label: 'Composición' },
  { id: 'sec-evidence', label: 'Evidencia' },
  { id: 'sec-market', label: 'Contexto de mercado' },
  { id: 'sec-why', label: 'Por qué importa' },
  { id: 'sec-audit', label: 'Sobre este análisis' },
];

export function renderReportHtml(report: CrevaReport): string {
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  const lanes = buildLanes(report);
  const name = report.subject?.business_name ?? 'Revisión general';
  const hasMarket = report.signals.some((signal) => signal.category === 'reference_rate');
  const dots = SECTIONS.filter((section) => hasMarket || section.id !== 'sec-market')
    .map(
      (section) =>
        `<button class="dot-nav" type="button" data-goto="${section.id}" aria-label="Ir a ${escapeHtml(section.label)}"></button>`,
    )
    .join('');

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

<nav class="dots" id="dots" aria-label="Secciones del reporte">${dots}</nav>

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
