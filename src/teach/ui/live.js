'use strict';
// Live parts of a video's page: the team with the mascot's face for what each role is doing, and
// what happens as it happens (one event stream per open job). The video's page (Videos) shows
// them above its steps; the old Live studio address opens that page.
I.live=ICON('<circle cx="12" cy="12" r="2"/><path d="M16.200 7.800a6 6 0 0 1 0 8.400M7.800 16.200a6 6 0 0 1 0-8.400M19.100 4.900a10 10 0 0 1 0 14.200M4.900 19.100a10 10 0 0 1 0-14.200"/>');
const Live={es:null,esJob:null,lastSeq:0,showAll:false,
 /** One stream per open job: each new event is added to the feed at once, and the page refreshes. */
 stream(job,after){
  if(this.esJob===job&&this.es)return;
  this.close();if(!job||typeof EventSource==='undefined')return;
  this.esJob=job;this.lastSeq=after;
  this.es=new EventSource(withKey(`/api/studio/live/${encodeURIComponent(job)}/stream?after=${after}`));
  let timer=null;
  this.es.onmessage=m=>{let e;try{e=JSON.parse(m.data);}catch{return;}if(e.seq<=this.lastSeq)return;this.lastSeq=e.seq;
   const feed=$('#live-feed');if(feed){const end=feed.scrollHeight-feed.scrollTop-feed.clientHeight<40;feed.insertAdjacentHTML('beforeend',feedRow(e,Studio.S?.live));if(end)feed.scrollTop=feed.scrollHeight;$('#live-feed .feed-empty')?.remove();}
   clearTimeout(timer);timer=setTimeout(()=>App.refresh(false),250);};
 },
 close(){this.es?.close();this.es=null;this.esJob=null;}
};
window.addEventListener('hashchange',()=>{if(!location.hash.startsWith('#/studio/videos/'))Live.close();});

const roleHue=(L,id)=>id==='you'?'var(--coral)':`hsl(${Math.round(((L?.colors?.[id]??0)*360/15)+12)} 55% 55%)`;
const roleName=(L,id)=>id==='you'?'You':L?.team.find(m=>m.id===id)?.title||(id==='director'?'Director':id||'Studio');
const clock=iso=>new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});
const since=iso=>{if(!iso)return '';const s=(Date.now()-new Date(iso))/1000;return s<60?'just started':s<3600?Math.floor(s/60)+' min':Math.floor(s/3600)+' h '+Math.floor(s%3600/60)+' min';};
const mascot=(face,label,size=56)=>`<img class="mascot" src="/mascot/${esc(face)}.svg" alt="${esc(label)}" width="${size}" height="${Math.round(size*.78)}" style="width:${size}px">`;
const EV_ICON={'job.planned':'lesson','step.started':'play','step.done':'star','step.rated':'heart','step.picked':'star','step.checked':'eye','step.held':'x','gate.approved':'heart',feedback:'lesson',verdict:'heart','agent.say':'live',tool:'pattern',asset:'gallery'};
function feedRow(e,L){
 const jump=e.task?` onclick="jumpStep('${esc(e.task)}')" role="button" tabindex="0"`:'';
 return `<div class="feed-row" data-type="${esc(e.type)}"${jump}><span class="feed-dot" style="background:${roleHue(L,e.role)}"></span><span class="feed-time">${clock(e.at)}</span>
  <span class="feed-icon">${I[EV_ICON[e.type]]||I.live}</span><div class="feed-text"><b>${esc(roleName(L,e.role))}</b> <span dir="auto">${esc(e.text||e.type)}</span></div></div>`;
}
/** The team and the feed, for the top of a video's page. */
function liveHtml(L){
 if(!L)return '';
 const busy=L.team.filter(m=>m.step),rest=L.team.filter(m=>!m.step);
 const member=m=>`<div class="member ${m.step?'busy':'quiet'} face-${esc(m.face)}" style="--hue:${roleHue(L,m.id)}"${m.step?` onclick="jumpStep('${esc(m.step)}')" role="button" tabindex="0"`:''}>${mascot(m.face,FACE_LABEL[m.face]||m.face,m.step?64:40)}
   <div><b>${esc(m.title)}</b><small class="member-face">${esc(FACE_LABEL[m.face]||m.face)}${m.since?', '+since(m.since):''}</small><p dir="auto">${esc(m.state)}</p></div></div>`;
 const shown=Live.showAll?rest:rest.slice(0,busy.length?3:6);
 return `<section class="card live-card" aria-label="The team at work"><div class="teach-section-head"><h3>The team</h3><span class="muted small">${L.asleep?'Quiet for a day':esc(L.driver.label)}</span></div>
  <div class="live-split"><div class="live-team">${L.you?`<div class="member you busy" style="--hue:var(--coral)">${mascot('needs-approval','Needs you',64)}<div><b>You</b><small class="member-face">Needs you</small><p dir="auto">${esc([...L.you.picks.map(p=>`Pick a version of ${p.step}`),...L.you.gates.map(g=>g.title)].join('; '))}</p></div></div>`:''}
   ${busy.map(member).join('')}${shown.map(member).join('')}
   ${rest.length>shown.length||Live.showAll?`<button class="btn small ghost" onclick="Live.showAll=!Live.showAll;App.show(false)">${Live.showAll?'Fewer':`All ${L.team.length} roles`}</button>`:''}</div>
  <div class="live-feed-wrap"><div class="row" style="justify-content:space-between"><b class="small">What is happening</b><span class="muted small">${L.driver.state==='working'?'<span class="live-pulse"></span> live':'updates as it happens'}</span></div>
   <div class="live-feed" id="live-feed" role="log" aria-live="polite">${L.events.length?L.events.map(e=>feedRow(e,L)).join(''):`<p class="muted small feed-empty">Nothing yet. When the agent starts a step it shows here.</p>`}</div></div></div></section>`;
}
// The Live studio's old address opens the video's page, where everything now lives.
App.register('studio/live',{title:()=>'Videos',load:()=>api('/api/studio/live'),render(el,arg){const job=arg||this.data.jobs[0]?.job;location.replace('#/studio/videos'+(job?'/'+encodeURIComponent(job):''));el.innerHTML='';}});
