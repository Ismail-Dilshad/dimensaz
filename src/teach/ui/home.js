'use strict';
// Home: what the brain holds, what is waiting, and what happened lately.
App.register('home',{
 title:()=>'Home',
 head:()=>({title:'Your creative workspace.',text:'Your videos, the lessons behind them, and everything ready for your next move.'}),
 actions:()=>`<a class="btn primary" href="#/studio/new">${I.add} New video</a>`,
 load(){return api('/api/gallery').catch(()=>({items:[]}));},
 render(el){
  const h=App.home,b=h.brain.byStatus,total=Math.max(1,h.brain.total);
  const parts=[['proven','Proven','var(--good)'],['approved','Kept','var(--coral)'],['trial','On trial','var(--warn)'],['retired','Retired','var(--line)'],['rejected','Removed','var(--dim)']];
  el.innerHTML=`  ${h.you.length?`<div class="banner you"><b>Waiting for you:</b> ${h.you.map(j=>`<a href="#/studio/videos/${encodeURIComponent(j.job)}">${esc(j.title)}</a>`).join(', ')}</div>`:''}
  <div class="tiles">
   <a class="tile" href="#/teach/library"><div class="num">${h.teach.videos}</div><div class="muted">videos taught${h.teach.waiting?`, ${h.teach.waiting} waiting`:''}</div></a>
   <a class="tile" href="#/teach/lessons"><div class="num">${h.teach.lessons}</div><div class="muted">lessons from your videos</div></a>
   <a class="tile" href="#/teach/patterns"><div class="num">${h.teach.patterns}</div><div class="muted">patterns your examples share</div></a>
   <a class="tile" href="#/studio/videos"><div class="num">${h.studio.jobs}</div><div class="muted">videos made in the studio</div></a>
   <a class="tile" href="#/studio/scores"><div class="num">${h.scores.good}<span class="muted" style="font-size:1.1rem"> / ${h.scores.good+h.scores.bad}</span></div><div class="muted">steps you rated good</div></a>
  </div>
  ${(()=>{const made=(this.data?.items||[]).slice(0,4);return made.length?`<div class="card" style="margin-top:16px"><div class="teach-section-head"><h3>Latest from your studio</h3><a class="small" href="#/studio/gallery">Open the gallery</a></div>
   <div class="gallery-grid">${made.map(i=>`<a class="gallery-card" href="#/studio/gallery/${i.id}"><span class="gallery-thumb"><img loading="lazy" alt="" src="${withKey('/gallery/thumb/'+i.id)}"><span class="gallery-play">${I.play}</span></span><b dir="auto">${esc(i.title)}</b><span class="muted small">${i.kind==='final'?'Final':i.kind==='preview'?'Preview':'Export'}, ${ago(i.made)}</span></a>`).join('')}</div></div>`:'';})()}
  <div class="cols">
   <div class="card"><h2>The brain</h2><div class="muted small">${h.brain.total} things it knows: principles, techniques, your rules, your lessons.</div>
    <div class="statusbar" role="img" aria-label="${parts.map(([k,l])=>`${b[k]||0} ${l}`).join(', ')}">${parts.map(([k,,c])=>`<i style="width:${(b[k]||0)/total*100}%;background:${c}"></i>`).join('')}</div>
    <div class="legend">${parts.filter(([k])=>b[k]).map(([k,l,c])=>`<span><i style="background:${c}"></i>${l} ${b[k]}</span>`).join('')}</div>
    <p class="muted small" style="margin-bottom:0">New lessons start on trial. Two good results make one proven; one that keeps failing retires.</p>
    <div class="row" style="margin-top:14px"><a class="btn primary" href="#/teach/add">Teach a video</a><a class="btn" href="#/studio/new">Make a video</a></div></div>
   <div class="card"><h2>Lately</h2>${h.activity.length?`<ul class="feed">${h.activity.map(e=>`<li><time>${ago(e.at)}</time><span class="dot ${e.good===true?'g':e.good===false?'b':''}"></span><span dir="auto">${esc(e.text)}</span></li>`).join('')}</ul>`
    :'<p class="muted">Nothing yet. Teach a video or make one, and what happens shows up here.</p>'}</div>
  </div>`;
 }});
