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

  // Rewind, then let it play. Nothing here is required for the chart to be correct.
  function rewind(nodes,prop,zero){
    if(reduce)return;
    nodes.forEach(function(n){n.style[prop]=zero;});
    requestAnimationFrame(function(){nodes.forEach(function(n){n.style[prop]='';});});
    // If no frame ever arrives, put the data back rather than leave an empty chart.
    setTimeout(function(){nodes.forEach(function(n){n.style[prop]='';});},1400);
  }

  function revealSummary(){
    var cards=[].slice.call(document.querySelectorAll('.kpi'));
    var jumps=[].slice.call(document.querySelectorAll('.jump'));
    cards.forEach(function(c,i){setTimeout(function(){c.classList.add('on');},reduce?0:i*160);});
    jumps.forEach(function(j,i){setTimeout(function(){j.classList.add('on');},reduce?0:cards.length*160+i*110);});
    rewind([].slice.call(document.querySelectorAll('.landing .ring-arc')),'opacity','0');
  }

  function growComposition(){
    rewind([].slice.call(document.querySelectorAll('#ranked .rank-bar')),'width','0');
    // The slice may already be narrowed when the stage is first opened, so the panels
    // have to be brought in line before they are ever seen.
    panels().forEach(applyVisibility);
  }

  function settle(){
    report.classList.remove('staging');
    bar.classList.add('on');
    bar.setAttribute('aria-hidden','false');
    if(ambient)ambient.style.opacity='.55';
    if(figure)setTimeout(function(){countUp(figure);},reduce?0:220);
    goToStage('summary',{keepScroll:true});
    window.addEventListener('scroll',trackReading,{passive:true});
  }

  // The dot leaves the network and lands in the middle of the ring, so the total the
  // investigation announced and the total the report holds are one movement.
  function travelIntoFigure(from,done){
    if(!from||!figure||!morph||!from.width){done();return;}

    var to=figure.getBoundingClientRect();
    if(!to.width){done();return;}

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
      // The rect is read while the line is still in place, and the line is put away in
      // the same frame the scene starts leaving: painting it after that repaints it
      // somewhere else, which reads as the total being announced a second time.
      var from=flash?flash.getBoundingClientRect():null;
      if(flash)flash.classList.remove('on');
      investigate.classList.add('collapse');
      travelIntoFigure(from,function(){
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

  function nextVisible(visible,total){
    if(visible<6)return Math.min(6,total);
    if(visible<10)return Math.min(10,total);
    return total;
  }

  function items(panel){return [].slice.call(panel.querySelectorAll('.item'));}

  // The year slice governs the whole stage, so "the items of this panel" always means the
  // ones inside the chosen years. Everything downstream — the count, the fold, the
  // "show more" arithmetic — reads from here, or the counter would promise rows that
  // the slice has already taken away.
  function inSlice(item){
    if(yearFrom===null)return true;
    var year=parseInt(item.getAttribute('data-year'),10);
    if(!year)return false;
    return year>=yearFrom&&year<=yearTo;
  }

  function items(panel){return [].slice.call(panel.querySelectorAll('.item')).filter(inSlice);}

  function allItems(panel){return [].slice.call(panel.querySelectorAll('.item'));}

  function applyVisibility(panel){
    var visible=parseInt(panel.getAttribute('data-visible'),10)||0;
    var list=items(panel);
    allItems(panel).forEach(function(item){item.hidden=true;});
    list.forEach(function(item,i){item.hidden=i>=visible;});

    var total=list.length;
    var count=panel.querySelector('.panel-count');
    if(count)count.textContent=String(total);
    var empty=panel.querySelector('.empty.sliced');
    if(empty)empty.hidden=total>0||parseInt(panel.getAttribute('data-total'),10)===0;

    var wrap=panel.querySelector('.more-wrap');
    if(!wrap)return;
    wrap.hidden=total<=visible;
    var button=wrap.querySelector('.more');
    if(!button||total<=visible)return;
    var step=nextVisible(visible,total)-visible;
    var left=total-nextVisible(visible,total);
    button.textContent=left===0?'Mostrar todo · '+step+' más':'Mostrar '+step+' más → quedan '+left;
  }

  function showMore(panel){
    var visible=parseInt(panel.getAttribute('data-visible'),10)||0;
    var list=items(panel);
    var next=nextVisible(visible,list.length);

    for(var i=visible;i<next;i++){
      if(!list[i])continue;
      list[i].hidden=false;
      if(!reduce){
        list[i].style.setProperty('--s',String(i-visible));
        list[i].classList.add('fresh');
      }
    }
    panel.setAttribute('data-visible',String(next));
    applyVisibility(panel);
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

  // One selection drives the whole stage: the ranked rows are the only source control,
  // and the timeline, the evidence list and the running count all read from it.
  function pickLane(id,allowToggle){
    var list=document.getElementById('ranked');
    if(!list)return;

    var currentRow=list.querySelector('.rank.picked');
    var same=allowToggle===true&&currentRow!==null&&currentRow.getAttribute('data-lane')===id;
    var lane=same?null:(id===''?null:id);
    var picked=null;

    [].slice.call(list.querySelectorAll('.rank')).forEach(function(row){
      var on=lane!==null&&row.getAttribute('data-lane')===lane;
      row.classList.toggle('picked',on);
      row.setAttribute('aria-pressed',on?'true':'false');
      if(on)picked=row;
    });
    list.classList.toggle('picking',picked!==null);

    var clear=document.getElementById('rank-clear');
    if(clear)clear.hidden=picked===null;

    focusTimeline(lane);
    filterEvidence(lane,picked);
  }

  function filterEvidence(lane,picked,quiet){
    var shown=0;
    panels().forEach(function(p){
      var id=p.getAttribute('data-panel');
      var on=lane===null||id===lane;
      p.hidden=!on;
      applyVisibility(p);
      if(on)shown+=items(p).length;
    });

    var wrap=document.querySelector('.panels');
    if(wrap&&!reduce&&quiet!==true){
      wrap.classList.add('swapping');
      setTimeout(function(){wrap.classList.remove('swapping');},180);
    }

    var out=document.getElementById('filter-result');
    if(!out)return;
    var word=shown===1?'resultado':'resultados';
    var parts=[];
    if(picked!==null)parts.push(picked.querySelector('.rank-name').textContent.trim());
    if(yearFrom!==null&&!wholeSlice())parts.push(yearFrom===yearTo?String(yearFrom):yearFrom+'–'+yearTo);
    parts.push(shown+' '+word);
    var label=parts.join(' · ');
    out.classList.add('blip');
    setTimeout(function(){out.textContent=label;out.classList.remove('blip');},reduce?0:120);
  }

  // The bars are a count of what is in view, so a slice has to move them too — otherwise
  // the chart states a quantity the list below no longer shows.
  function rerank(){
    var list=document.getElementById('ranked');
    if(!list)return;
    var rows=[].slice.call(list.querySelectorAll('.rank'));
    var counts=rows.map(function(row){
      var panel=document.querySelector('.panel[data-panel="'+row.getAttribute('data-lane')+'"]');
      return panel===null?0:items(panel).length;
    });
    var sum=counts.reduce(function(a,b){return a+b;},0);
    var largest=counts.reduce(function(a,b){return Math.max(a,b);},0);

    rows.forEach(function(row,i){
      row.querySelector('.rank-n').textContent=String(counts[i]);
      row.querySelector('.rank-share').textContent=(sum===0?0:Math.round(counts[i]/sum*100))+'%';
      var track=row.querySelector('.rank-track');
      var bar=track.querySelector('.rank-bar');
      if(counts[i]===0){if(bar)track.removeChild(bar);return;}
      if(!bar){bar=document.createElement('span');bar.className='rank-bar';track.appendChild(bar);}
      bar.style.setProperty('--w',(largest===0?0:Math.round(counts[i]/largest*100))+'%');
    });
  }

  // Source and year are two dimensions of the same view, so one function applies both.
  // Muting only ever hides emphasis, never a date: every dot keeps its true position.
  var laneFilter=null;
  var yearFrom=null;
  var yearTo=null;

  function focusTimeline(lane){
    laneFilter=lane;
    applyTimeline();
  }

  function sliceYears(){
    var slice=document.getElementById('tl-slice');
    if(!slice)return [];
    return (slice.getAttribute('data-years')||'').split(',').map(Number);
  }

  function wholeSlice(){
    var years=sliceYears();
    return years.length<2||(yearFrom===years[0]&&yearTo===years[years.length-1]);
  }

  // Two handles over the years that exist, so a drag can never land on an empty one.
  function readSlice(){
    var from=document.getElementById('tl-from');
    var to=document.getElementById('tl-to');
    var rails=document.querySelector('.tl-slice-rails');
    var years=sliceYears();
    if(!from||!to||!rails||years.length<2)return;

    var a=parseInt(from.value,10)||0;
    var b=parseInt(to.value,10)||0;
    if(a>b){var swap=a;a=b;b=swap;from.value=String(a);to.value=String(b);}

    yearFrom=years[a];
    yearTo=years[b];
    var last=years.length-1;
    from.setAttribute('aria-valuetext',String(yearFrom));
    to.setAttribute('aria-valuetext',String(yearTo));
    rails.style.setProperty('--a',(a/last*100)+'%');
    rails.style.setProperty('--b',(b/last*100)+'%');

    var typedFrom=document.getElementById('tl-year-from');
    var typedTo=document.getElementById('tl-year-to');
    if(typedFrom)typedFrom.value=String(yearFrom);
    if(typedTo)typedTo.value=String(yearTo);
    var all=document.getElementById('tl-slice-all');
    if(all)all.hidden=a===0&&b===last;
    applyTimeline();
    // The slice governs the stage, not just the chart: the bars and the evidence below
    // read from the same range, so the three never state different quantities.
    rerank();
    filterEvidence(laneFilter,document.querySelector('#ranked .rank.picked'),true);
  }

  // A typed year the corpus does not hold still has an unambiguous meaning: "from 2017"
  // is the first year on or after it, "to 2017" the last on or before. Snapping that way
  // keeps the reader's intent instead of refusing the entry.
  function typedSlice(){
    var years=sliceYears();
    var from=document.getElementById('tl-from');
    var to=document.getElementById('tl-to');
    var typedFrom=document.getElementById('tl-year-from');
    var typedTo=document.getElementById('tl-year-to');
    if(years.length<2||!from||!to||!typedFrom||!typedTo)return;

    var a=parseInt(typedFrom.value,10);
    var b=parseInt(typedTo.value,10);
    if(isNaN(a))a=years[0];
    if(isNaN(b))b=years[years.length-1];
    if(a>b){var swap=a;a=b;b=swap;}

    var i=0,j=years.length-1,k;
    for(k=0;k<years.length;k++){if(years[k]>=a){i=k;break;}if(k===years.length-1)i=k;}
    for(k=years.length-1;k>=0;k--){if(years[k]<=b){j=k;break;}if(k===0)j=0;}
    if(i>j)j=i;

    from.value=String(i);
    to.value=String(j);
    readSlice();
  }

  function resetSlice(){
    var from=document.getElementById('tl-from');
    var to=document.getElementById('tl-to');
    var years=sliceYears();
    if(!from||!to||years.length<2)return;
    from.value='0';
    to.value=String(years.length-1);
    readSlice();
  }

  function applyTimeline(){
    var tl=document.querySelector('.tl');
    if(!tl)return;
    tl.setAttribute('data-picked',laneFilter===null?'':laneFilter);

    var picked=null,lit=0;
    [].slice.call(tl.querySelectorAll('.tl-dot')).forEach(function(dot){
      var year=parseInt(dot.getAttribute('data-year'),10);
      var out=(laneFilter!==null&&dot.getAttribute('data-lane')!==laneFilter)||
              (yearFrom!==null&&(year<yearFrom||year>yearTo));
      dot.classList.toggle('muted',out);
      if(out)return;
      lit+=1;
      if(picked===null||dot.getAttribute('data-at')>picked.getAttribute('data-at'))picked=dot;
    });

    var count=document.getElementById('tl-slice-n');
    if(count)count.textContent=String(lit);

    var chosen=tl.querySelector('.tl-dot.picked');
    if(picked&&(chosen===null||chosen.classList.contains('muted')))pickDot(picked);
  }

  // A preview, not a record: one line that says where a click would land. It never
  // floats over the dots, and focus fills it too, so the keyboard gets the same answer.
  function peek(dot){
    var out=document.getElementById('tl-peek');
    if(!out)return;
    if(!dot){out.innerHTML=out.getAttribute('data-rest')||out.innerHTML;return;}
    if(!out.getAttribute('data-rest'))out.setAttribute('data-rest',out.innerHTML);

    var chip=document.createElement('span');
    chip.className='tl-peek-chip d'+(dot.className.match(/\\bd(\\d)\\b/)||['','0'])[1];
    chip.textContent=dot.getAttribute('data-short');
    var when=document.createElement('span');
    when.className='tl-peek-when';
    when.textContent=dot.getAttribute('data-when');
    var text=document.createElement('span');
    text.className='tl-peek-text';
    text.textContent=dot.getAttribute('data-detail');

    out.textContent='';
    out.appendChild(chip);
    out.appendChild(when);
    out.appendChild(text);
  }

  function pickDot(dot){
    if(!dot)return;
    [].slice.call(document.querySelectorAll('.tl-dot')).forEach(function(d){d.classList.toggle('picked',d===dot);});
  }

  // A dot has no record of its own to show: it points at the row that already holds one.
  // Folded rows are revealed the same way the reader would, so the counter stays true.
  function revealSignal(key){
    var item=document.querySelector('.item[data-key="'+key+'"]');
    if(!item)return;
    var panel=item.closest('.panel');
    if(!panel)return;

    openPanel(panel);
    var index=parseInt(item.getAttribute('data-i'),10)||0;
    var guard=0;
    while(index>=(parseInt(panel.getAttribute('data-visible'),10)||0)&&guard<12){showMore(panel);guard+=1;}

    [].slice.call(document.querySelectorAll('.item')).forEach(function(i){i.classList.toggle('picked',i===item);});
    if(!reduce){
      item.classList.remove('spotlight');
      void item.offsetWidth;
      item.classList.add('spotlight');
    }
    item.scrollIntoView({block:'center',behavior:reduce?'auto':'smooth'});
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

  document.addEventListener('input',function(e){
    if(!e.target||!e.target.classList||!e.target.classList.contains('tl-slice-in'))return;
    readSlice();
  });

  // change, not input: a number field fires per keystroke, so "2" would snap before the
  // reader has finished typing the year.
  document.addEventListener('change',function(e){
    if(!e.target||!e.target.classList||!e.target.classList.contains('tl-year-in'))return;
    typedSlice();
  });

  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter'||!e.target||!e.target.classList||!e.target.classList.contains('tl-year-in'))return;
    e.preventDefault();
    typedSlice();
  });

  ['mouseover','focusin'].forEach(function(type){
    document.addEventListener(type,function(e){
      if(!e.target||!e.target.closest)return;
      var dot=e.target.closest('.tl-dot');
      if(dot)peek(dot);
    });
  });

  ['mouseout','focusout'].forEach(function(type){
    document.addEventListener(type,function(e){
      if(!e.target||!e.target.closest)return;
      if(e.target.closest('.tl-dot'))peek(null);
    });
  });

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

    // The row is the link. Following it is the act worth marking.
    var pick=t.closest('.item-pick');
    if(pick){
      var row=pick.closest('.item');
      if(row&&pick.tagName==='A')row.classList.add('seen');
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

    var tlDot=t.closest('.tl-dot');
    if(tlDot){pickDot(tlDot);revealSignal(tlDot.getAttribute('data-key'));return;}

    var point=t.closest('.point');
    if(point){pickPoint(parseInt(point.getAttribute('data-point'),10)||0);return;}

    if(t.closest('#tl-slice-all')){resetSlice();return;}

    if(t.closest('.to-top')){
      window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});
      var tab=tabOf(current);
      if(tab)tab.focus();
      return;
    }

    if(t.closest('#rank-clear')){pickLane('');return;}

    var row=t.closest('.rank');
    if(row){pickLane(row.getAttribute('data-lane'),true);return;}
  });
})();
`;
}
