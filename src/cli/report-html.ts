// report-html: renders a report into one self-contained page. Presentation only.

import { CrevaReport, ReportSignal } from '../common/types/creva-report.types';

const CATEGORY_TITLE: Record<string, string> = {
  business_verification: 'Tu negocio en registros oficiales',
  regulatory: 'Reglas que te afectan',
  reference_rate: 'Cuánto cuesta el dinero hoy',
};

const CATEGORY_LEAD: Record<string, string> = {
  business_verification: 'Consultamos el directorio oficial de establecimientos.',
  regulatory: 'Revisamos el diario oficial del gobierno y las normas vigentes de la autoridad bancaria.',
  reference_rate: 'Tasas publicadas por el Banco de México. Cada una con su propia fecha.',
};

export function renderReportHtml(report: CrevaReport): string {
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  const steps = buildSteps(report);

  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Creva Score — ${escapeHtml(report.subject?.business_name ?? 'Reporte')}</title>
<style>${styles()}</style>
</head>
<body>
<main id="app">
  <section class="stage" id="stage-investigate" aria-live="polite">
    <p class="eyebrow">Creva Score</p>
    <h1 class="display">Consultando registros públicos</h1>
    <p class="lead">Datos de gobierno, citados con su fuente y su fecha.</p>
    <ul class="steps">${steps}</ul>
  </section>

  <section class="stage hidden" id="stage-report">
    <header class="head">
      <p class="eyebrow">Creva Score</p>
      <h1 class="display">${escapeHtml(report.subject?.business_name ?? 'Sin negocio consultado')}</h1>
      <p class="lead">${escapeHtml(subtitle(report))}</p>
    </header>
    ${sections(report)}
    ${notes(report)}
    ${disclosure(report)}
    ${sources(report)}
    <footer class="foot">Generado el ${escapeHtml(formatDateTime(report.generated_at))}</footer>
  </section>
</main>
<script>window.CREVA_REPORT=${data};${script()}</script>
</body>
</html>`;
}

function buildSteps(report: CrevaReport): string {
  const labels = [
    'Consultando el directorio oficial de establecimientos',
    'Revisando el diario oficial de la federación',
    'Leyendo las normas vigentes de la autoridad bancaria',
    'Consultando las tasas del Banco de México',
    'Reuniendo la evidencia',
  ];
  void report;
  return labels.map((label, index) => `<li data-step="${index}"><span class="tick">○</span>${escapeHtml(label)}</li>`).join('');
}

function subtitle(report: CrevaReport): string {
  const verified = report.signals.some((s) => s.category === 'business_verification' && s.tone === 'positive');
  if (report.subject === null) return 'Revisión general, sin negocio consultado.';
  return verified
    ? 'Encontrado en el directorio oficial. Abajo, de dónde salió cada dato.'
    : 'No emitimos sello. Abajo te explicamos por qué, y qué no significa.';
}

function sections(report: CrevaReport): string {
  const categories: Array<ReportSignal['category']> = ['business_verification', 'regulatory', 'reference_rate'];

  return categories
    .map((category) => {
      const signals = report.signals.filter((signal) => signal.category === category);
      if (signals.length === 0) return '';
      return `<section class="block">
  <h2>${escapeHtml(CATEGORY_TITLE[category] ?? category)}</h2>
  <p class="blurb">${escapeHtml(CATEGORY_LEAD[category] ?? '')}</p>
  <div class="cards">${signals.map(card).join('')}</div>
</section>`;
    })
    .join('');
}

function card(signal: ReportSignal): string {
  const mark = signal.tone === 'positive' ? '✓' : signal.tone === 'unavailable' ? '—' : '·';
  const link =
    signal.evidence_url === null
      ? ''
      : `<a class="evidence" href="${escapeHtml(signal.evidence_url)}" target="_blank" rel="noopener">Ver documento oficial</a>`;

  return `<article class="card tone-${signal.tone}">
  <p class="card-mark">${mark}</p>
  <div>
    <h3>${escapeHtml(signal.label)}</h3>
    <p class="detail">${escapeHtml(signal.detail)}</p>
    <p class="meta">${escapeHtml(signal.source)}${signal.checked_at === null ? '' : ` · ${escapeHtml(formatDate(signal.checked_at))}`}</p>
    ${link}
  </div>
</article>`;
}

function notes(report: CrevaReport): string {
  if (report.notes.length === 0) return '';
  return `<section class="block">
  <h2>Lo que no pudimos ver</h2>
  <ul class="notes">${report.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
</section>`;
}

function disclosure(report: CrevaReport): string {
  const items = report.disclosure.does_not_estimate.map((claim) => `<li>${escapeHtml(claim)}</li>`).join('');
  const levels = report.disclosure.provenance_levels
    .map((level) => `<li><strong>${escapeHtml(level.label)}.</strong> ${escapeHtml(level.meaning)}</li>`)
    .join('');

  return `<section class="block disclosure">
  <h2>Qué es este puntaje, y qué no</h2>
  <p class="blurb">${escapeHtml(report.disclosure.describes)} Ventana de ${report.disclosure.window_days} días · versión ${escapeHtml(report.disclosure.score_version)}.</p>
  <p class="label">Lo que NO hace</p>
  <ul class="notes">${items}</ul>
  <p class="label">De dónde sale cada dato</p>
  <ul class="notes">${levels}</ul>
</section>`;
}

function sources(report: CrevaReport): string {
  if (report.sources.length === 0) return '';
  const rows = report.sources
    .map(
      (source) =>
        `<tr><td>${escapeHtml(source.provider)}</td><td>${escapeHtml(source.dataset)}</td><td>${source.queried_at === null ? '—' : escapeHtml(formatDate(source.queried_at))}</td></tr>`,
    )
    .join('');

  return `<section class="block">
  <h2>Fuentes consultadas</h2>
  <table class="sources"><thead><tr><th>Proveedor</th><th>Conjunto de datos</th><th>Consultado</th></tr></thead><tbody>${rows}</tbody></table>
</section>`;
}

function formatDate(value: string): string {
  const iso = value.length === 10 ? `${value}T12:00:00.000Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function styles(): string {
  return `
:root{--bg:#F6F1E7;--s1:#FFFFFF;--s2:#FFE8EE;--tx:#1A1613;--tx2:#6F675C;
--muted:rgba(26,22,19,.72);--subtle:rgba(26,22,19,.60);--bd:rgba(26,22,19,.10);
--crimson:#C41E3A;--crimson-dark:#9E1329;--rosa:#FF8FAE;--ok:#2E6A48;
--grad:linear-gradient(135deg,#D62E52 0%,#9E1329 100%);
--ease:cubic-bezier(.22,.61,.36,1);--dur:240ms;--slow:420ms}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);
font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55;
-webkit-font-smoothing:antialiased}
#app{max-width:56rem;margin:0 auto;padding:clamp(2rem,6vw,5rem) clamp(1.2rem,4vw,2.5rem)}
.hidden{display:none}
.eyebrow{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 .6rem}
.display{font-size:clamp(2.1rem,5.5vw,3.4rem);line-height:1.08;margin:0 0 .7rem;font-weight:700;
background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:clamp(1rem,2.2vw,1.15rem);color:var(--muted);margin:0 0 2rem;max-width:44rem}
.steps{list-style:none;padding:0;margin:2.5rem 0 0;max-width:34rem}
.steps li{display:flex;gap:.85rem;align-items:baseline;padding:.7rem 0;color:var(--subtle);
border-bottom:1px solid var(--bd);opacity:0;transform:translateY(6px);
transition:opacity var(--slow) var(--ease),transform var(--slow) var(--ease),color var(--dur) var(--ease)}
.steps li.on{opacity:1;transform:none}
.steps li.done{color:var(--tx)}
.tick{color:var(--rosa);font-weight:700;min-width:1rem}
.steps li.done .tick{color:var(--ok)}
.head{margin-bottom:2.5rem}
.block{margin:0 0 2.75rem;opacity:0;transform:translateY(10px);
transition:opacity var(--slow) var(--ease),transform var(--slow) var(--ease)}
.block.on{opacity:1;transform:none}
.block h2{font-size:1.35rem;margin:0 0 .35rem;font-weight:650}
.blurb{color:var(--muted);margin:0 0 1.1rem;font-size:.95rem}
.label{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:1.3rem 0 .5rem}
.cards{display:grid;gap:.8rem}
.card{display:flex;gap:1rem;background:var(--s1);border:1px solid var(--bd);
border-left:3px solid var(--rosa);border-radius:14px;padding:1.05rem 1.2rem}
.card.tone-positive{border-left-color:var(--ok);background:var(--s2)}
.card.tone-unavailable{border-left-color:var(--subtle)}
.card-mark{font-size:1.1rem;font-weight:700;color:var(--crimson);margin:0;min-width:1.1rem}
.card.tone-positive .card-mark{color:var(--ok)}
.card.tone-unavailable .card-mark{color:var(--subtle)}
.card h3{margin:0 0 .3rem;font-size:1rem;font-weight:640}
.detail{margin:0 0 .45rem;color:var(--tx)}
.meta{margin:0;font-size:.82rem;color:var(--muted)}
.evidence{display:inline-block;margin-top:.5rem;font-size:.82rem;color:var(--crimson-dark);font-weight:600}
.notes{margin:0;padding-left:1.15rem;color:var(--muted)}
.notes li{margin:.35rem 0}
.disclosure{background:var(--s1);border:1px solid var(--bd);border-radius:16px;padding:1.5rem}
.sources{width:100%;border-collapse:collapse;font-size:.88rem}
.sources th{text-align:left;font-weight:600;color:var(--muted);padding:.45rem .6rem .45rem 0;border-bottom:1px solid var(--bd)}
.sources td{padding:.5rem .6rem .5rem 0;border-bottom:1px solid var(--bd);color:var(--tx)}
.foot{color:var(--subtle);font-size:.82rem;margin-top:2rem}
@media(prefers-reduced-motion:reduce){.steps li,.block{transition:none}}
`;
}

function script(): string {
  return `
(function(){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var steps=[].slice.call(document.querySelectorAll('.steps li'));
  var investigate=document.getElementById('stage-investigate');
  var report=document.getElementById('stage-report');
  function reveal(){
    report.classList.remove('hidden');
    var blocks=[].slice.call(report.querySelectorAll('.block'));
    blocks.forEach(function(b,i){setTimeout(function(){b.classList.add('on');},reduce?0:i*140);});
  }
  if(reduce){steps.forEach(function(s){s.classList.add('on','done');});investigate.classList.add('hidden');reveal();return;}
  steps.forEach(function(step,i){
    setTimeout(function(){step.classList.add('on');},i*260);
    setTimeout(function(){step.classList.add('done');step.querySelector('.tick').textContent='✓';},i*260+520);
  });
  setTimeout(function(){investigate.classList.add('hidden');reveal();},steps.length*260+900);
})();
`;
}
