'use strict';
// The Live studio: one job as a team at work. Every role is a mascot with the face of what it is
// doing now; the steps light up as they run; what the agents say and do streams in as it happens,
// whoever drives the job (the terminal agent today, the browser when a model is connected).
I.live=ICON('<circle cx="12" cy="12" r="2"/><path d="M16.200 7.800a6 6 0 0 1 0 8.400M7.800 16.200a6 6 0 0 1 0-8.400M19.100 4.900a10 10 0 0 1 0 14.200M4.900 19.100a10 10 0 0 1 0-14.200"/>');
const Live={es:null,esJob:null,lastSeq:0,sel:null,feedAtEnd:true,
 FACE_LABEL:{idle:'Waiting',listening:'Reading',thinking:'Thinking',planning:'Planning',creating:'Making',rendering:'Rendering',done:'Done',excited:'Happy',confused:'Unsure',error:'Stuck','needs-approval':'Needs you',sleeping:'Asleep'},
 STATUS:{todo:'to do',doing:'working',done:'done',redo:'to redo'},
 async load(){
  const list=await api('/api/studio/live');
  const job=App.arg||list.jobs[0]?.job;
  return {list:list.jobs,job:job||null,live:job?await api('/api/studio/live/'+encodeURIComponent(job)).catch(()=>null):null};
 },
 /** One stream per open job: each new event is added to the feed at once, and the page refreshes. */
 stream(job,after){
  if(this.esJob===job&&this.es)return;
  this.close();if(!job||typeof EventSource==='undefined')return;
  this.esJob=job;this.lastSeq=after;
  this.es=new EventSource(withKey(`/api/studio/live/${encodeURIComponent(job)}/stream?after=${after}`));
  let timer=null;
  this.es.onmessage=m=>{let e;try{e=JSON.parse(m.data);}catch{return;}if(e.seq<=this.lastSeq)return;this.lastSeq=e.seq;
   const feed=$('#live-feed');if(feed){const end=feed.scrollHeight-feed.scrollTop-feed.clientHeight<40;feed.insertAdjacentHTML('beforeend',feedRow(e,App.screens['studio/live'].data?.live));if(end)feed.scrollTop=feed.scrollHeight;$('#live-feed .feed-empty')?.remove();}
   clearTimeout(timer);timer=setTimeout(()=>App.refresh(false),250);};
 },
 close(){this.es?.close();this.es=null;this.esJob=null;}
};
window.addEventListener('hashchange',()=>{if(!location.hash.startsWith('#/studio/live'))Live.close();});

const roleHue=(L,id)=>id==='you'?'var(--coral)':`hsl(${Math.round(((L?.colors?.[id]??0)*360/15)+12)} 55% 55%)`;
const roleName=(L,id)=>id==='you'?'You':L?.team.find(m=>m.id===id)?.title||(id==='director'?'Director':id||'Studio');
const clock=iso=>new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});
const since=iso=>{if(!iso)return '';const s=(Date.now()-new Date(iso))/1000;return s<60?'just started':s<3600?Math.floor(s/60)+' min':Math.floor(s/3600)+' h '+Math.floor(s%3600/60)+' min';};
const mascot=(face,label,big)=>`<img class="mascot ${big?'big':''}" src="/mascot/${esc(face)}.svg" alt="${esc(label)}" width="${big?88:56}" height="${big?68:44}">`;
const EV_ICON={'job.planned':'lesson','step.started':'play','step.done':'star','step.rated':'heart','step.picked':'star','step.checked':'eye','step.held':'x','gate.approved':'heart',feedback:'lesson',verdict:'heart','agent.say':'live',tool:'pattern',asset:'gallery'};
function feedRow(e,L){
 return `<div class="feed-row" data-type="${esc(e.type)}"><span class="feed-dot" style="background:${roleHue(L,e.role)}"></span><span class="feed-time">${clock(e.at)}</span>
  <span class="feed-icon">${I[EV_ICON[e.type]]||I.live}</span><div class="feed-text"><b>${esc(roleName(L,e.role))}</b> <span dir="auto">${esc(e.text||e.type)}</span></div></div>`;
}

App.register('studio/live',{
 title:()=>'Live studio',sub:()=>'Watch the team work',load:()=>Live.load(),
 hold:()=>{const f=$('#live-feed');return !!f&&f.scrollHeight-f.scrollTop-f.clientHeight>40&&f.matches(':hover');},
 head:()=>{const d=App.screens['studio/live'].data,L=d?.live;if(!L)return null;
  return {title:L.title,text:`${L.mode==='edit'?'Footage edit':'Motion video'}, ${L.done} of ${L.of} steps. ${L.driver.label}.`};},
 actions:()=>{const d=App.screens['studio/live'].data,L=d?.live;if(!L)return '';
  return `${d.list.length>1?`<select aria-label="Job to watch" onchange="App.go('studio/live',this.value)">${d.list.map(j=>`<option value="${esc(j.job)}" ${j.job===L.job?'selected':''}>${esc(j.title.slice(0,48))}${j.active?' (working)':''}</option>`).join('')}</select>`:''}
   <a class="btn small ghost" href="#/studio/videos/${encodeURIComponent(L.job)}">Rate the steps</a>`;},
 render(el){
  const d=this.data,L=d.live;
  if(!L){Live.close();el.innerHTML=`<div class="empty"><h2>Nothing to watch yet</h2><p>Brief a video and the team shows up here: every agent, its face for what it is doing, and each step as it runs.</p><a class="btn primary" href="#/studio/new">New video</a></div>`;return;}
  if(App.arg!==L.job&&!App.arg)history.replaceState(null,'','#/studio/live/'+encodeURIComponent(L.job));
  const oldFeed=$('#live-feed'),keep=oldFeed?{top:oldFeed.scrollTop,end:oldFeed.scrollHeight-oldFeed.scrollTop-oldFeed.clientHeight<40}:{end:true};
  const steps=L.tasks;if(!Live.sel||!steps.some(t=>t.id===Live.sel))Live.sel=(steps.find(t=>t.status==='doing')||[...steps].reverse().find(t=>t.status==='done'&&!t.gate)||steps[0]).id;
  const stages=[...new Set(steps.filter(t=>!t.gate).map(t=>t.stage))].sort((a,b)=>a-b);
  const gateAfter=new Map();steps.forEach((t,i)=>{if(t.gate){const prev=[...steps.slice(0,i)].reverse().find(x=>!x.gate);if(prev)gateAfter.set(prev.stage,[...(gateAfter.get(prev.stage)||[]),t]);}});
  const chip=t=>t.gate?`<span class="stage-gate ${t.status}" title="${esc(t.title)}">${t.status==='approved'?I.heart:'!'}<span>${esc(t.status==='waiting'?'You: '+t.title.toLowerCase():t.title)}</span></span>`
   :`<button type="button" class="stage-step ${t.status}" aria-pressed="${Live.sel===t.id}" onclick="liveSelect('${t.id}')" style="--hue:${roleHue(L,L.team.find(m=>m.title===t.owner)?.id)}"><span class="dot"></span><span dir="auto">${esc(t.title)}</span></button>`;
  const sel=steps.find(t=>t.id===Live.sel);
  const shelf=steps.filter(t=>!t.gate).flatMap(t=>[...t.show.map(s=>({t,slot:'show-'+s.k,name:s.name,type:s.type})),...t.choices.filter(c=>c.type).map(c=>({t,slot:'choice-'+c.k,name:c.label,type:c.type}))]);
  const media=(t,slot,type,name)=>{const u=withKey(`/studio-file/job/${L.job}/${t.index}/${slot}`);return type==='image'?`<img src="${u}" alt="${esc(name)}" loading="lazy">`:type==='video'?`<video src="${u}" controls preload="metadata"></video>`:`<audio src="${u}" controls preload="none"></audio>`;};
  el.innerHTML=`<div class="live">
   <section class="card live-stage" aria-label="Steps"><div class="teach-section-head"><h3>Steps</h3><span class="muted small">${L.done} of ${L.of} done</span></div>
    <div class="stage-map">${stages.map(n=>`<div class="stage-col"><small>Stage ${n}</small>${steps.filter(t=>!t.gate&&t.stage===n).map(chip).join('')}${(gateAfter.get(n)||[]).map(chip).join('')}</div>`).join('')}</div></section>
   <div class="live-grid">
    <section class="live-team" aria-label="The team">
     ${L.you?`<div class="member you" style="--hue:var(--coral)">${mascot('needs-approval','Needs you',true)}<div><b>You</b><small class="member-face">Needs you</small>
       <p dir="auto">${esc([...L.you.picks.map(p=>`Pick a version of ${p.step}`),...L.you.gates.map(g=>g.title)].join('; '))}</p><a class="btn small primary" href="#/studio/videos/${encodeURIComponent(L.job)}">Open and decide</a></div></div>`:''}
     ${L.team.map(m=>`<div class="member ${m.step?'busy':['done','idle','sleeping'].includes(m.face)?'quiet':''} face-${esc(m.face)}" style="--hue:${roleHue(L,m.id)}">${mascot(m.face,Live.FACE_LABEL[m.face]||m.face,!!m.step)}
       <div><b>${esc(m.title)}</b><small class="member-face">${esc(Live.FACE_LABEL[m.face]||m.face)}${m.since?', '+since(m.since):''}</small><p dir="auto">${esc(m.state)}</p></div></div>`).join('')}
    </section>
    <section class="card live-feed-card" aria-label="What is happening"><div class="teach-section-head"><h3>What is happening</h3><span class="muted small">${L.asleep?'Quiet for a day':L.driver.state==='working'?'<span class="live-pulse"></span> live':'updates as it happens'}</span></div>
     <div class="live-feed" id="live-feed" role="log" aria-live="polite">${L.events.length?L.events.map(e=>feedRow(e,L)).join(''):`<p class="muted small feed-empty">Nothing yet. When the agent starts a step it shows here.</p>`}</div>
     ${L.driver.state==='agent'?`<div class="say live-say"><span>Tell your agent: “${esc(L.continueWith)}”</span><button class="iconbtn" aria-label="Copy" onclick="copyText('${esc(L.continueWith)}')">${I.copy}</button></div>`:''}</section>
    <section class="card live-inspect" aria-label="The selected step">${sel?`<div class="teach-section-head"><h3 dir="auto">${esc(sel.title)}</h3><span class="badge ${sel.status==='done'?'good':sel.status==='doing'?'wait':'st'}">${esc(Live.STATUS[sel.status]||sel.status)}</span></div>
     <p class="muted small">${esc(sel.owner)}${sel.round>1?`, round ${sel.round}`:''}${sel.lessons.length?`, used ${sel.lessons.length} lesson${sel.lessons.length>1?'s':''}`:''}${sel.rating?`, you rated it ${sel.rating.rating==='ok'?'not bad':sel.rating.rating}`:''}</p>
     ${sel.note?`<p class="small" dir="auto">${esc(sel.note)}</p>`:''}
     ${sel.show.length||sel.choices.length?`<div class="live-media">${sel.show.map(s=>media(sel,'show-'+s.k,s.type,s.name)).join('')}${sel.choices.filter(c=>c.type).map(c=>`<figure>${media(sel,'choice-'+c.k,c.type,c.label)}<figcaption>${esc(c.label)}${sel.picked===c.label?' (picked)':''}</figcaption></figure>`).join('')}</div>`:''}
     ${sel.output?`<div class="out" dir="auto">${esc(sel.output)}</div>`:`<p class="muted small">${sel.status==='done'?'This step made no text to show.':'Its work shows here when it is finished.'}</p>`}
     ${sel.canRate?`<a class="btn small primary" style="margin-top:12px" href="#/studio/videos/${encodeURIComponent(L.job)}">Rate this step</a>`:''}`:''}</section>
   </div>
   ${shelf.length?`<section class="card"><div class="teach-section-head"><h3>Made in this job</h3><span class="muted small">${shelf.length} file${shelf.length>1?'s':''}</span></div>
    <div class="shelf">${shelf.map(s=>`<figure>${media(s.t,s.slot,s.type,s.name)}<figcaption><span dir="auto">${esc(s.name)}</span><small>by ${esc(s.t.owner)}</small></figcaption></figure>`).join('')}</div></section>`:''}
  </div>`;
  const feed=$('#live-feed');if(feed)feed.scrollTop=keep.end?feed.scrollHeight:keep.top;
  Live.stream(L.job,L.lastSeq);
 }
});
window.liveSelect=id=>{Live.sel=id;App.show(false);};
