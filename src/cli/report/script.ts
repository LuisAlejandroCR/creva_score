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
  var figure=document.getElementById('kpi-count');
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

  var tabs=[].slice.call(document.querySelectorAll('.stage-tab'));
  var panes=[].slice.call(document.querySelectorAll('.pane'));
  var order=tabs.map(function(t){return t.getAttribute('data-stage');});
  var current=order[0];
  var entered={};

  function paneOf(id){return document.getElementById('pane-'+id);}
  function tabOf(id){return document.getElementById('tab-'+id);}

  function enterStage(id){
    var pane=paneOf(id);
    if(!pane)return;
    var tab=tabOf(id);
    if(tab)tab.classList.add('visited');
    [].slice.call(pane.querySelectorAll('[data-enter]')).forEach(function(b,i){
      setTimeout(function(){b.classList.add('on');},reduce?0:i*120);
    });
    if(entered[id])return;
    entered[id]=true;
    if(id==='summary')revealSummary();
    if(id==='signals')growComposition();
    if(id==='market')pickPoint(0);
  }

  function goToStage(id,opts){
    if(!paneOf(id))return;
    var options=opts||{};
    var back=order.indexOf(id)<order.indexOf(current);
    current=id;

    panes.forEach(function(p){
      var on=p.getAttribute('data-pane')===id;
      p.hidden=!on;
      p.classList.remove('arriving','arriving-back');
      if(on&&!reduce)p.classList.add(back?'arriving-back':'arriving');
    });
    tabs.forEach(function(t){
      var on=t.getAttribute('data-stage')===id;
      t.classList.toggle('current',on);
      t.setAttribute('aria-selected',on?'true':'false');
      t.setAttribute('tabindex',on?'0':'-1');
    });

    // Landing at the top is what keeps the stage header in view; scrollIntoView on an
    // inner panel drops the reader into the middle with the context above them.
    if(options.keepScroll!==true)window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});
    enterStage(id);
    tabs.forEach(function(t){
      var on=t.getAttribute('data-stage')===id;
      t.querySelector('.stage-mark').textContent=on?'●':(t.classList.contains('visited')?'✓':'○');
    });
    trackReading();
    if(options.focusPane===true)paneOf(id).focus();
  }

  // B55's geometry, reused: it now measures how much of the active stage has been read,
  // and a stage is only marked complete once the reader actually reached its end.
  function trackReading(){
    var pane=paneOf(current);
    var tab=tabOf(current);
    if(!pane||!tab)return;
    var box=pane.getBoundingClientRect();
    var scrollable=box.height-window.innerHeight;
    var read=scrollable<=0?1:Math.min(Math.max(-box.top/scrollable,0),1);
    tab.style.setProperty('--read',Math.round(read*100)+'%');
  }

  function moveTab(step){
    var index=order.indexOf(current)+step;
    if(index<0||index>=order.length)return;
    var next=order[index];
    goToStage(next);
    tabOf(next).focus();
  }

  function revealSummary(){
    var cards=[].slice.call(document.querySelectorAll('.kpi'));
    var jumps=[].slice.call(document.querySelectorAll('.jump'));
    cards.forEach(function(c,i){setTimeout(function(){c.classList.add('on');},reduce?0:i*160);});
    jumps.forEach(function(j,i){setTimeout(function(){j.classList.add('on');},reduce?0:cards.length*160+i*110);});
  }

  // Rewind, then let it play. Nothing here is required for the chart to be correct.
  function playGraphics(){
    var bars=[].slice.call(document.querySelectorAll('.board .rank-bar'));
    var arcs=[].slice.call(document.querySelectorAll('.board .ring-arc'));
    bars.forEach(function(b){b.style.width='0';});
    arcs.forEach(function(a){a.style.opacity='0';});
    requestAnimationFrame(function(){
      bars.forEach(function(b){b.style.width='';});
      setTimeout(function(){arcs.forEach(function(a){a.style.opacity='';});},240);
    });
    // If no frame ever arrives, put the data back rather than leave an empty chart.
    setTimeout(function(){
      bars.forEach(function(b){b.style.width='';});
      arcs.forEach(function(a){a.style.opacity='';});
    },1400);
  }

  function growComposition(){
    if(!reduce)playGraphics();
    // Remember what the untouched state says, so deselecting can restore it exactly.
    var centre=document.querySelector('.board .ring-n');
    var label=document.getElementById('comp-detail-label');
    if(centre&&!centre.getAttribute('data-total'))centre.setAttribute('data-total',centre.textContent);
    if(label&&!label.getAttribute('data-total-label'))label.setAttribute('data-total-label',label.innerHTML);
  }

  function settle(){
    report.classList.remove('staging');
    bar.classList.add('on');
    bar.setAttribute('aria-hidden','false');
    if(ambient)ambient.style.opacity='.55';
    if(figure){
      setTimeout(function(){figure.classList.add('settled');countUp(figure);},reduce?0:220);
    }
    goToStage('summary',{keepScroll:true});
    window.addEventListener('scroll',trackReading,{passive:true});
  }

  // The dot leaves the network and lands where the figure will be, so the two scenes read as one.
  function travelIntoFigure(done){
    var dot=flash||document.getElementById('root-dot');
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
    // The total must not share the screen with the tree it came from: the network
    // clears first, the figure is announced alone, and only then does it travel.
    setTimeout(function(){
      sparks.forEach(function(s){s.classList.remove('on');});
      investigate.classList.add('cleared');
    },settled+520);
    setTimeout(function(){if(flash)flash.classList.add('on');},settled+1240);
    setTimeout(function(){
      investigate.classList.add('collapse');
      travelIntoFigure(function(){
        if(flash)flash.classList.remove('on');
        investigate.classList.add('hidden');
        settle();
      });
    },settled+3440);
  }

  // Staged panes hide their own text from find-in-page and from the printer.
  // This is the way back out to a single flat document.
  function openEverything(){
    [].slice.call(document.querySelectorAll('details.fold')).forEach(function(d){d.open=true;});
    panes.forEach(function(p){p.hidden=false;});
  }

  function showAll(on){
    var workspace=document.querySelector('.workspace');
    var rail=document.getElementById('rail');
    var button=document.getElementById('show-all');
    if(!workspace||!rail||!button)return;

    workspace.classList.toggle('all',on);
    rail.hidden=on;
    button.setAttribute('aria-pressed',on?'true':'false');
    button.textContent=on?'Ver por etapas':'Ver todo';

    if(on){openEverything();return;}
    panes.forEach(function(p){p.hidden=p.getAttribute('data-pane')!==current;});
  }

  // A page cannot attach a PDF to wa.me — no URL parameter carries a file, and the
  // print dialog's output never comes back to the page. What it can do is hand the
  // whole self-contained report to the share sheet, which WhatsApp accepts as a file.
  function shareOnWhatsApp(){
    var share=window.CREVA_SHARE||{};
    var text=(share.title||'Creva')+String.fromCharCode(10)+(share.summary||'');

    try{
      if(navigator.canShare&&window.File){
        openEverything();
        var page='<!doctype html>'+document.documentElement.outerHTML;
        var file=new File([page],(share.file||'creva-reporte')+'.html',{type:'text/html'});
        if(navigator.canShare({files:[file]})){
          navigator.share({title:share.title,text:text,files:[file]}).catch(function(){});
          return;
        }
      }
    }catch(e){/* fall through to the text-only path */}

    window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');
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
    var wrap=document.querySelector('.panels');
    if(wrap&&!reduce){
      wrap.classList.add('swapping');
      setTimeout(function(){wrap.classList.remove('swapping');},180);
    }
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
      if(!reduce){
        list[i].style.setProperty('--s',String(i-visible));
        list[i].classList.add('fresh');
      }
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
    button.textContent=left===0?'Mostrar todo · '+step+' más':'Mostrar '+step+' más → quedan '+left;
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
    goToStage('evidence',{focusPane:true});

    var first=target.querySelector('.item');
    if(!first)return;
    pickEvidence(first);
    if(!reduce){
      first.classList.remove('spotlight');
      void first.offsetWidth;
      first.classList.add('spotlight');
    }
  }

  function pickComposition(id,allowToggle){
    var list=document.getElementById('ranked');
    var label=document.getElementById('comp-detail-label');
    var go=document.getElementById('comp-go');
    var centre=document.querySelector('.board .ring-n');
    if(!list||!label||!go||!centre)return;

    var current=list.querySelector('.rank.picked');
    var same=allowToggle===true&&current!==null&&current.getAttribute('data-lane')===id;
    var picked=null;

    [].slice.call(list.querySelectorAll('.rank')).forEach(function(row){
      var on=!same&&row.getAttribute('data-lane')===id;
      row.classList.toggle('picked',on);
      if(on)picked=row;
    });
    list.classList.toggle('picking',picked!==null);

    focusTimeline(picked===null?null:picked.getAttribute('data-lane'));

    if(picked===null){
      centre.textContent=centre.getAttribute('data-total')||centre.textContent;
      label.innerHTML=label.getAttribute('data-total-label')||label.innerHTML;
      go.hidden=true;
      return;
    }
    centre.textContent=picked.querySelector('.rank-n').textContent;
    label.textContent=picked.querySelector('.rank-name').textContent.trim()+' · '+picked.querySelector('.rank-share').textContent+' de las señales';
    go.hidden=false;
    go.setAttribute('data-lane',picked.getAttribute('data-lane'));
  }

  // One lane focus drives the whole Signals stage: the ranked list, the ring, the
  // timeline dots and its filter chips all read from it.
  function focusTimeline(lane){
    var tl=document.querySelector('.tl');
    if(!tl)return;
    tl.setAttribute('data-picked',lane===null?'':lane);

    var picked=null;
    [].slice.call(tl.querySelectorAll('.tl-dot')).forEach(function(dot){
      var out=lane!==null&&dot.getAttribute('data-lane')!==lane;
      dot.classList.toggle('muted',out);
      if(out)return;
      if(picked===null||dot.getAttribute('data-at')>picked.getAttribute('data-at'))picked=dot;
    });

    [].slice.call(document.querySelectorAll('.tl-filter')).forEach(function(chip){
      var on=chip.getAttribute('data-tlfilter')===(lane===null?'all':lane);
      chip.classList.toggle('selected',on);
      chip.setAttribute('aria-pressed',on?'true':'false');
    });

    var current=tl.querySelector('.tl-dot.picked');
    if(picked&&(current===null||current.classList.contains('muted')))pickTimeline(picked);
  }

  function pickTimeline(dot){
    if(!dot)return;
    [].slice.call(document.querySelectorAll('.tl-dot')).forEach(function(d){d.classList.toggle('picked',d===dot);});

    var chip=document.getElementById('tl-detail-chip');
    var date=document.getElementById('tl-detail-date');
    var text=document.getElementById('tl-detail-text');
    var doc=document.getElementById('tl-detail-doc');
    if(chip){chip.textContent=dot.getAttribute('data-short');chip.className='tl-chip '+laneClass(dot);}
    if(date)date.textContent=dot.getAttribute('data-date');
    if(text)text.textContent=dot.getAttribute('data-detail');
    if(doc){
      var url=dot.getAttribute('data-url');
      doc.hidden=url==='';
      if(url!=='')doc.setAttribute('href',url);
    }
  }

  function laneClass(el){
    var match=/\\bd(\\d)\\b/.exec(el.className);
    return match===null?'d0':'d'+match[1];
  }

  // Choosing an item fills the detail beside it. It never leaves the stage.
  function pickEvidence(item){
    if(!item)return;
    [].slice.call(document.querySelectorAll('.item')).forEach(function(i){i.classList.toggle('picked',i===item);});

    var chip=document.getElementById('ev-chip');
    var date=document.getElementById('ev-date');
    var label=document.getElementById('ev-label');
    var text=document.getElementById('ev-text');
    var source=document.getElementById('ev-source');
    var doc=document.getElementById('ev-doc');
    if(chip){chip.textContent=item.getAttribute('data-short');chip.className='ev-chip d'+item.getAttribute('data-lane-i');}
    if(date)date.textContent=item.getAttribute('data-when');
    if(label)label.textContent=item.getAttribute('data-label');
    if(text)text.textContent=item.getAttribute('data-detail');
    if(source)source.textContent=item.getAttribute('data-source');
    if(doc){
      var url=item.getAttribute('data-url');
      doc.hidden=url==='';
      if(url!=='')doc.setAttribute('href',url);
    }
  }

  function pickPoint(index){
    var points=[].slice.call(document.querySelectorAll('.point'));
    var picked=points[index];
    if(!picked)return;
    points.forEach(function(p,i){p.classList.toggle('picked',i===index);});

    var label=document.getElementById('strip-label');
    var date=document.getElementById('strip-date');
    if(label)label.textContent=picked.getAttribute('data-label');
    if(date)date.textContent=picked.getAttribute('data-date');
  }

  document.addEventListener('keydown',function(e){
    if(!e.target||!e.target.closest||!e.target.closest('.stage-tab'))return;
    var key=e.key;
    if(key==='ArrowDown'||key==='ArrowRight'){e.preventDefault();moveTab(1);return;}
    if(key==='ArrowUp'||key==='ArrowLeft'){e.preventDefault();moveTab(-1);return;}
    if(key==='Home'){e.preventDefault();goToStage(order[0]);tabOf(order[0]).focus();return;}
    if(key==='End'){e.preventDefault();var last=order[order.length-1];goToStage(last);tabOf(last).focus();}
  });

  document.addEventListener('click',function(e){
    var t=e.target;
    if(!t||!t.closest)return;

    var doc=t.closest('.doc');
    if(doc){
      var item=doc.closest('.item');
      if(item)item.classList.add('seen');
      return;
    }

    var head=t.closest('.panel-head');
    if(head){togglePanel(head.parentNode);return;}

    if(t.closest('#show-all')){
      showAll(document.getElementById('show-all').getAttribute('aria-pressed')!=='true');
      return;
    }

    if(t.closest('#to-pdf')){window.print();return;}
    if(t.closest('#to-whatsapp')){shareOnWhatsApp();return;}

    var stageTab=t.closest('.stage-tab');
    if(stageTab){goToStage(stageTab.getAttribute('data-stage'));return;}

    var step=t.closest('[data-step]');
    if(step){goToStage(step.getAttribute('data-step'),{focusPane:true});return;}

    var sort=t.closest('.sort-btn');
    if(sort){sortPanel(sort.closest('.panel'),sort.getAttribute('data-sort'));return;}

    var more=t.closest('.more');
    if(more){showMore(more.closest('.panel'));return;}

    var filter=t.closest('.filter');
    if(filter){setFilter(filter.getAttribute('data-filter'));return;}

    var pick=t.closest('.item-pick');
    if(pick){pickEvidence(pick.closest('.item'));return;}

    var tlDot=t.closest('.tl-dot');
    if(tlDot){pickTimeline(tlDot);return;}

    var tlFilter=t.closest('.tl-filter');
    if(tlFilter){
      var lane=tlFilter.getAttribute('data-tlfilter');
      pickComposition(lane==='all'?'':lane);
      return;
    }

    var point=t.closest('.point');
    if(point){pickPoint(parseInt(point.getAttribute('data-point'),10)||0);return;}

    var row=t.closest('.rank');
    if(row){pickComposition(row.getAttribute('data-lane'),true);return;}

    var go=t.closest('.comp-go');
    if(go){jumpToLane(go.getAttribute('data-lane'));return;}
  });
})();
`;
}
