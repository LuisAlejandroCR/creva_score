// styles: the whole stylesheet, inlined so the page stays one file.

export function styles(): string {
  return `
:root{--bg:#F6F1E7;--s1:#FFFFFF;--s2:#FFE8EE;--tx:#1A1613;
--muted:rgba(26,22,19,.72);--subtle:rgba(26,22,19,.60);--bd:rgba(26,22,19,.10);
--crimson:#C41E3A;--crimson-dark:#9E1329;--rosa:#FF8FAE;--ok:#2E6A48;
--grad:linear-gradient(135deg,#D62E52 0%,#9E1329 100%);
--ease:cubic-bezier(.22,.61,.36,1);--slow:640ms;--mid:420ms}
*{box-sizing:border-box}
/* Any class that sets display outranks the browser's [hidden] rule. This settles it once. */
[hidden]{display:none!important}
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

main{position:relative;z-index:1;max-width:72rem;margin:0 auto;padding:0 clamp(1.2rem,4vw,2.5rem)}
.investigate,.hero{max-width:60rem;margin-left:auto;margin-right:auto}
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
.investigate .net,.investigate .ticks,.investigate .progress{transition:opacity 460ms var(--ease),transform 460ms var(--ease)}
.investigate.cleared .net,.investigate.cleared .ticks,.investigate.cleared .progress{opacity:0;transform:scale(.94)}
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
.flash{position:absolute;left:50%;top:50%;margin:0;font-size:clamp(1.6rem,4.4vw,2.8rem);font-weight:700;letter-spacing:-.02em;
opacity:0;transform:translate(-50%,-50%) scale(.94);white-space:nowrap;
transition:opacity 380ms var(--ease),transform 380ms var(--ease)}
.flash strong{color:var(--crimson)}
.flash.on{opacity:1;transform:translate(-50%,-50%) scale(1)}

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
.bar-all{padding:.35rem .8rem;border-radius:999px;border:1px solid var(--bd);background:none;
color:var(--muted);font-size:.74rem;cursor:pointer;white-space:nowrap;
transition:all var(--mid) var(--ease)}
.bar-all:hover{color:var(--tx);border-color:var(--subtle)}
.bar-all[aria-pressed="true"]{background:var(--crimson);border-color:var(--crimson);color:#fff}
.bar-all.share{border-color:rgba(46,106,72,.35);color:var(--ok)}
.bar-all.share:hover{background:rgba(46,106,72,.08);border-color:var(--ok)}

.workspace.all{grid-template-columns:1fr}
.workspace.all .pane{margin-bottom:4rem}
.workspace.all .steps{display:none}

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

.hero{text-align:center;margin-bottom:4rem}
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

.kpis{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));margin:2.4rem 0 0;text-align:left}
.kpi{background:var(--s1);border:1px solid var(--bd);border-radius:16px;padding:1.1rem 1.2rem;
opacity:0;transform:translateY(10px);
transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease)}
.kpi.on{opacity:1;transform:none}
.kpi-label{margin:0;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.kpi-value{margin:.35rem 0 .2rem;font-size:clamp(1.4rem,3vw,1.9rem);font-weight:700;letter-spacing:-.02em;line-height:1.1}
.kpi-note{margin:0;font-size:.76rem;color:var(--subtle)}

.dates{display:grid;gap:.6rem;grid-template-columns:1fr 1fr;margin:.6rem 0 0;text-align:left}
.date-card{border-radius:16px;padding:1.1rem 1.2rem;color:#fff}
.date-card.a{background:linear-gradient(135deg,#2E6A48 0%,#1f4c33 100%)}
.date-card.b{background:var(--grad)}
.date-label{margin:0;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;opacity:.85}
.date-value{margin:.35rem 0 0;font-size:1.25rem;font-weight:700;letter-spacing:-.01em;line-height:1.15}

.jumps{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));margin:2.4rem 0 0;text-align:left}
.jump{display:flex;flex-direction:column;gap:.9rem;padding:1.2rem 1.3rem;border-radius:18px;
border:1px solid var(--bd);background:var(--s1);cursor:pointer;color:inherit;
opacity:0;transform:translateY(12px);
transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease),
border-color var(--mid) var(--ease),box-shadow var(--mid) var(--ease)}
.jump.on{opacity:1;transform:none}
.jump:hover,.jump:focus-visible{border-color:rgba(196,30,58,.35);box-shadow:0 12px 30px rgba(196,30,58,.08)}
.jump-head{display:grid;grid-template-columns:auto 1fr auto;gap:.6rem;align-items:baseline}
.jump-num{font-size:.7rem;letter-spacing:.14em;color:var(--subtle)}
.jump-name{font-weight:650;font-size:1rem}
.jump-figure{font-size:1.6rem;font-weight:700;letter-spacing:-.03em;color:var(--crimson-dark)}
.jump-body{flex:1;display:block;min-height:5.4rem}
.panel-ring{display:flex;justify-content:center}
.panel-ring .ring{width:5.6rem}
.panel-ring .ring-n{font-size:30px}
.panel-ring .ring-l{font-size:9px}
.mini-list{list-style:none;margin:0;padding:0;display:grid;gap:.3rem;font-size:.82rem;color:var(--muted)}
.mini-list li{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
padding-left:.7rem;position:relative}
.mini-list li::before{content:'·';position:absolute;left:0;color:var(--rosa)}
.chips{display:flex;flex-wrap:wrap;gap:.35rem}
.chip{padding:.3rem .7rem;border-radius:999px;background:var(--s2);color:var(--crimson-dark);
font-size:.82rem;font-weight:650}
.jump-note{font-size:.78rem;color:var(--muted);display:flex;justify-content:space-between;align-items:center}
.jump-go{color:var(--crimson-dark);transition:transform var(--mid) var(--ease)}
.jump:hover .jump-go{transform:translateX(4px)}

.tl-key{display:flex;gap:.9rem;flex-wrap:wrap;margin:.2rem 0 .3rem;font-size:.72rem;color:var(--muted)}
.tl-key-item{display:flex;align-items:center;gap:.3rem}
.tl-dot-key{width:8px;height:8px;border-radius:50%;background:var(--crimson)}
.tl-dot-key.d1{background:#D62E52}
.tl-dot-key.d2{background:#9E1329}
.tl-dot-key.d3{background:var(--rosa)}
.tl-dot{transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease)}
.tl-dot.muted{opacity:.18}

.board{display:grid;gap:.7rem;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);margin:1.6rem 0 0}
@media(max-width:860px){
  .board{grid-template-columns:1fr}
  .rank{grid-template-columns:1rem minmax(3rem,auto) minmax(2rem,1fr) 1.8rem 2.2rem}
}
.card{background:var(--s1);border:1px solid var(--bd);border-radius:18px;padding:1.3rem 1.4rem}
.card-title{margin:0 0 1rem;font-weight:650;font-size:.94rem}
.card-note{margin:.9rem 0 0;font-size:.8rem;color:var(--muted);text-align:center}
.card-note strong{color:var(--tx)}

.ranked{display:grid;gap:.5rem}
.rank{display:grid;grid-template-columns:1rem minmax(3.2rem,auto) minmax(2.5rem,1fr) 1.9rem 2.3rem;
gap:.5rem;align-items:center;
width:100%;padding:.3rem 0;background:none;border:0;cursor:pointer;color:inherit;text-align:left}
.rank-i{font-size:.74rem;color:var(--subtle)}
.rank-name{font-size:.8rem;letter-spacing:.1em;color:var(--muted)}
.rank-track{height:10px;border-radius:5px;background:rgba(26,22,19,.06);overflow:hidden}
/* The bar is already its real length. The script only takes it back to zero to
   play it forwards, so a throttled tab shows the data instead of an empty chart. */
.rank-bar{display:block;height:100%;border-radius:5px;width:var(--w);background:var(--crimson);
transition:width 620ms var(--ease) calc(var(--i) * 90ms)}
.rank.a1 .rank-bar{background:#D62E52}
.rank.a2 .rank-bar{background:#9E1329}
.rank.a3 .rank-bar{background:var(--rosa)}
.rank-n{font-size:1rem;font-weight:700;text-align:right}
.rank-share{font-size:.78rem;color:var(--muted);text-align:right}
.rank:hover .rank-name,.rank:focus-visible .rank-name{color:var(--tx)}

.ring-wrap{display:flex;justify-content:center}
.ring{width:min(11rem,100%);height:auto}
.ring-track{fill:none;stroke:rgba(26,22,19,.07);stroke-width:14}
.ring-arc{fill:none;stroke-width:14;stroke-linecap:butt;stroke:var(--crimson);
transition:opacity var(--slow) var(--ease)}
.ring-arc.a1{stroke:#D62E52}
.ring-arc.a2{stroke:#9E1329}
.ring-arc.a3{stroke:var(--rosa)}
.ring-n{font-size:26px;font-weight:700;text-anchor:middle;fill:var(--tx)}
.ring-l{font-size:8px;letter-spacing:.16em;text-anchor:middle;fill:var(--muted);text-transform:uppercase}

.kpi-icon{margin-right:.4rem;color:var(--crimson)}
.comp-go{margin-top:1rem;padding:.5rem 1rem;border-radius:999px;border:1px solid rgba(196,30,58,.35);
background:none;color:var(--crimson-dark);font-size:.82rem;font-weight:600;cursor:pointer;
transition:background var(--mid) var(--ease)}
.comp-go:hover{background:var(--s2)}
.ranked.picking .rank:not(.picked){opacity:.3}

.tl-card{margin-top:.7rem}
.tl{position:relative;height:2.4rem;margin:.6rem 0 .4rem;border-radius:10px;background:rgba(26,22,19,.05)}
.tl-dot{position:absolute;top:50%;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:var(--crimson)}
.tl-dot.d1{background:#D62E52}
.tl-dot.d2{background:#9E1329}
.tl-dot.d3{background:var(--rosa)}
.tl-ends{display:flex;justify-content:space-between;font-size:.74rem;color:var(--subtle)}

.filters{display:flex;gap:.35rem;flex-wrap:wrap;margin:1rem 0 .6rem}
.filter{padding:.45rem .95rem;border-radius:999px;border:1px solid var(--bd);background:rgba(255,255,255,.6);
color:var(--muted);font-size:.78rem;letter-spacing:.1em;cursor:pointer;white-space:nowrap;
transition:all var(--mid) var(--ease)}
.filter:hover{border-color:var(--rosa)}
.filter.selected{background:var(--crimson);border-color:var(--crimson);color:#fff;font-weight:600}
.filter-result{margin:0 0 1.2rem;font-size:.8rem;color:var(--muted);transition:opacity 200ms var(--ease)}
.panels{transition:opacity 180ms var(--ease)}
.panels.swapping{opacity:0}
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
.item.fresh{animation:slideIn 420ms var(--ease) both;animation-delay:calc(var(--s,0) * 70ms)}
.item.spotlight{animation:spotlight 1600ms var(--ease)}
@keyframes spotlight{0%{background:rgba(255,232,238,.9)}100%{background:transparent}}
@keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.item-label{margin:0 0 .25rem;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--crimson-dark)}
.item.tone-positive .item-label{color:var(--ok)}
.item-detail{margin:0 0 .4rem}
.meta-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--bd);
margin-right:.45rem;vertical-align:middle;transition:background var(--mid) var(--ease)}
.item:hover .meta-dot{background:var(--crimson)}
.item.tone-positive:hover .meta-dot{background:var(--ok)}
.item-seen{margin-left:.5rem;font-size:.74rem;color:var(--ok);opacity:0;
transition:opacity var(--mid) var(--ease)}
.item.seen .item-seen{opacity:1;animation:tickPop 420ms var(--ease)}
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
background-size:200% 100%;animation:sweep 6s linear 3}
@keyframes sweep{to{background-position:200% 0}}

.why-steps{list-style:none;margin:1.4rem 0 0;padding:0;display:grid}
.why-step{display:grid;grid-template-columns:2.6rem 1fr;gap:1rem;padding-bottom:2rem;
transition:opacity var(--slow) var(--ease)}
.why-step:last-child{padding-bottom:0}
/* the dimming is applied only once the script can undo it, so the text is never stranded */
.why-steps.staged .why-step{opacity:.32}
.why-steps.staged .why-step.on{opacity:1}
.why-rail{display:flex;flex-direction:column;align-items:center}
.why-n{position:relative;width:2.4rem;height:2.4rem;flex:none;border-radius:50%;
border:1px solid var(--bd);background:var(--s1);display:flex;align-items:center;justify-content:center;
transition:border-color var(--mid) var(--ease),background var(--mid) var(--ease)}
.why-num,.why-check{position:absolute;transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease)}
.why-num{font-size:.78rem;font-weight:700;letter-spacing:.06em;color:var(--muted)}
.why-check{font-size:1rem;color:var(--ok);opacity:0;transform:scale(.5)}
.why-step.on .why-n{border-color:rgba(196,30,58,.35)}
.why-step.done .why-n{border-color:rgba(46,106,72,.4);background:var(--s2)}
.why-step.done .why-num{opacity:0}
.why-step.done .why-check{opacity:1;transform:none}
.why-line{flex:1;width:1px;margin-top:.5rem;background:var(--bd);position:relative;overflow:hidden}
.why-line::after{content:'';position:absolute;inset:0;background:var(--ok);
transform:scaleY(0);transform-origin:top;transition:transform var(--slow) var(--ease)}
.why-step.done .why-line::after{transform:scaleY(1)}
.why-step:last-child .why-line{display:none}
.why-body{display:flex;flex-direction:column;padding-top:.35rem}
.why-head{margin:0 0 .3rem;font-weight:650}
.why-body .blurb{margin:0}

.workspace{display:grid;grid-template-columns:12.5rem minmax(0,1fr);gap:3rem;align-items:start;padding-top:5.5rem}
.stages{position:sticky;top:5rem;display:flex;flex-direction:column;gap:.1rem}
.stage-tab{position:relative;overflow:hidden;display:flex;align-items:center;gap:.6rem;width:100%;padding:.7rem .8rem;
background:none;border:0;border-radius:10px;cursor:pointer;color:var(--muted);text-align:left;
font-size:.86rem;transition:background var(--mid) var(--ease),color var(--mid) var(--ease)}
.stage-tab:hover{background:rgba(255,255,255,.55);color:var(--tx)}
/* how far into the active stage the reader has actually got */
.stage-tab::before{content:'';position:absolute;left:0;top:0;bottom:0;width:var(--read,0%);
background:linear-gradient(90deg,rgba(255,143,174,.34),rgba(255,143,174,0));
opacity:0;pointer-events:none;transition:width 140ms linear,opacity var(--mid) var(--ease)}
.stage-tab.current::before{opacity:1}
.stage-num,.stage-name,.stage-mark{position:relative}
.stage-num{font-size:.7rem;letter-spacing:.1em;color:var(--subtle);flex:none}
.stage-name{flex:1;white-space:nowrap}
.stage-mark{font-size:.7rem;flex:none;color:var(--bd)}
.stage-tab.visited .stage-mark{color:var(--ok)}
.stage-tab.current{background:var(--s1);color:var(--tx);font-weight:640;
box-shadow:0 6px 18px rgba(26,22,19,.05)}
.stage-tab.current .stage-num{color:var(--crimson-dark)}
.stage-tab.current .stage-mark{color:var(--crimson)}

.panes{min-width:0}
.pane{min-width:0}
.pane.arriving{animation:paneIn 520ms var(--ease)}
.pane[data-pane="summary"].arriving{animation-duration:640ms}
.pane[data-pane="signals"].arriving{animation-duration:500ms}
.pane[data-pane="evidence"].arriving,.pane[data-pane="market"].arriving{animation:paneSoft 420ms var(--ease)}
.pane[data-pane="audit"].arriving,.pane[data-pane="audit"].arriving-back{animation:paneQuiet 340ms var(--ease)}
@keyframes paneSoft{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes paneQuiet{from{opacity:0}to{opacity:1}}
.pane.arriving-back{animation:paneBack 520ms var(--ease)}
@keyframes paneIn{from{opacity:0;transform:translateY(26px) scale(.985);filter:blur(6px)}
to{opacity:1;transform:none;filter:none}}
@keyframes paneBack{from{opacity:0;transform:translateY(-22px) scale(.99);filter:blur(5px)}
to{opacity:1;transform:none;filter:none}}

.audit{margin-bottom:2rem;font-size:.92rem}
.fold{border-top:1px solid var(--bd);padding:.2rem 0}
.fold summary{padding:.75rem .2rem;cursor:pointer;list-style:none;
font-size:.82rem;letter-spacing:.06em;color:var(--muted);
display:flex;align-items:center;gap:.5rem;
transition:color var(--mid) var(--ease)}
.fold summary::-webkit-details-marker{display:none}
.fold summary::before{content:'+';font-size:1.05rem;line-height:1;color:var(--subtle);width:.9rem}
.fold[open] summary::before{content:'−';color:var(--crimson-dark)}
.fold summary:hover{color:var(--tx)}
.fold-body{padding:.2rem 0 1rem}
.audit-card{background:rgba(255,255,255,.5);border:1px solid rgba(26,22,19,.06);border-radius:14px;padding:1.1rem 1.2rem;margin-bottom:.6rem}
.audit-grid{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}
.notes{margin:0;padding-left:1.1rem;color:var(--muted)}
.notes li{margin:.3rem 0}
.sources{width:100%;border-collapse:collapse;font-size:.84rem;margin-top:.4rem;color:var(--muted)}
.sources th{text-align:left;font-weight:600;padding:.45rem .6rem .45rem 0;border-bottom:1px solid var(--bd)}
.sources td{padding:.5rem .6rem;border-bottom:1px solid var(--bd)}
.sources td:first-child{padding-left:0}

.steps{display:flex;justify-content:space-between;gap:1rem;margin-top:1rem;padding-top:1.6rem;
border-top:1px solid var(--bd)}
.step{padding:.6rem 1.1rem;border-radius:999px;border:1px solid var(--bd);background:rgba(255,255,255,.6);
color:var(--muted);font-size:.84rem;font-weight:600;cursor:pointer;
transition:all var(--mid) var(--ease)}
.step:hover{color:var(--tx);border-color:var(--rosa)}
.step.next{color:var(--crimson-dark);border-color:rgba(196,30,58,.3)}
.step.next:hover{background:var(--s2);border-color:var(--crimson)}

.closing{text-align:center;padding-bottom:2rem}
.closing-arc{font-size:clamp(1rem,2.6vw,1.5rem);font-weight:650;margin:0 0 .6rem;letter-spacing:-.01em}
.closing-tally{margin:0;color:var(--muted);font-size:.86rem}

/* The side rail needs room the report itself is not using; below that it would overlap the text. */
@media(max-width:900px){.workspace{grid-template-columns:1fr;gap:1.2rem;padding-top:4.4rem}}

@media(max-width:900px){
  /* the sidebar becomes a sticky strip; it never becomes a hamburger */
  .stages{position:sticky;top:3.8rem;z-index:4;flex-direction:row;gap:.3rem;
  overflow-x:auto;scrollbar-width:none;padding:.5rem 0;
  background:rgba(246,241,231,.92);backdrop-filter:blur(12px)}
  .stages::-webkit-scrollbar{display:none}
  .stage-tab{width:auto;flex:none;min-height:44px;padding:.5rem .8rem}
  .stage-name{display:none}
  .stage-num{font-size:.82rem;letter-spacing:.06em}
  .stage-tab.current .stage-name{display:inline}
}

@media(max-width:640px){
  main{padding:0 1.1rem}
  .net{width:100%}
  .figure{font-size:clamp(4rem,22vw,6.5rem)}
  .metric{aspect-ratio:1/.86}
  .hero{padding-top:5rem;margin-bottom:4.5rem}
  .block{margin-bottom:3.6rem}
  .comp{grid-template-columns:1fr}
  .comp-name{width:3.8rem}
  .comp-row{min-height:44px}
  .insight{min-height:52px}
  .filters{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:.2rem;
  margin-left:-1.1rem;margin-right:-1.1rem;padding-left:1.1rem;padding-right:1.1rem}
  .filters::-webkit-scrollbar{display:none}
  .filter{flex:none;min-height:44px;display:flex;align-items:center}
  .panel-head{min-height:56px}
  .panel-cta,.panel-seen{display:none}
  /* the status hides here, so the way out of the staged view keeps its place */
  .bar{padding-top:.5rem;padding-bottom:.5rem}
  .bar-all{padding:.3rem .7rem;font-size:.72rem;min-height:44px}
  .bar-status{display:none}
  .steps{flex-direction:column}
  .step{min-height:44px;width:100%}
  .fold summary{min-height:44px}
  .sort{padding:.7rem 1rem}
  .sort-btn{min-height:44px}
  .more{min-height:44px}
  .audit-toggle{min-height:44px}
  /* the visible dot stays small; the touch target around it does not */
  .strip{padding:0 1.4rem}
  .point::after{content:'';position:absolute;left:50%;top:50%;width:44px;height:44px;
  transform:translate(-50%,-50%)}
  .point-tag{font-size:.68rem}
  .why-step{grid-template-columns:2.2rem 1fr;gap:.8rem}
  .why-n{width:2rem;height:2rem}
}

/* The screen app is an app. What goes on paper is the executive summary. */
.paper{display:none}
@media print{
  body > *:not(.paper){display:none!important}
  .paper{display:block}
  @page{size:A4;margin:14mm 15mm}
  body{background:#fff;color:#111;font-size:10.5pt;line-height:1.45}
  /* the bars and the tinted headers are data, so they have to survive the printer */
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .p-page{page-break-after:always;break-after:page}
  .p-page:last-child{page-break-after:auto;break-after:auto}
}
.p-head{margin:0 0 10mm;padding-bottom:2mm;border-bottom:1px solid #cfcfcf;
font-size:8pt;letter-spacing:.04em;color:#4a4a4a}
.p-eyebrow{margin:0;font-size:8.5pt;letter-spacing:.14em;text-transform:uppercase;color:#9E1329;font-weight:700}
.p-title{margin:2mm 0 1mm;font-size:22pt;line-height:1.15;letter-spacing:-.01em;color:#1A1613}
.p-sub{margin:0 0 7mm;font-size:10pt;color:#4a4a4a}
.p-h2{margin:8mm 0 3mm;font-size:13pt;color:#9E1329}
.p-note{margin:0 0 3mm;font-size:9pt;color:#4a4a4a;font-style:italic}
.p-frame,.p-table,.p-callout{width:100%;border-collapse:collapse;margin-bottom:5mm}
.p-frame th,.p-frame td,.p-table th,.p-table td,.p-callout th,.p-callout td{
border:1px solid #d9d9d9;padding:2.6mm 3mm;text-align:left;vertical-align:top;font-size:9.5pt}
.p-frame th,.p-callout th{width:32mm;background:#f4f7f4;color:#1f4c33;font-weight:700}
.p-table thead th{background:#f4f7f4;color:#1f4c33;font-weight:700;font-size:9pt}
.p-table tbody th{width:26mm;color:#9E1329;font-weight:700}
.p-num{text-align:right;white-space:nowrap}
.p-callout th{background:#eef5ee}
.p-callout.warn th{background:#fdf3e7;color:#8a5a12}
.p-frame{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:0 0 5mm}
.p-frame-card{border:1px solid #d9d9d9;border-left:1.2mm solid #1f4c33;border-radius:2mm;padding:3mm;background:#fbfbfa}
.p-frame-key{margin:0 0 1.4mm;font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:#1f4c33;font-weight:700}
.p-frame-val{margin:0;font-size:9pt;line-height:1.4}

.p-dates{display:flex;gap:3mm;margin:0 0 5mm}
.p-date{flex:1;border-radius:2mm;padding:3.5mm;color:#fff}
.p-date.a{background:#1f4c33}
.p-date.b{background:#9E1329}
.p-date-label{margin:0 0 1.4mm;font-size:8pt;letter-spacing:.08em;text-transform:uppercase;opacity:.85}
.p-date-value{margin:0;font-size:13pt;font-weight:700;line-height:1.1}

.p-tl{position:relative;height:9mm;margin:2mm 0 1mm;border-radius:1mm;background:#f0f0ef}
.p-tl-dot{position:absolute;top:50%;width:2.4mm;height:2.4mm;margin:-1.2mm 0 0 -1.2mm;border-radius:50%;background:#C41E3A}
.p-tl-dot.d1{background:#D62E52}
.p-tl-dot.d2{background:#9E1329}
.p-tl-dot.d3{background:#FF8FAE}
.p-tl-ends{display:flex;justify-content:space-between;font-size:7.5pt;color:#6a6a6a}

.p-evs{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.p-ev{border:1px solid #d9d9d9;border-radius:2mm;padding:3mm;background:#fff}
.p-ev-top{display:flex;justify-content:space-between;align-items:center;margin:0 0 1.8mm}
.p-chip{padding:.6mm 2mm;border-radius:3mm;font-size:7.5pt;font-weight:700;color:#fff;background:#C41E3A}
.p-chip.c1{background:#D62E52}
.p-chip.c2{background:#9E1329}
.p-chip.c3{background:#FF8FAE;color:#5a1020}
.p-ev-date{font-size:7.5pt;color:#6a6a6a}
.p-ev-text{margin:0;font-size:8.5pt;line-height:1.35}

.p-rates{display:flex;gap:3mm;flex-wrap:wrap;margin-bottom:5mm}
.p-rate{flex:1;min-width:32mm;border:1px solid #d9d9d9;border-top:1.2mm solid #C41E3A;border-radius:2mm;padding:3mm;background:#fbfbfa}
.p-rate.apart{border-top-color:#8a8a8a;background:#f4f4f3}
.p-rate-value{margin:0;font-size:14pt;font-weight:700;letter-spacing:-.02em}
.p-rate-label{margin:1mm 0 .6mm;font-size:8.5pt;color:#4a4a4a}
.p-rate-date{margin:0;font-size:7.5pt;color:#6a6a6a}

.p-srcs-title{margin:5mm 0 2mm;font-size:8pt;letter-spacing:.1em;text-transform:uppercase;color:#6a6a6a}
.p-srcs{display:flex;flex-wrap:wrap;gap:2mm}
.p-src{border:1px solid #d9d9d9;border-radius:4mm;padding:1.4mm 3mm;font-size:7.5pt;background:#fbfbfa}
.p-node-count{margin:1mm 0 0;font-size:12pt;font-weight:700;color:#9E1329}
.p-provs{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-bottom:5mm}
.p-prov{border:1px solid #d9d9d9;border-radius:2mm;padding:3mm;background:#fbfbfa}
.p-prov-label{margin:0 0 1.2mm;font-size:8pt;font-weight:700;color:#9E1329}
.p-prov-note{margin:0;font-size:8pt;line-height:1.35;color:#4a4a4a}

.p-card-note{margin:2.4mm 0 0;font-size:7.5pt;color:#6a6a6a;text-align:center}
.p-board{display:flex;gap:4mm;margin:0 0 5mm;align-items:stretch}
.p-card{flex:1;border:1px solid #d9d9d9;border-radius:2mm;padding:3mm;background:#fbfbfa}
.p-card.wide{flex:1.7}
.p-card-title{margin:0 0 2.5mm;font-size:9pt;font-weight:700;color:#1f4c33}
.p-ring{display:flex;justify-content:center}
.p-ring .ring{width:34mm}
.p-ring .ring-arc{opacity:1}
.p-ranked{display:block}
.p-ranked .rank{display:grid;grid-template-columns:5mm 16mm 1fr 8mm 10mm;gap:2mm;align-items:center;
width:100%;padding:1mm 0;border:0;background:none;text-align:left}
.p-ranked .rank-i{font-size:7.5pt;color:#8a8a8a}
.p-ranked .rank-name{font-size:8pt;color:#4a4a4a}
.p-ranked .rank-track{height:2.4mm;border-radius:1.2mm;background:#e8e8e8;overflow:hidden}
.p-ranked .rank-bar{display:block;height:100%;width:var(--w);border-radius:1.2mm;background:#C41E3A;transition:none}
.p-ranked .rank-n{font-size:9pt;font-weight:700;text-align:right}
.p-ranked .rank-share{font-size:8pt;color:#6a6a6a;text-align:right}
.p-kpis{display:flex;gap:3mm;margin:0 0 6mm}
.p-kpi{flex:1;border:1px solid #d9d9d9;border-radius:2mm;padding:3mm;background:#fbfbfa}
.p-kpi-label{margin:0;font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:#6a6a6a}
.p-kpi-value{margin:1.4mm 0 .8mm;font-size:15pt;font-weight:700;line-height:1.05;color:#1A1613}
.p-kpi-note{margin:0;font-size:7.5pt;color:#6a6a6a}
.p-bar-cell{width:34mm}
.p-bar{display:block;height:2.6mm;border-radius:1.3mm;background:#C41E3A;min-width:1mm}
.p-map{margin:6mm 0;padding:5mm;border:1px solid #d9d9d9;border-radius:3mm;text-align:center;background:#fbfbfa}
.p-map-title{margin:0;font-size:12pt;font-weight:700}
.p-map-sub{margin:1mm 0 4mm;font-size:9pt;color:#4a4a4a}
.p-nodes{display:flex;gap:3mm;justify-content:center;align-items:stretch}
.p-node{flex:1;border:1px solid #d9d9d9;border-radius:2mm;padding:3mm;text-align:left;background:#fff}
.p-node.n0{background:#f1f7f2;border-color:#bcd8c3}
.p-node.n1{background:#eef3fa;border-color:#c3d3e8}
.p-node.n2{background:#eef3fa;border-color:#c3d3e8}
.p-node.n3{background:#fdf6ea;border-color:#e6d3ae}
.p-node-name{margin:0;font-size:9.5pt;font-weight:700}
.p-arrow{height:3mm;margin:4mm 8mm 3mm;background:linear-gradient(90deg,#cfcfcf,#8a8a8a);
clip-path:polygon(0 40%,94% 40%,94% 0,100% 50%,94% 100%,94% 60%,0 60%)}
.p-pill{display:inline-block;margin:0;padding:2.4mm 5mm;border-radius:6mm;
background:#1f4c33;color:#fff;font-size:9.5pt;font-weight:700}
.p-map-foot{margin:3mm 0 0;font-size:8pt;color:#6a6a6a}
.p-generated{margin:6mm 0 0;font-size:8.5pt;color:#6a6a6a}
.p-foot{margin:8mm 0 0;padding-top:2mm;border-top:1px solid #e2e2e2;
font-size:8pt;color:#6a6a6a;text-align:right}

@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .glow,.pulse,.investigating::after,.arc circle,.figure,.net .spark.on,.morph.travel,
  .item.fresh,.tick.on .tick-mark,.insight.on .insight-mark,.net .node.on circle{animation:none}
  [data-enter],.bar,.panel-body,.panel-inner,.net .link,.net .node circle,.net .node text,
  .investigate,.net,.figure,.insight,.dot,.tick,.flash,
  .filter-result,.item,.item::before,.point,.point-tag,.meta-dot,.doc-go,.panel-seen,.panels,.item-seen,.step,.kpi,.jump,.rank-bar,.ring-arc,
  .why-step,.why-n,.why-num,.why-check,.why-line::after,.stage-tab,.stage-tab::before{transition:none}
  .pane.arriving,.pane.arriving-back{animation:none}
  .net .spark{display:none}
  .item:hover{transform:none}
  /* the sequence is the content here, so it arrives complete rather than not at all */
  .why-step{opacity:1}
}
`;
}
