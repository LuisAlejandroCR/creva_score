// report: renders a report into one self-contained page. Presentation only.

import { CrevaReport } from '../../common/types/creva-report.types';
import { buildLanes, escapeHtml, statusWord } from './lanes';
import { audit, closing, composition, evidence, hero, investigation, market, why } from './sections';
import { script } from './script';
import { styles } from './styles';

export { moreLabel, nextVisible } from './lanes';

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
