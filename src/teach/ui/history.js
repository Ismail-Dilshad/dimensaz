'use strict';
// History: every change to what the studio learned, your taste and your ratings, newest first,
// each with Undo. An undo is a change too, so it shows here and can be undone (a redo).
I.history=ICON('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v4h4"/><path d="M12 7v5l3 2"/>');
const HI={kind:store.get('history-kind',''),busy:null};
const KIND_LABEL={lessons:'Lessons',taste:'Taste',ratings:'Ratings'};
const STORE_LABEL={lesson:'lesson',rule:'rule',taught:'taught video',profile:'taste profile',plan:'video',gallery:'gallery',brainjob:'record'};
App.register('history',{
 title:()=>'History',sub:()=>'Every change, with Undo',hold:()=>!!HI.busy,
 load:()=>api('/api/history'+(HI.kind?'?kind='+HI.kind:'')),
 head:()=>({title:'History',text:'Every change to what the studio learned, your taste profiles and your ratings. Undo puts what a change touched back the way it was; anything changed again later keeps its newer value.'}),
 render(el){
  const d=this.data,all=Object.values(d.counts).reduce((a,b)=>a+b,0);
  const day=iso=>new Date(iso).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  let last='';
  const rows=d.entries.map(e=>{const h=day(e.at)!==last?`<h3 class="hist-day">${esc(day(e.at))}</h3>`:'';last=day(e.at);
   return h+`<article class="hist ${e.undone?'undone':''}" data-kind="${esc(e.kind)}">
    <div class="hist-main"><div class="row hist-top"><span class="badge st">${esc(KIND_LABEL[e.kind]||e.kind)}</span><span class="muted small">${new Date(e.at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</span>${e.job?`<a class="muted small" href="#/studio/videos/${encodeURIComponent(e.job)}">open the video</a>`:''}</div>
     <b class="hist-title" dir="auto">${esc(e.title)}</b>
     <ul class="hist-items">${e.items.slice(0,6).map(it=>`<li><span class="muted small">${esc(STORE_LABEL[it.store]||it.store)}</span> <span dir="auto">${esc(it.label)}</span>: ${esc(it.what.join(', '))}</li>`).join('')}${e.items.length>6?`<li class="muted small">and ${e.items.length-6} more</li>`:''}</ul>
     ${e.kept.length?`<details class="hist-kept"><summary class="muted small">Some fields kept a later value</summary><ul>${e.kept.map(k=>`<li class="small" dir="auto">${esc(k)}</li>`).join('')}</ul></details>`:''}</div>
    <div class="hist-act">${e.undone?'<span class="badge wait">Undone</span>':`<button class="btn small" ${HI.busy?'disabled':''} onclick="histUndo('${esc(e.id)}')">${HI.busy===e.id?'<span class="spin"></span> ':''}${e.undoes?'Undo (redo)':'Undo'}</button>`}</div></article>`;}).join('');
  el.innerHTML=`<div class="focus-chips hist-filter" role="group" aria-label="Show">${[['','Everything',all],...Object.entries(KIND_LABEL).map(([k,l])=>[k,l,d.counts[k]])].map(([k,l,n])=>`<button aria-pressed="${HI.kind===k}" onclick="histKind('${k}')">${esc(l)} <span class="muted">${n}</span></button>`).join('')}</div>
   ${d.entries.length?`<section class="hist-list">${rows}</section><p class="muted small" style="margin-top:14px">The newest ${d.kept} changes are kept. A taught video's file is gone once it is forgotten; Undo brings back its lessons and measurements.</p>`
    :`<div class="card" style="margin-top:14px"><p class="muted" style="margin:0">${HI.kind?'No changes of this kind yet.':'No changes yet. Rate a step, keep a lesson or edit your taste, and it shows here with Undo.'}</p></div>`}`;
 }});
window.histKind=k=>{HI.kind=k;store.set('history-kind',k);App.refresh(true);};
window.histUndo=async id=>{if(HI.busy)return;HI.busy=id;App.show(false);
 try{const r=await api(`/api/history/${id}/undo`,{method:'POST',body:'{}'});toast(r.note);}catch(e){toast(e.message,true);}
 HI.busy=null;await App.refresh(true);};
