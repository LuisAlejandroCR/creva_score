// script: the client behaviour, inlined so the page stays one file.

export function script(): string {
  return `
(function(){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var investigate=document.getElementById('stage-investigate');
  var report=document.getElementById('stage-report');
  var bar=document.getElementById('bar');
  var morph=document.getElementById('morph');
  var ambient=document.querySelector('.ambient');
  var links=[].slice.call(document.querySelectorAll('.net .link'));
  var sparks=[].slice.call(document.querySelectorAll('.net .spark'));
  var nodes=[].slice.call(document.querySelectorAll('.net .node'));
  var ticks=[].slice.call(document.querySelectorAll('.tick'));
  var figure=report.querySelector('.figure');
  var progressN=document.getElementById('progress-n');
  var progressW=document.getElementById('progress-w');
  var flash=document.getElementById('flash');

  function countUp(el,dur){
    var target=parseInt(el.getAttribute('data-count'),10)||0;
    if(reduce||target===0){el.textContent=String(target);return;}
    var started=null,span=dur||1000;
    function tick(now){
      if(started===null)started=now;
      var p=Math.min((now-started)/span,1);
      el.textContent=String(Math.round(target*(1-Math.pow(1-p,3))));
      if(p<1)requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // A hidden tab never runs an animation frame, and a count stuck at 0 would
    // state a figure the report does not hold.
    setTimeout(function(){el.textContent=String(target);},span+400);
  }

  function connected(i){
    if(ticks[i])ticks[i].classList.add('on');
    var n=i+1;
    if(progressN)progressN.textContent=String(n);
    if(progressW)progressW.textContent=n===1?'fuente conectada':'fuentes conectadas';
  }

  function enterBlocks(){
    var blocks=[].slice.call(report.querySelectorAll('[data-enter]'));
    blocks.forEach(function(b,i){setTimeout(function(){b.classList.add('on');},reduce?0:i*150);});
  }

  function revealSummary(){
    var cards=[].slice.call(document.querySelectorAll('.insight'));
    var done=document.getElementById('summary-done');
    var cue=document.getElementById('explore-cue');
    cards.forEach(function(c,i){setTimeout(function(){c.classList.add('on');},reduce?0:i*260);});
    setTimeout(function(){
      if(done)done.classList.add('on');
      if(cue)cue.classList.add('on');
    },reduce?0:cards.length*260+240);
  }

  function growComposition(){
    [].slice.call(document.querySelectorAll('.comp-row')).forEach(function(row,i){
      setTimeout(function(){
        row.classList.add('grown');
        countUp(row.querySelector('.comp-n'),700);
      },reduce?0:i*160);
    });
    var total=document.getElementById('comp-detail-n');
    if(total)setTimeout(function(){countUp(total,900);},reduce?0:420);
  }

  function settle(){
    report.classList.remove('staging');
    bar.classList.add('on');
    bar.setAttribute('aria-hidden','false');
    if(ambient)ambient.style.opacity='.55';
    enterBlocks();
    if(figure){
      setTimeout(function(){figure.classList.add('settled');countUp(figure);},reduce?0:220);
    }
    setTimeout(revealSummary,reduce?0:1300);
    setTimeout(growComposition,reduce?0:1900);
    pickPoint(0);
    watchWhy();
    watchSections();
  }

  // The dot leaves the network and lands where the figure will be, so the two scenes read as one.
  function travelIntoFigure(done){
    var dot=document.getElementById('root-dot');
    if(!dot||!figure||!morph||typeof dot.getBoundingClientRect!=='function'){done();return;}

    var from=dot.getBoundingClientRect();
    var to=figure.getBoundingClientRect();
    if(!to.width||!from.width){done();return;}

    // The report still sits below the investigation, so the figure lands
    // exactly one investigation-height higher once that stage leaves the flow.
    var lift=investigate.getBoundingClientRect().height;
    var fromX=from.left+from.width/2;
    var fromY=from.top+from.height/2;

    morph.style.left=(fromX-5)+'px';
    morph.style.top=(fromY-5)+'px';
    morph.style.opacity='1';
    morph.style.transition='transform 760ms cubic-bezier(.22,.61,.36,1),opacity 240ms ease 620ms';
    morph.classList.add('travel');

    requestAnimationFrame(function(){
      var dx=(to.left+to.width/2)-fromX;
      var dy=(to.top+to.height/2-lift)-fromY;
      morph.style.transform='translate3d('+dx+'px,'+dy+'px,0) scale(9)';
      morph.style.opacity='0';
    });
    setTimeout(done,700);
  }

  if(reduce){
    links.forEach(function(l){l.classList.add('on');});
    nodes.forEach(function(n,i){n.classList.add('on');connected(i);});
    investigate.classList.add('hidden');
    settle();
  } else {
    if(ambient)ambient.style.opacity='1';
    links.forEach(function(link,i){setTimeout(function(){link.classList.add('on');},260+i*260);});
    sparks.forEach(function(spark,i){setTimeout(function(){spark.classList.add('on');},420+i*260);});
    nodes.forEach(function(node,i){setTimeout(function(){node.classList.add('on');connected(i);},900+i*260);});

    var settled=900+nodes.length*260;
    setTimeout(function(){if(flash)flash.classList.add('on');},settled+240);
    setTimeout(function(){
      sparks.forEach(function(s){s.classList.remove('on');});
      if(flash)flash.classList.remove('on');
      investigate.classList.add('collapse');
      travelIntoFigure(function(){
        investigate.classList.add('hidden');
        settle();
      });
    },settled+1500);
  }

  function panels(){return [].slice.call(document.querySelectorAll('.panel'));}

  function setFilter(id){
    var shown=0;
    [].slice.call(document.querySelectorAll('.filter')).forEach(function(f){
      var on=f.getAttribute('data-filter')===id;
      f.classList.toggle('selected',on);
      f.setAttribute('aria-pressed',on?'true':'false');
    });
    panels().forEach(function(p){
      var lane=p.getAttribute('data-panel');
      var on=id==='all'||lane===id;
      p.hidden=!on;
      if(on)shown+=parseInt(p.getAttribute('data-total'),10)||0;
    });
    var out=document.getElementById('filter-result');
    if(out){
      var word=shown===1?'resultado':'resultados';
      var label=id==='all'?shown+' '+word:id.toUpperCase()+' · '+shown+' '+word;
      out.classList.add('blip');
      setTimeout(function(){out.textContent=label;out.classList.remove('blip');},reduce?0:120);
    }
  }

  function nextVisible(visible,total){
    if(visible<6)return Math.min(6,total);
    if(visible<10)return Math.min(10,total);
    return total;
  }

  function items(panel){return [].slice.call(panel.querySelectorAll('.item'));}

  function applyVisibility(panel){
    var visible=parseInt(panel.getAttribute('data-visible'),10)||0;
    items(panel).forEach(function(item,i){item.hidden=i>=visible;});
  }

  function showMore(panel){
    var visible=parseInt(panel.getAttribute('data-visible'),10)||0;
    var total=parseInt(panel.getAttribute('data-total'),10)||0;
    var next=nextVisible(visible,total);
    var list=items(panel);

    for(var i=visible;i<next;i++){
      if(!list[i])continue;
      list[i].hidden=false;
      if(!reduce)list[i].classList.add('fresh');
    }
    panel.setAttribute('data-visible',String(next));

    var button=panel.querySelector('.more');
    if(!button)return;
    if(next>=total){
      var wrap=button.parentNode;
      if(wrap&&wrap.parentNode)wrap.parentNode.removeChild(wrap);
      return;
    }
    var step=nextVisible(next,total)-next;
    var left=total-nextVisible(next,total);
    button.textContent=left===0?'Mostrar '+step+' más →':'Mostrar '+step+' más → quedan '+left;
  }

  function sortPanel(panel,mode){
    var list=items(panel);
    var inner=panel.querySelector('.panel-inner');
    if(!inner)return;

    list.sort(function(a,b){
      if(mode==='recent'){
        var da=a.getAttribute('data-date')||'';
        var db=b.getAttribute('data-date')||'';
        if(da!==db)return da<db?1:-1;
      }
      return (parseInt(a.getAttribute('data-order'),10)||0)-(parseInt(b.getAttribute('data-order'),10)||0);
    });

    var anchor=panel.querySelector('.more-wrap');
    list.forEach(function(item){
      item.classList.remove('fresh');
      if(anchor)inner.insertBefore(item,anchor);
      else inner.appendChild(item);
    });
    applyVisibility(panel);

    [].slice.call(panel.querySelectorAll('.sort-btn')).forEach(function(b){
      var on=b.getAttribute('data-sort')===mode;
      b.classList.toggle('selected',on);
      b.setAttribute('aria-pressed',on?'true':'false');
    });
  }

  function openPanel(panel){
    if(panel.classList.contains('open'))return;
    panel.classList.add('open');
    var head=panel.querySelector('.panel-head');
    if(head)head.setAttribute('aria-expanded','true');
    var mark=panel.querySelector('.panel-toggle');
    if(mark)mark.textContent='−';
  }

  function togglePanel(panel){
    if(panel.classList.contains('open')){
      panel.classList.remove('open');
      var head=panel.querySelector('.panel-head');
      if(head)head.setAttribute('aria-expanded','false');
      var mark=panel.querySelector('.panel-toggle');
      if(mark)mark.textContent='+';
      return;
    }
    openPanel(panel);
  }

  function jumpToLane(id){
    setFilter(id);
    pickComposition(id);
    var target=document.getElementById('lane-'+id);
    if(!target)return;
    panels().forEach(function(p){p.classList.toggle('active',p===target);});
    openPanel(target);
    target.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});
  }

  function pickComposition(id,allowToggle){
    var rows=document.getElementById('comp-rows');
    if(!rows)return;
    var n=document.getElementById('comp-detail-n');
    var label=document.getElementById('comp-detail-label');
    var go=document.getElementById('comp-go');
    if(!n||!label||!go)return;

    var current=rows.querySelector('.comp-row.picked');
    var same=allowToggle===true&&current!==null&&current.getAttribute('data-lane')===id;
    var picked=null;

    [].slice.call(rows.querySelectorAll('.comp-row')).forEach(function(r){
      var on=!same&&r.getAttribute('data-lane')===id;
      r.classList.toggle('picked',on);
      if(on)picked=r;
    });
    rows.classList.toggle('picking',picked!==null);

    if(picked===null){
      n.setAttribute('data-count',n.getAttribute('data-total-count'));
      countUp(n,520);
      label.textContent='señales en total';
      go.hidden=true;
      return;
    }
    n.setAttribute('data-count',picked.querySelector('.comp-n').getAttribute('data-count'));
    countUp(n,520);
    label.textContent=picked.getAttribute('data-lane').toUpperCase();
    go.hidden=false;
    go.setAttribute('data-lane',picked.getAttribute('data-lane'));
  }

  // Each step completes the one before it, so the reader sees a sequence resolve.
  function watchWhy(){
    var list=document.querySelector('.why-steps');
    var steps=[].slice.call(document.querySelectorAll('.why-step'));
    if(!list||steps.length===0)return;

    if(reduce||typeof IntersectionObserver!=='function'){
      steps.forEach(function(s){s.classList.add('on','done');});
      return;
    }

    // All three fit on screen at once, so the sequence is paced in time rather than by
    // scroll position: observing each step separately would light them all together.
    function run(){
      steps.forEach(function(step,i){
        setTimeout(function(){
          for(var j=0;j<i;j++)steps[j].classList.add('done');
          step.classList.add('on');
        },i*700);
      });
      setTimeout(function(){steps[steps.length-1].classList.add('done');},steps.length*700+200);
    }

    list.classList.add('staged');
    var started=false;
    var seen=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting||started)return;
        started=true;
        seen.disconnect();
        run();
      });
    },{threshold:.35});
    seen.observe(list);
  }

  function watchSections(){
    var dots=[].slice.call(document.querySelectorAll('.dot-nav'));
    var wrap=document.getElementById('dots');
    if(dots.length===0||!wrap)return;

    var targets=dots.map(function(d){return document.getElementById(d.getAttribute('data-goto'));});
    function mark(id){
      dots.forEach(function(d){d.setAttribute('aria-current',d.getAttribute('data-goto')===id?'true':'false');});
    }
    mark(dots[0].getAttribute('data-goto'));
    wrap.classList.add('on');

    if(typeof IntersectionObserver!=='function')return;

    // Sections are separated by wide gaps, so "whichever crossed a line last" leaves the
    // indicator stale. The nearest section to the middle of the viewport always has an answer.
    function nearest(){
      var middle=window.innerHeight/2;
      var best=null,bestGap=Infinity;
      targets.forEach(function(t){
        if(!t)return;
        var box=t.getBoundingClientRect();
        var gap=Math.abs((box.top+box.bottom)/2-middle);
        if(gap<bestGap){bestGap=gap;best=t;}
      });
      if(best)mark(best.id);
    }

    var seen=new IntersectionObserver(nearest,{threshold:[0,.25,.5,.75,1]});
    targets.forEach(function(t){if(t)seen.observe(t);});
    window.addEventListener('scroll',nearest,{passive:true});
    nearest();
  }

  function toggleAudit(){
    var button=document.getElementById('audit-toggle');
    var body=document.getElementById('audit-more');
    if(!button||!body)return;
    var open=body.hidden;
    body.hidden=!open;
    button.setAttribute('aria-expanded',open?'true':'false');
    var mark=button.querySelector('.audit-toggle-mark');
    if(mark)mark.textContent=open?'−':'+';
  }

  function pickPoint(index){
    var points=[].slice.call(document.querySelectorAll('.point'));
    var picked=points[index];
    if(!picked)return;
    points.forEach(function(p,i){p.classList.toggle('picked',i===index);});

    var value=document.getElementById('strip-value');
    var label=document.getElementById('strip-label');
    var date=document.getElementById('strip-date');
    if(value)value.textContent=picked.getAttribute('data-text');
    if(label)label.textContent=picked.getAttribute('data-label');
    if(date)date.textContent=picked.getAttribute('data-date');
  }

  document.addEventListener('click',function(e){
    var t=e.target;
    if(!t||!t.closest)return;

    var head=t.closest('.panel-head');
    if(head){togglePanel(head.parentNode);return;}

    if(t.closest('#audit-toggle')){toggleAudit();return;}

    var goto=t.closest('.dot-nav');
    if(goto){
      var section=document.getElementById(goto.getAttribute('data-goto'));
      if(section)section.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
      return;
    }

    var sort=t.closest('.sort-btn');
    if(sort){sortPanel(sort.closest('.panel'),sort.getAttribute('data-sort'));return;}

    var more=t.closest('.more');
    if(more){showMore(more.closest('.panel'));return;}

    var filter=t.closest('.filter');
    if(filter){setFilter(filter.getAttribute('data-filter'));return;}

    var insight=t.closest('.insight');
    if(insight){jumpToLane(insight.getAttribute('data-target'));return;}

    var point=t.closest('.point');
    if(point){pickPoint(parseInt(point.getAttribute('data-point'),10)||0);return;}

    var row=t.closest('.comp-row');
    if(row){pickComposition(row.getAttribute('data-lane'),true);return;}

    var go=t.closest('.comp-go');
    if(go){jumpToLane(go.getAttribute('data-lane'));return;}
  });
})();
`;
}
