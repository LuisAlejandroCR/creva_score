// report-html: renders a report into one self-contained page. Presentation only.

import { CrevaReport, ReportSignal } from '../common/types/creva-report.types';

interface SourceLane {
  id: string;
  short: string;
  name: string;
  mark: string;
  blurb: string;
  signals: ReportSignal[];
}

const STATUS_WORD: Record<string, string> = {
  positive: 'Verificado',
  neutral: 'Sin sello',
  unavailable: 'No disponible',
};

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

<header class="bar" id="bar" aria-hidden="true">
  <span class="bar-brand">CREVA</span>
  <span class="bar-name">${escapeHtml(name)}</span>
  <span class="bar-status">${escapeHtml(statusWord(report))}</span>
</header>

<main>
  <section class="stage investigate" id="stage-investigate">
    <p class="eyebrow">Creva · Inteligencia de datos públicos</p>
    <p class="investigating" id="investigating">Investigando</p>
    <h1 class="subject">${escapeHtml(name)}</h1>
    ${network(lanes)}
  </section>

  <section class="stage report hidden" id="stage-report">
    ${hero(report, lanes)}
    ${rail(lanes)}
    ${evidence(lanes)}
    ${market(report)}
    ${why(report)}
    ${audit(report)}
    ${closing(report, lanes)}
  </section>
</main>

<script>window.CREVA_REPORT=${data};${script()}</script>
</body>
</html>`;
}

function buildLanes(report: CrevaReport): SourceLane[] {
  const of = (predicate: (signal: ReportSignal) => boolean): ReportSignal[] => report.signals.filter(predicate);

  return [
    {
      id: 'siem',
      short: 'SIEM',
      name: 'Directorio de establecimientos',
      mark: '●',
      blurb: 'Si el negocio está inscrito, y desde cuándo.',
      signals: of((s) => s.category === 'business_verification'),
    },
    {
      id: 'dof',
      short: 'DOF',
      name: 'Diario Oficial de la Federación',
      mark: '↗',
      blurb: 'Lo que se publicó en los últimos días.',
      signals: of((s) => s.category === 'regulatory' && s.label.startsWith('Novedad')),
    },
    {
      id: 'cnbv',
      short: 'CNBV',
      name: 'Normas bancarias vigentes',
      mark: '◎',
      blurb: 'Reglas que ya estaban y siguen aplicando.',
      signals: of((s) => s.category === 'regulatory' && !s.label.startsWith('Novedad')),
    },
    {
      id: 'banxico',
      short: 'BANXICO',
      name: 'Banco de México',
      mark: '≈',
      blurb: 'Cuánto cuesta el dinero hoy.',
      signals: of((s) => s.category === 'reference_rate'),
    },
  ];
}

function statusWord(report: CrevaReport): string {
  const verification = report.signals.find((s) => s.category === 'business_verification');
  if (verification === undefined) return 'Revisión general';
  return STATUS_WORD[verification.tone] ?? 'Sin sello';
}

function network(lanes: SourceLane[]): string {
  const nodes = lanes
    .map(
      (lane, index) =>
        `<g class="node" data-node="${index}"><circle cx="${90 + index * 140}" cy="150" r="7"/><text x="${90 + index * 140}" y="180">${escapeHtml(lane.short)}</text></g>`,
    )
    .join('');

  const links = lanes
    .map((_, index) => `<path class="link" data-link="${index}" d="M300 62 C300 110 ${90 + index * 140} 100 ${90 + index * 140} 143"/>`)
    .join('');

  return `<svg class="net" viewBox="0 0 600 200" role="img" aria-label="Croma consultando cuatro fuentes de gobierno" xmlns="http://www.w3.org/2000/svg">
  <text class="root" x="300" y="40">CROMA</text>
  <circle class="root-dot" cx="300" cy="55" r="5"/>
  ${links}${nodes}
</svg>`;
}

function hero(report: CrevaReport, lanes: SourceLane[]): string {
  const signals = report.signals.length;
  const sources = report.sources.length;
  const verification = report.signals.find((s) => s.category === 'business_verification');
  const tone = verification?.tone ?? 'neutral';

  return `<section class="block hero">
  <p class="eyebrow">Perfil público del negocio</p>
  <h1 class="subject big">${escapeHtml(report.subject?.business_name ?? 'Revisión general')}</h1>
  <p class="status pill-${tone}">${escapeHtml(statusWord(report))}</p>

  <div class="metric">
    <p class="figure" data-count="${signals}">0</p>
    <p class="figure-label">señales públicas encontradas</p>
  </div>

  <ul class="tally">
    <li><strong>${sources}</strong> fuentes consultadas</li>
    ${lanes
      .filter((lane) => lane.signals.length > 0)
      .map((lane) => `<li><strong>${lane.signals.length}</strong> en ${escapeHtml(lane.short)}</li>`)
      .join('')}
  </ul>
  ${verification === undefined ? '' : `<p class="hero-note">${escapeHtml(verification.detail)}</p>`}
</section>`;
}

function rail(lanes: SourceLane[]): string {
  const stops = lanes
    .map(
      (lane) => `<button class="stop" data-lane="${lane.id}" type="button">
    <span class="stop-mark">${lane.mark}</span>
    <span class="stop-short">${escapeHtml(lane.short)}</span>
    <span class="stop-count">${lane.signals.length}</span>
  </button>`,
    )
    .join('');

  return `<section class="block">
  <h2>De dónde salió cada señal</h2>
  <p class="blurb">Toca una fuente para ver su evidencia.</p>
  <div class="rail">${stops}</div>
</section>`;
}

function evidence(lanes: SourceLane[]): string {
  const panels = lanes
    .map((lane) => {
      const items = lane.signals.length === 0
        ? '<p class="empty">Sin señales de esta fuente en la revisión.</p>'
        : lane.signals.map(evidenceItem).join('');

      return `<article class="panel" id="lane-${lane.id}" data-panel="${lane.id}">
  <header class="panel-head">
    <span class="stop-mark">${lane.mark}</span>
    <div><h3>${escapeHtml(lane.name)}</h3><p class="blurb">${escapeHtml(lane.blurb)}</p></div>
    <span class="stop-count">${lane.signals.length}</span>
  </header>
  <div class="panel-body">${items}</div>
</article>`;
    })
    .join('');

  return `<section class="block evidence"><div class="panels">${panels}</div></section>`;
}

function evidenceItem(signal: ReportSignal): string {
  const link =
    signal.evidence_url === null
      ? ''
      : `<a class="doc" href="${escapeHtml(signal.evidence_url)}" target="_blank" rel="noopener">Ver documento oficial →</a>`;

  return `<div class="item tone-${signal.tone}">
  <p class="item-label">${escapeHtml(signal.label)}</p>
  <p class="item-detail">${escapeHtml(signal.detail)}</p>
  <p class="meta">${escapeHtml(signal.source)}${signal.checked_at === null ? '' : ` · ${escapeHtml(formatDate(signal.checked_at))}`}</p>
  ${link}
</div>`;
}

function market(report: CrevaReport): string {
  const rates = report.signals.filter((signal) => signal.category === 'reference_rate');
  if (rates.length === 0) return '';

  const figures = rates
    .map(
      (rate) => `<div class="rate">
  <p class="rate-value">${escapeHtml(rate.detail)}</p>
  <p class="rate-label">${escapeHtml(rate.label)}</p>
  <p class="meta">${rate.checked_at === null ? 'sin fecha' : escapeHtml(formatDate(rate.checked_at))}</p>
</div>`,
    )
    .join('');

  return `<section class="block">
  <h2>Contexto de mercado</h2>
  <p class="blurb">Publicado por el Banco de México. Cada cifra trae su propia fecha, porque no se publican el mismo día.</p>
  <div class="rates">${figures}</div>
  <div class="pulse" aria-hidden="true"></div>
</section>`;
}

function why(report: CrevaReport): string {
  const verified = report.signals.some((s) => s.category === 'business_verification' && s.tone === 'positive');

  return `<section class="block why">
  <h2>Por qué importa</h2>
  <div class="why-steps">
    <div class="why-step"><p class="why-head">${verified ? 'Negocio verificado' : 'Negocio consultado'}</p><p class="blurb">Contra el directorio oficial, con la fecha de la consulta.</p></div>
    <div class="why-step"><p class="why-head">Contexto normativo</p><p class="blurb">Lo que se publicó y lo que ya estaba vigente.</p></div>
    <div class="why-step"><p class="why-head">Contexto financiero</p><p class="blurb">La referencia contra la que se mide una oferta de crédito.</p></div>
  </div>
</section>`;
}

function audit(report: CrevaReport): string {
  const notes = report.notes.length === 0 ? '' : `<div class="audit-card">
  <p class="label">Lo que no pudimos ver</p>
  <ul class="notes">${report.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
</div>`;

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

  return `<section class="block audit">
  <h2>Sobre este análisis</h2>
  <p class="blurb">${escapeHtml(report.disclosure.describes)} Ventana de ${report.disclosure.window_days} días · versión ${escapeHtml(report.disclosure.score_version)}.</p>

  <div class="audit-card wide">
    <p class="label">Lo que NO hace</p>
    <ul class="notes">${report.disclosure.does_not_estimate.map((claim) => `<li>${escapeHtml(claim)}</li>`).join('')}</ul>
  </div>

  <p class="label spaced">De dónde sale cada dato</p>
  <div class="audit-grid">${levels}</div>
  ${notes}

  ${rows === '' ? '' : `<p class="label spaced">Fuentes consultadas</p>
  <table class="sources"><thead><tr><th>Proveedor</th><th>Conjunto de datos</th><th>Consultado</th></tr></thead><tbody>${rows}</tbody></table>`}
</section>`;
}

function closing(report: CrevaReport, lanes: SourceLane[]): string {
  void lanes;
  return `<section class="block closing">
  <p class="closing-arc">Información pública → Evidencia estructurada → Contexto para decidir</p>
  <p class="closing-tally">${report.signals.length} señales · ${report.sources.length} fuentes · ${escapeHtml(formatDateTime(report.generated_at))}</p>
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
--ease:cubic-bezier(.22,.61,.36,1);--slow:640ms;--mid:420ms}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--tx);
font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55;
-webkit-font-smoothing:antialiased;overflow-x:hidden}

/* ambient */
.ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5}
.g1{width:46vw;height:46vw;left:-10vw;top:-12vw;background:radial-gradient(circle,#FF8FAE55,transparent 70%);animation:drift1 34s var(--ease) infinite alternate}
.g2{width:38vw;height:38vw;right:-8vw;top:38vh;background:radial-gradient(circle,#C41E3A33,transparent 70%);animation:drift2 44s var(--ease) infinite alternate}
.grain{position:absolute;inset:0;opacity:.045;
background-image:radial-gradient(#1A1613 1px,transparent 1px);background-size:3px 3px}
@keyframes drift1{to{transform:translate3d(6vw,7vh,0) scale(1.12)}}
@keyframes drift2{to{transform:translate3d(-7vw,-5vh,0) scale(1.08)}}

main{position:relative;z-index:1;max-width:60rem;margin:0 auto;padding:0 clamp(1.2rem,4vw,2.5rem)}
.hidden{display:none}
.eyebrow{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:0 0 1.2rem}
.blurb{color:var(--muted);margin:0 0 1rem;font-size:.95rem}
.label{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 .6rem}
.label.spaced{margin-top:2rem}
.meta{margin:0;font-size:.8rem;color:var(--muted)}

/* stage A */
.investigate{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.investigating{font-size:.82rem;letter-spacing:.28em;text-transform:uppercase;color:var(--crimson-dark);margin:0 0 1rem}
.investigating::after{content:'';display:inline-block;width:1.6em;text-align:left;animation:dots 1.6s steps(4,end) infinite}
@keyframes dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
.subject{font-size:clamp(2.4rem,7vw,4.6rem);line-height:1.02;margin:0;font-weight:700;letter-spacing:-.02em;
background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.net{width:min(100%,38rem);margin-top:3.5rem;overflow:visible}
.net .root{fill:var(--tx);font-size:13px;letter-spacing:.22em;text-anchor:middle;font-weight:600}
.net .root-dot{fill:var(--crimson)}
.net text{font-family:inherit}
.net .node text{fill:var(--subtle);font-size:11px;letter-spacing:.14em;text-anchor:middle;transition:fill var(--mid) var(--ease)}
.net .node circle{fill:var(--bg);stroke:var(--subtle);stroke-width:1.5;transition:all var(--mid) var(--ease)}
.net .node.on circle{fill:var(--ok);stroke:var(--ok)}
.net .node.on text{fill:var(--tx)}
.net .link{fill:none;stroke:var(--bd);stroke-width:1.5;stroke-dasharray:120;stroke-dashoffset:120;
transition:stroke-dashoffset var(--slow) var(--ease),stroke var(--slow) var(--ease)}
.net .link.on{stroke-dashoffset:0;stroke:var(--rosa)}

/* sticky bar */
.bar{position:fixed;top:0;left:0;right:0;z-index:5;display:flex;gap:1rem;align-items:center;
padding:.85rem clamp(1.2rem,4vw,2.5rem);background:rgba(246,241,231,.82);backdrop-filter:blur(14px);
border-bottom:1px solid var(--bd);transform:translateY(-100%);transition:transform var(--mid) var(--ease)}
.bar.on{transform:none}
.bar-brand{font-weight:700;letter-spacing:.18em;font-size:.78rem;color:var(--crimson-dark)}
.bar-name{font-weight:600;font-size:.92rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-status{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}

/* stages */
.block{margin:0 0 5rem;opacity:0;transform:translateY(14px);
transition:opacity var(--slow) var(--ease),transform var(--slow) var(--ease)}
.block.on{opacity:1;transform:none}
.block h2{font-size:1.05rem;letter-spacing:.02em;margin:0 0 .3rem;font-weight:650}

/* hero */
.hero{padding-top:6rem;text-align:center}
.subject.big{font-size:clamp(1.9rem,5vw,3.2rem)}
.status{display:inline-block;margin:1rem 0 0;padding:.35rem 1rem;border-radius:999px;
font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;font-weight:600;
background:var(--s1);border:1px solid var(--bd);color:var(--muted)}
.status.pill-positive{background:var(--s2);border-color:rgba(46,106,72,.3);color:var(--ok)}
.metric{margin:2.5rem 0 1rem}
.figure{font-size:clamp(6rem,20vw,17rem);line-height:.86;margin:0;font-weight:700;letter-spacing:-.04em;
background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.figure-label{margin:.4rem 0 0;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.tally{list-style:none;display:flex;flex-wrap:wrap;gap:.5rem 1.6rem;justify-content:center;padding:0;margin:1.6rem 0 0;
font-size:.88rem;color:var(--muted)}
.tally strong{color:var(--tx);font-weight:650}
.hero-note{max-width:34rem;margin:1.4rem auto 0;color:var(--muted)}

/* rail */
.rail{display:flex;gap:.6rem;flex-wrap:wrap}
.stop{flex:1 1 8rem;display:flex;flex-direction:column;align-items:flex-start;gap:.25rem;
background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:.9rem 1rem;cursor:pointer;
font-family:inherit;text-align:left;transition:border-color var(--mid) var(--ease),transform var(--mid) var(--ease)}
.stop:hover,.stop:focus-visible{border-color:var(--rosa);transform:translateY(-2px)}
.stop-mark{color:var(--crimson);font-size:1rem}
.stop-short{font-size:.72rem;letter-spacing:.16em;color:var(--muted)}
.stop-count{font-size:1.3rem;font-weight:700;color:var(--tx)}

/* evidence */
.panels{display:grid;gap:.7rem}
.panel{background:var(--s1);border:1px solid var(--bd);border-radius:16px;overflow:hidden}
.panel-head{display:flex;gap:1rem;align-items:center;padding:1.1rem 1.3rem;cursor:pointer}
.panel-head h3{margin:0;font-size:1rem;font-weight:640}
.panel-head .blurb{margin:.15rem 0 0;font-size:.85rem}
.panel-head>div{flex:1}
.panel-body{max-height:0;overflow:hidden;transition:max-height var(--slow) var(--ease)}
.panel.open .panel-body{max-height:220rem}
.item{padding:1rem 1.3rem;border-top:1px solid var(--bd)}
.item-label{margin:0 0 .25rem;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--crimson-dark)}
.item.tone-positive .item-label{color:var(--ok)}
.item-detail{margin:0 0 .4rem}
.doc{display:inline-block;margin-top:.5rem;font-size:.82rem;color:var(--crimson-dark);font-weight:600}
.empty{padding:1rem 1.3rem;margin:0;border-top:1px solid var(--bd);color:var(--subtle)}

/* market */
.rates{display:flex;flex-wrap:wrap;gap:2.4rem}
.rate-value{font-size:clamp(2rem,5vw,3rem);margin:0;font-weight:700;letter-spacing:-.02em;color:var(--tx)}
.rate-label{margin:.1rem 0 .2rem;font-size:.9rem;color:var(--tx)}
.pulse{height:1px;margin-top:1.6rem;background:linear-gradient(90deg,transparent,var(--rosa),transparent);
background-size:200% 100%;animation:sweep 6s linear infinite}
@keyframes sweep{to{background-position:200% 0}}

/* why */
.why-steps{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}
.why-step{background:rgba(255,255,255,.62);border:1px solid var(--bd);border-radius:16px;padding:1.2rem}
.why-head{margin:0 0 .3rem;font-weight:650}

/* audit */
.audit-card{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:1.1rem 1.2rem;margin-bottom:.7rem}
.audit-grid{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}
.notes{margin:0;padding-left:1.1rem;color:var(--muted)}
.notes li{margin:.3rem 0}
.sources{width:100%;border-collapse:collapse;font-size:.86rem;margin-top:.4rem}
.sources th{text-align:left;font-weight:600;color:var(--muted);padding:.45rem .6rem .45rem 0;border-bottom:1px solid var(--bd)}
.sources td{padding:.5rem .6rem;border-bottom:1px solid var(--bd)}
.sources td:first-child{padding-left:0}

/* closing */
.closing{text-align:center;padding-bottom:4rem}
.closing-arc{font-size:clamp(1rem,2.6vw,1.5rem);font-weight:650;margin:0 0 .6rem;letter-spacing:-.01em}
.closing-tally{margin:0;color:var(--muted);font-size:.86rem}

@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .glow,.pulse,.investigating::after{animation:none}
  .block,.bar,.panel-body,.net .link,.net .node circle,.net .node text{transition:none}
}
`;
}

function script(): string {
  return `
(function(){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var investigate=document.getElementById('stage-investigate');
  var report=document.getElementById('stage-report');
  var bar=document.getElementById('bar');
  var links=[].slice.call(document.querySelectorAll('.net .link'));
  var nodes=[].slice.call(document.querySelectorAll('.net .node'));

  function countUp(el){
    var target=parseInt(el.getAttribute('data-count'),10)||0;
    if(reduce||target===0){el.textContent=String(target);return;}
    var started=null,dur=900;
    function tick(now){
      if(started===null)started=now;
      var p=Math.min((now-started)/dur,1);
      el.textContent=String(Math.round(target*(1-Math.pow(1-p,3))));
      if(p<1)requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function reveal(){
    report.classList.remove('hidden');
    bar.classList.add('on');
    bar.setAttribute('aria-hidden','false');
    var blocks=[].slice.call(report.querySelectorAll('.block'));
    blocks.forEach(function(b,i){setTimeout(function(){b.classList.add('on');},reduce?0:i*120);});
    var figure=report.querySelector('.figure');
    if(figure)setTimeout(function(){countUp(figure);},reduce?0:420);
    var first=report.querySelector('.panel');
    if(first)first.classList.add('open');
  }

  if(reduce){
    links.forEach(function(l){l.classList.add('on');});
    nodes.forEach(function(n){n.classList.add('on');});
    investigate.classList.add('hidden');
    reveal();
  } else {
    links.forEach(function(link,i){setTimeout(function(){link.classList.add('on');},260+i*280);});
    nodes.forEach(function(node,i){setTimeout(function(){node.classList.add('on');},700+i*280);});
    setTimeout(function(){
      investigate.style.transition='opacity 520ms cubic-bezier(.22,.61,.36,1),transform 520ms cubic-bezier(.22,.61,.36,1),filter 520ms';
      investigate.style.opacity='0';
      investigate.style.transform='translateY(-28px) scale(.97)';
      investigate.style.filter='blur(6px)';
      setTimeout(function(){investigate.classList.add('hidden');reveal();},520);
    },700+nodes.length*280+700);
  }

  document.addEventListener('click',function(e){
    var head=e.target.closest&&e.target.closest('.panel-head');
    if(head){head.parentNode.classList.toggle('open');return;}
    var stop=e.target.closest&&e.target.closest('.stop');
    if(stop){
      var panel=document.getElementById('lane-'+stop.getAttribute('data-lane'));
      if(panel){panel.classList.add('open');panel.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});}
    }
  });
})();
`;
}
