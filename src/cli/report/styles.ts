// styles: the whole stylesheet, inlined so the page stays one file.

export function styles(): string {
  return `
:root{--bg:#F6F1E7;--s1:#FFFFFF;--s2:#FFE8EE;--tx:#1A1613;
--muted:rgba(26,22,19,.72);--subtle:rgba(26,22,19,.60);--bd:rgba(26,22,19,.10);
--crimson:#C41E3A;--crimson-dark:#9E1329;--rosa:#FF8FAE;--ok:#2E6A48;
--grad:linear-gradient(135deg,#D62E52 0%,#9E1329 100%);
--ease:cubic-bezier(.22,.61,.36,1);--slow:640ms;--mid:420ms}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--tx);
font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55;
-webkit-font-smoothing:antialiased;overflow-x:hidden}
button{font-family:inherit}
:focus-visible{outline:2px solid var(--crimson);outline-offset:3px;border-radius:6px}

.ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;
transition:opacity 900ms var(--ease)}
.glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5}
.g1{width:46vw;height:46vw;left:-10vw;top:-12vw;background:radial-gradient(circle,#FF8FAE55,transparent 70%);animation:drift1 34s var(--ease) infinite alternate}
.g2{width:38vw;height:38vw;right:-8vw;top:38vh;background:radial-gradient(circle,#C41E3A33,transparent 70%);animation:drift2 44s var(--ease) infinite alternate}
.grain{position:absolute;inset:0;opacity:.045;background-image:radial-gradient(#1A1613 1px,transparent 1px);background-size:3px 3px}
@keyframes drift1{to{transform:translate3d(6vw,7vh,0) scale(1.12)}}
@keyframes drift2{to{transform:translate3d(-7vw,-5vh,0) scale(1.08)}}

.morph{position:fixed;z-index:4;width:10px;height:10px;border-radius:50%;
background:var(--crimson);opacity:0;pointer-events:none;
box-shadow:0 0 0 0 rgba(196,30,58,.28)}
.morph.travel{animation:morphGlow 760ms var(--ease) forwards}
@keyframes morphGlow{0%{box-shadow:0 0 0 0 rgba(196,30,58,.28)}100%{box-shadow:0 0 0 46px rgba(196,30,58,0)}}

main{position:relative;z-index:1;max-width:60rem;margin:0 auto;padding:0 clamp(1.2rem,4vw,2.5rem)}
/* .stage sets display, so the escape hatch has to outrank it */
.stage.hidden{display:none}
.staging{opacity:0;pointer-events:none}
.eyebrow{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:0 0 1.2rem}
.blurb{color:var(--muted);margin:0 0 1rem;font-size:.95rem}
.label{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 .6rem}
.label.spaced{margin-top:2rem}
.meta{margin:0;font-size:.8rem;color:var(--muted)}

.investigate{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;
transition:opacity 560ms var(--ease),transform 560ms var(--ease),filter 560ms var(--ease)}
.investigate.collapse{opacity:0;transform:scale(.9);filter:blur(7px)}
.investigating{font-size:.82rem;letter-spacing:.28em;text-transform:uppercase;color:var(--crimson-dark);margin:0 0 1rem}
.investigating::after{content:'';display:inline-block;width:1.6em;text-align:left;animation:dots 1.6s steps(4,end) infinite}
@keyframes dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
.subject{font-size:clamp(2.4rem,7vw,4.6rem);line-height:1.02;margin:0;font-weight:700;letter-spacing:-.02em;
background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.net{width:min(100%,38rem);margin-top:3.5rem;overflow:visible;transition:transform 560ms var(--ease)}
.investigate.collapse .net{transform:scale(.34)}
.net .root{fill:var(--tx);font-size:13px;letter-spacing:.22em;text-anchor:middle;font-weight:600}
.net .root-dot{fill:var(--crimson)}
.net text{font-family:inherit}
.net .node text{fill:var(--subtle);font-size:11px;letter-spacing:.14em;text-anchor:middle;transition:fill var(--mid) var(--ease)}
.net .node circle{fill:var(--bg);stroke:var(--subtle);stroke-width:1.5;transition:all var(--mid) var(--ease)}
.net .node.on circle{fill:var(--ok);stroke:var(--ok);animation:nodePop 520ms var(--ease)}
.net .node.on text{fill:var(--tx)}
@keyframes nodePop{0%{r:7}45%{r:13}100%{r:7}}
/* the dash has to be longer than the longest path, or the outer links show through undrawn */
.net .link{fill:none;stroke:var(--bd);stroke-width:1.5;stroke-dasharray:400;stroke-dashoffset:400;
transition:stroke-dashoffset var(--slow) var(--ease),stroke var(--slow) var(--ease)}
.net .link.on{stroke-dashoffset:0;stroke:var(--rosa)}
.net .spark{fill:var(--crimson);opacity:0;offset-distance:0%}
.net .spark.on{animation:travel 1400ms var(--ease) infinite}
@keyframes travel{0%{offset-distance:0%;opacity:0}12%{opacity:1}88%{opacity:1}100%{offset-distance:100%;opacity:0}}

.ticks{list-style:none;display:flex;flex-wrap:wrap;gap:.4rem .9rem;justify-content:center;padding:0;margin:1.8rem 0 0;
font-size:.76rem;letter-spacing:.14em;color:var(--subtle)}
.tick{display:flex;align-items:center;gap:.35rem;opacity:.3;transition:opacity var(--mid) var(--ease)}
.tick-mark{color:var(--bd);transition:color var(--mid) var(--ease)}
.tick.on{opacity:1}
.tick.on .tick-mark{color:var(--ok);animation:tickPop 420ms var(--ease)}
@keyframes tickPop{0%{transform:scale(.4)}55%{transform:scale(1.5)}100%{transform:scale(1)}}
.progress{margin:.9rem 0 0;font-size:.76rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.progress-n{font-weight:700;color:var(--crimson-dark);font-size:1rem}
.flash{position:absolute;margin:0;font-size:clamp(1.2rem,3.4vw,2rem);font-weight:700;letter-spacing:-.01em;
opacity:0;transform:translateY(10px);transition:opacity 320ms var(--ease),transform 320ms var(--ease)}
.flash strong{color:var(--crimson)}
.flash.on{opacity:1;transform:none}

.bar{position:fixed;top:0;left:0;right:0;z-index:5;display:flex;gap:1rem;align-items:center;
padding:.85rem clamp(1.2rem,4vw,2.5rem);background:rgba(246,241,231,0);
border-bottom:1px solid transparent;opacity:0;
transition:opacity var(--slow) var(--ease),background var(--slow) var(--ease),
border-color var(--slow) var(--ease),box-shadow var(--slow) var(--ease),backdrop-filter var(--slow) var(--ease)}
.bar.on{opacity:1;background:rgba(246,241,231,.78);backdrop-filter:blur(14px);
border-bottom-color:var(--bd);box-shadow:0 8px 24px rgba(26,22,19,.05)}
.bar-brand{font-weight:700;letter-spacing:.18em;font-size:.78rem;color:var(--crimson-dark)}
.bar-name{font-weight:600;font-size:.92rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-status{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}

.block{margin:0 0 5rem}
.block h2{font-size:1.05rem;letter-spacing:.02em;margin:0 0 .3rem;font-weight:650}
[data-enter]{opacity:0;transition:opacity var(--slow) var(--ease),transform var(--slow) var(--ease),filter var(--slow) var(--ease),clip-path var(--slow) var(--ease)}
[data-enter="hero"]{transform:scale(.965);filter:blur(9px)}
[data-enter="rail"]{transform:translateY(22px)}
[data-enter="evidence"]{clip-path:inset(0 0 100% 0)}
[data-enter="market"]{transform:translateY(12px)}
[data-enter="audit"]{transform:none}
[data-enter].on{opacity:1;transform:none;filter:none;clip-path:inset(0 0 0 0)}
[data-enter="audit"].on{opacity:.92}

.hero{padding-top:6rem;text-align:center;margin-bottom:7rem}
.subject.big{font-size:clamp(1.9rem,5vw,3.2rem)}
.status{display:inline-block;margin:1rem 0 0;padding:.35rem 1rem;border-radius:999px;
font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;font-weight:600;
background:var(--s1);border:1px solid var(--bd);color:var(--muted)}
.status.pill-positive{background:var(--s2);border-color:rgba(46,106,72,.3);color:var(--ok)}

.metric{position:relative;margin:3rem auto 0;width:min(30rem,86vw);aspect-ratio:1/.62;
display:flex;align-items:center;justify-content:center}
.halo{position:absolute;inset:-12% -6%;border-radius:50%;
background:radial-gradient(circle,rgba(255,143,174,.34),transparent 62%);filter:blur(26px)}
.arc{position:absolute;width:min(22rem,64vw);height:min(22rem,64vw);opacity:.5}
.arc circle{fill:none;stroke:var(--rosa);stroke-width:1;stroke-dasharray:4 10;
transform-origin:50% 50%;animation:spin 90s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.figure{position:relative;font-size:clamp(6rem,20vw,17rem);line-height:.86;margin:0;font-weight:700;letter-spacing:-.04em;
background:linear-gradient(115deg,#D62E52 0%,#9E1329 42%,#D62E52 100%);background-size:260% 100%;
-webkit-background-clip:text;background-clip:text;color:transparent;
animation:sheen 14s linear infinite;
transform:translateY(14px);opacity:0;transition:transform 760ms var(--ease),opacity 760ms var(--ease)}
.figure.settled{transform:none;opacity:1}
@keyframes sheen{to{background-position:260% 0}}
.figure-label{margin:1.4rem 0 0;font-size:.78rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.tally{margin:.7rem 0 0;font-size:.88rem;color:var(--muted)}
.tally strong{color:var(--tx);font-weight:650}
.hero-note{max-width:34rem;margin:1.4rem auto 0;color:var(--muted);font-size:.92rem}

.insights{display:grid;gap:.5rem;max-width:30rem;margin:2.4rem auto 0}
.insight{display:flex;align-items:center;gap:.8rem;width:100%;padding:.9rem 1.1rem;
background:rgba(255,255,255,.66);border:1px solid var(--bd);border-radius:14px;
cursor:pointer;font-size:.95rem;color:inherit;text-align:left;
opacity:0;transform:translateY(10px);
transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease),
border-color var(--mid) var(--ease),box-shadow var(--mid) var(--ease)}
.insight.on{opacity:1;transform:none}
.insight:hover,.insight:focus-visible{border-color:rgba(196,30,58,.35);box-shadow:0 8px 22px rgba(196,30,58,.07)}
.insight-mark{color:var(--ok);font-weight:700;width:1rem;text-align:center}
.insight.on .insight-mark{animation:tickPop 420ms var(--ease)}
.insight-text{flex:1}
.insight-go{color:var(--crimson-dark);transition:transform var(--mid) var(--ease)}
.insight:hover .insight-go{transform:translateX(4px)}
.summary-done{margin:1.4rem 0 0;font-size:.74rem;letter-spacing:.18em;text-transform:uppercase;
color:var(--ok);opacity:0;transition:opacity var(--slow) var(--ease)}
.summary-done.on{opacity:1}
.explore-cue{margin:2rem 0 0;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);
opacity:0;transition:opacity var(--slow) var(--ease)}
.explore-cue.on{opacity:1;animation:nudge 2.6s var(--ease) infinite}
@keyframes nudge{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}

.comp{display:grid;gap:1.6rem;grid-template-columns:minmax(0,1fr) minmax(11rem,15rem);align-items:center}
.comp-rows{display:grid;gap:.3rem;min-width:0}
.comp-row{display:flex;align-items:center;gap:.9rem;width:100%;padding:.7rem .5rem;
background:none;border:0;border-radius:10px;cursor:pointer;color:inherit;text-align:left;
transition:background var(--mid) var(--ease),opacity var(--mid) var(--ease)}
.comp-row:hover{background:rgba(255,255,255,.5)}
.comp-name{font-size:.72rem;letter-spacing:.14em;color:var(--muted);width:4.6rem;flex:none}
.comp-dots{flex:1;display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-width:0}
.dot{width:9px;height:9px;border-radius:50%;background:var(--rosa);
transform:scale(0);transition:transform 320ms var(--ease) calc(var(--d) * 34ms)}
.comp-row.grown .dot{transform:scale(1)}
.comp-n{font-size:1.15rem;font-weight:700;width:2.2rem;text-align:right;flex:none}
.comp-rows.picking .comp-row:not(.picked){opacity:.28}
.comp-rows.picking .comp-row.picked .dot{background:var(--crimson)}
.comp-detail{text-align:center;padding:1.4rem 1rem;background:rgba(255,255,255,.62);
border:1px solid var(--bd);border-radius:18px}
.comp-detail-n{margin:0;font-size:clamp(2.6rem,7vw,4rem);font-weight:700;letter-spacing:-.03em;line-height:1;
background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.comp-detail-label{margin:.35rem 0 0;font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.comp-go{margin-top:1rem;padding:.5rem 1rem;border-radius:999px;border:1px solid rgba(196,30,58,.35);
background:none;color:var(--crimson-dark);font-size:.82rem;font-weight:600;cursor:pointer;
transition:background var(--mid) var(--ease)}
.comp-go:hover{background:var(--s2)}

.filters{display:flex;gap:.35rem;flex-wrap:wrap;margin:1rem 0 .6rem}
.filter{padding:.45rem .95rem;border-radius:999px;border:1px solid var(--bd);background:rgba(255,255,255,.6);
color:var(--muted);font-size:.78rem;letter-spacing:.1em;cursor:pointer;white-space:nowrap;
transition:all var(--mid) var(--ease)}
.filter:hover{border-color:var(--rosa)}
.filter.selected{background:var(--crimson);border-color:var(--crimson);color:#fff;font-weight:600}
.filter-result{margin:0 0 1.2rem;font-size:.8rem;color:var(--muted);transition:opacity 200ms var(--ease)}
.filter-result.blip{opacity:.25}

.panels{display:grid;gap:.6rem}
.panel{background:var(--s1);border:1px solid var(--bd);border-radius:16px;overflow:hidden;
transition:border-color var(--mid) var(--ease),box-shadow var(--mid) var(--ease)}
.panel.active{border-color:rgba(196,30,58,.34);box-shadow:0 10px 30px rgba(196,30,58,.07)}
.panel-head{display:flex;gap:1rem;align-items:center;width:100%;padding:1.1rem 1.3rem;
background:none;border:0;cursor:pointer;font-size:1rem;color:inherit;text-align:left}
.panel-title{flex:1;display:flex;flex-direction:column;min-width:0}
.panel-name{font-weight:640}
.panel-title .blurb{margin:.15rem 0 0;font-size:.85rem}
.panel-seen{font-size:.72rem;letter-spacing:.1em;color:var(--ok);white-space:nowrap;
opacity:0;transform:translateY(4px);transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease)}
.panel.open .panel-seen{opacity:1;transform:none}
.panel-count{font-size:.78rem;font-weight:700;color:var(--crimson-dark);background:var(--s2);
padding:.15rem .55rem;border-radius:999px;flex:none}
.panel-cta{font-size:.8rem;color:var(--crimson-dark);font-weight:600;white-space:nowrap}
.panel.open .panel-cta{opacity:0}
.panel-toggle{font-size:1.3rem;color:var(--muted);width:1.2rem;text-align:center;line-height:1}
.panel.open .panel-toggle{color:var(--crimson-dark)}
.panel-body{max-height:0;overflow:hidden;transition:max-height var(--slow) var(--ease)}
.panel-inner{opacity:0;transform:translateY(8px);transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease)}
.panel.open .panel-body{max-height:400rem}
.panel.open .panel-inner{opacity:1;transform:none}

.sort{display:flex;gap:.3rem;padding:.8rem 1.3rem;border-top:1px solid var(--bd)}
.sort-btn{padding:.3rem .8rem;border-radius:999px;border:1px solid transparent;background:none;
color:var(--muted);font-size:.76rem;cursor:pointer;transition:all var(--mid) var(--ease)}
.sort-btn:hover{color:var(--tx)}
.sort-btn.selected{border-color:var(--bd);background:var(--s2);color:var(--crimson-dark);font-weight:600}

.item{position:relative;padding:1rem 1.3rem;border-top:1px solid var(--bd);
transition:background var(--mid) var(--ease),transform var(--mid) var(--ease)}
.item::before{content:'';position:absolute;left:0;top:-1px;bottom:0;width:0;background:var(--grad);
transition:width var(--mid) var(--ease)}
.item:hover{background:rgba(255,232,238,.32);transform:translateY(-1px)}
.item:hover::before{width:3px}
.item:focus-within::before{width:3px}
.item.fresh{animation:slideIn 420ms var(--ease)}
@keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.item-label{margin:0 0 .25rem;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--crimson-dark)}
.item.tone-positive .item-label{color:var(--ok)}
.item-detail{margin:0 0 .4rem}
.meta-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--bd);
margin-right:.45rem;vertical-align:middle;transition:background var(--mid) var(--ease)}
.item:hover .meta-dot{background:var(--crimson)}
.item.tone-positive:hover .meta-dot{background:var(--ok)}
.doc{display:inline-block;margin-top:.5rem;font-size:.82rem;color:var(--crimson-dark);font-weight:600}
.doc-go{display:inline-block;transition:transform var(--mid) var(--ease)}
.item:hover .doc-go{transform:translateX(5px)}
.empty{padding:1rem 1.3rem;margin:0;border-top:1px solid var(--bd);color:var(--subtle)}
.more-wrap{padding:1rem 1.3rem;border-top:1px solid var(--bd)}
.more{padding:.55rem 1.1rem;border-radius:999px;border:1px solid var(--bd);background:none;
color:var(--crimson-dark);font-size:.84rem;font-weight:600;cursor:pointer;
transition:all var(--mid) var(--ease)}
.more:hover{border-color:var(--crimson);background:var(--s2)}

.strip{margin:2.2rem 0 0}
.strip-line{position:relative;height:2px;background:linear-gradient(90deg,var(--bd),var(--rosa),var(--bd));
margin:3.4rem 0 0;border-radius:2px}
.point{position:absolute;left:var(--p);top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;padding:0;
border-radius:50%;border:2px solid var(--bg);background:var(--rosa);cursor:pointer;
transition:transform var(--mid) var(--ease),background var(--mid) var(--ease)}
.point:hover{transform:scale(1.25)}
.point.picked{background:var(--crimson);transform:scale(1.35)}
.point-tag{position:absolute;left:50%;bottom:1.5rem;transform:translateX(-50%);
font-size:.74rem;color:var(--muted);white-space:nowrap;transition:color var(--mid) var(--ease)}
.point.picked .point-tag{color:var(--tx);font-weight:650}
.strip-scale{margin:1.4rem 0 0;font-size:.74rem;color:var(--subtle);letter-spacing:.04em}
.strip-detail{margin-top:1.4rem}
.strip-value{font-size:clamp(2.2rem,5.5vw,3.4rem);margin:0;font-weight:700;letter-spacing:-.03em;color:var(--tx)}
.strip-label{margin:.2rem 0 .25rem;font-size:.82rem;letter-spacing:.06em;color:var(--muted)}

.aside-rates{margin-top:2.6rem;padding-top:1.4rem;border-top:1px solid var(--bd)}
.aside-rate{margin-top:.6rem}
.rate-value{font-size:clamp(1.6rem,3.6vw,2.2rem);margin:0;font-weight:700;letter-spacing:-.02em;color:var(--tx)}
.rate-label{margin:.2rem 0 .25rem;font-size:.82rem;letter-spacing:.06em;color:var(--muted)}
.pulse{height:1px;margin-top:2.2rem;background:linear-gradient(90deg,transparent,var(--rosa),transparent);
background-size:200% 100%;animation:sweep 6s linear infinite}
@keyframes sweep{to{background-position:200% 0}}

.why-steps{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}
.why-step{background:rgba(255,255,255,.62);border:1px solid var(--bd);border-radius:16px;padding:1.2rem}
.why-head{margin:0 0 .3rem;font-weight:650}

.audit{margin-bottom:3rem}
.audit-card{background:rgba(255,255,255,.5);border:1px solid rgba(26,22,19,.06);border-radius:14px;padding:1.1rem 1.2rem;margin-bottom:.6rem}
.audit-grid{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}
.notes{margin:0;padding-left:1.1rem;color:var(--muted)}
.notes li{margin:.3rem 0}
.sources{width:100%;border-collapse:collapse;font-size:.84rem;margin-top:.4rem;color:var(--muted)}
.sources th{text-align:left;font-weight:600;padding:.45rem .6rem .45rem 0;border-bottom:1px solid var(--bd)}
.sources td{padding:.5rem .6rem;border-bottom:1px solid var(--bd)}
.sources td:first-child{padding-left:0}

.closing{text-align:center;padding-bottom:4rem}
.closing-arc{font-size:clamp(1rem,2.6vw,1.5rem);font-weight:650;margin:0 0 .6rem;letter-spacing:-.01em}
.closing-tally{margin:0;color:var(--muted);font-size:.86rem}

@media(max-width:640px){
  .net{width:100%}
  .figure{font-size:clamp(4.5rem,26vw,8rem)}
  .metric{aspect-ratio:1/.8}
  .comp{grid-template-columns:1fr}
  .comp-name{width:3.8rem}
  .filters{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:.2rem}
  .filters::-webkit-scrollbar{display:none}
  .filter{flex:none;min-height:40px}
  .panel-head{min-height:56px}
  .panel-cta,.panel-seen{display:none}
  .bar-status{display:none}
  .point-tag{font-size:.68rem}
  .sort{padding:.7rem 1rem}
  .sort-btn{min-height:36px}
}

@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .glow,.pulse,.investigating::after,.arc circle,.figure,.net .spark.on,.morph.travel,
  .explore-cue.on,.item.fresh,.tick.on .tick-mark,.insight.on .insight-mark,.net .node.on circle{animation:none}
  [data-enter],.bar,.panel-body,.panel-inner,.net .link,.net .node circle,.net .node text,
  .investigate,.net,.figure,.insight,.dot,.tick,.flash,.summary-done,.explore-cue,
  .filter-result,.item,.item::before,.point,.point-tag,.meta-dot,.doc-go,.panel-seen{transition:none}
  .net .spark{display:none}
  .item:hover{transform:none}
}
`;
}
