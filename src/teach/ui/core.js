'use strict';
// The app's shell: sections, the agent's status, messages, dialogs, the theme, and one poll that
// keeps every screen fresh without re-drawing under the user's hands.
const KEY=new URLSearchParams(location.search).get('k')||'';
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const withKey=u=>u+(u.includes('?')?'&':'?')+'k='+KEY;
async function api(path,opt={}){
 const r=await fetch(path,{...opt,headers:{'x-teach-key':KEY,...(opt.body?{'content-type':'application/json'}:{}),...(opt.headers||{})}});
 const j=await r.json().catch(()=>({error:'The server did not answer'}));
 if(!r.ok)throw new Error(j.error||'Something went wrong');return j;
}
const fmtT=t=>{t=Math.max(0,t||0);const m=Math.floor(t/60),s=t-m*60;return m+':'+s.toFixed(2).padStart(5,'0');};
const fmtS=t=>{t=Math.max(0,t||0);const m=Math.floor(t/60),s=Math.floor(t-m*60);return m+':'+String(s).padStart(2,'0');};
const mb=b=>b>1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
const ago=iso=>{const s=(Date.now()-new Date(iso).getTime())/1000;return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':s<604800?Math.floor(s/86400)+' d ago':new Date(iso).toLocaleDateString();};
const store={get(k,d){try{const v=localStorage.getItem('tl-'+k);return v===null?d:JSON.parse(v);}catch{return d;}},set(k,v){try{localStorage.setItem('tl-'+k,JSON.stringify(v));}catch{/* private window */}}};
const ICON=(d,o='')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${o}>${d}</svg>`;
const I={home:ICON('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),add:ICON('<path d="M12 5v14M5 12h14"/>'),lib:ICON('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/>'),
 lesson:ICON('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.800 1-2.500A6 6 0 0 0 12 3z"/>'),pattern:ICON('<path d="M3 17l5-6 4 4 4-7 5 9"/>'),
 film:ICON('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4"/>'),chart:ICON('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
 sun:ICON('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M2 12h2M20 12h2M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400"/>'),moon:ICON('<path d="M21 12.800A9 9 0 1 1 11.200 3a7 7 0 0 0 9.800 9.800z"/>'),
 menu:ICON('<path d="M4 6h16M4 12h16M4 18h16"/>'),copy:ICON('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),search:ICON('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.300-4.300"/>'),
 x:ICON('<path d="M6 6l12 12M18 6L6 18"/>'),down:ICON('<path d="M12 4v12M6 11l6 6 6-6M4 21h16"/>')};

function toast(msg,bad){const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.innerHTML=`<span>${esc(msg)}</span><button class="iconbtn" aria-label="Close">${I.x}</button>`;
 t.querySelector('button').onclick=()=>t.remove();$('#toasts').append(t);setTimeout(()=>t.remove(),bad?9000:3500);}
/** Runs an action, says what went wrong, and refreshes. `done` is the message when it worked. */
async function act(fn,done){try{await fn();if(done)toast(done);}catch(e){toast(e.message,true);}await App.refresh(true);}
/** A question with two answers; resolves true for yes. */
function ask(title,text,yes='Yes',danger=false){return new Promise(res=>{
 dialog(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" data-no>Cancel</button><button class="btn ${danger?'':'primary'}" data-yes style="${danger?'background:var(--bad);border-color:var(--bad);color:var(--on-bad)':''}">${esc(yes)}</button></div>`,{onclose:()=>res(false)});
 $('#modal [data-yes]').onclick=()=>{closeDialog(true);res(true);};$('#modal [data-no]').onclick=()=>closeDialog();$('#modal [data-yes]').focus();});}
let dialogClose=null,lastFocus=null;
function dialog(html,o={}){lastFocus=document.activeElement;dialogClose=o.onclose||null;
 $('#modal').innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="dialog ${o.wide?'wide':''}">${html}</div></div>`;
 $('#modal .modal').onmousedown=e=>{if(e.target.classList.contains('modal'))closeDialog();};}
function closeDialog(silent){const f=dialogClose;dialogClose=null;$('#modal').innerHTML='';if(!silent&&f)f();lastFocus?.focus?.();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modal').innerHTML)closeDialog();});
async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Copied');}catch{toast('Copy it by hand: '+t,true);}}
function download(name,text,type='text/markdown'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}

const App={
 home:null,route:'home',arg:null,screens:{},
 /** Sections: [route, label, icon, group, count from home]. */
 nav:[['home','Home','home',''],
  ['teach/add','Teach a video','add','Teach'],['teach/library','Library','lib','Teach',h=>[h.teach.videos+h.teach.waiting,h.teach.waiting]],['teach/lessons','Lessons','lesson','Teach',h=>[h.teach.lessons,0]],['teach/patterns','Patterns','pattern','Teach',h=>[h.teach.patterns,0]],
  ['studio/new','New video','add','Studio'],['studio/videos','Videos','film','Studio',h=>[h.studio.jobs,h.studio.waitingForYou]],['studio/scores','Scores','chart','Studio',h=>[h.scores.good+h.scores.bad,0]]],
 register(route,screen){this.screens[route]=screen;},
 go(route,arg){location.hash='#/'+route+(arg?'/'+encodeURIComponent(arg):'');},
 parse(){const h=location.hash.replace(/^#\/?/,''),known=Object.keys(this.screens).sort((a,b)=>b.length-a.length).find(r=>h===r||h.startsWith(r+'/'));
  if(!known){this.route=location.pathname==='/studio'?'studio/new':'home';this.arg=null;return;}
  this.route=known;this.arg=h.length>known.length?decodeURIComponent(h.slice(known.length+1)):null;},
 async start(){
  $('#menu').innerHTML=I.menu;$('#menu').onclick=()=>$('#app').classList.toggle('open');$('#scrim').onclick=()=>$('#app').classList.remove('open');
  window.addEventListener('hashchange',()=>{this.parse();$('#app').classList.remove('open');this.changed=true;const s=this.screens[this.route];if(!s.load||s.data)this.show();this.refresh(!!s.load&&!s.data);window.scrollTo(0,0);$('#view').focus({preventScroll:true});});
  this.parse();await this.refresh(true);
  setInterval(()=>{if(!document.hidden)this.refresh(false);},2500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.refresh(false);});
 },
 /** Loads the home summary and the current screen's data; re-draws only when something changed and the user is not typing or watching. */
 async refresh(force){
  const s=this.screens[this.route];
  try{
   const [h,d]=await Promise.all([api('/api/home'),s.load?s.load():null]);
   const changed=JSON.stringify(h)!==JSON.stringify(this.home)||(s.load&&JSON.stringify(d)!==JSON.stringify(s.data));
   this.home=h;if(s.load)s.data=d;this.offline=false;
   const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''),playing=[...document.querySelectorAll('video,audio')].some(m=>!m.paused),busy=$('#modal').innerHTML;
   this.side();
   if(force||(changed&&!typing&&!playing&&!busy&&!(s.hold&&s.hold())))this.show(false);
  }catch(e){if(!this.offline){this.offline=true;toast(e.message==='Failed to fetch'?'The page lost the server. Is the terminal still open? Start it again with: pnpm tempoloom studio open':e.message,true);}}
 },
 show(routeChanged){
  const s=this.screens[this.route];if(!s||!this.home)return;
  if(s.load&&!s.data)return;
  routeChanged=routeChanged||this.changed;this.changed=false;
  const y=window.scrollY;
  $('#title').innerHTML=esc(s.title(this.arg))+(s.sub?`<span class="sub">${esc(s.sub(this.arg)||'')}</span>`:'');
  $('#actions').innerHTML=s.actions?s.actions(this.arg):'';
  document.title=(this.home.you.length?`(${this.home.you.length}) `:'')+s.title(this.arg)+' · Tempoloom';
  this.side();s.render($('#view'),this.arg,routeChanged);
  if(!routeChanged)window.scrollTo(0,y);
 },
 side(){
  const h=this.home;if(!h)return;let grp='';
  const links=this.nav.map(([r,l,ic,g,count])=>{const c=count?count(h):null,head=g&&g!==grp?`<div class="grp">${g}</div>`:'';grp=g||grp;
   return head+`<a class="navlink" href="#/${r}" ${this.route===r?'aria-current="page"':''}>${I[ic]}<span>${l}</span>${c&&(c[0]||c[1])?`<span class="n ${c[1]?'hot':''}" title="${c[1]?c[1]+' waiting':''}">${c[1]||c[0]}</span>`:''}</a>`;}).join('');
  const a=h.agent,light=document.documentElement.dataset.theme==='light';
  $('#side').innerHTML=`<a class="logo" href="#/home"><img src="/logo${light?'-light':''}.svg" alt="Tempoloom"></a>${links}<div class="grow"></div>
   <div class="agent ${a.length?'busy':''}">${a.length?`<b>Your agent has work</b>${a.map(x=>`<div class="muted" style="margin-top:6px">${esc(x.why)}. Tell it:</div><div class="say"><span>“${esc(x.say)}”</span><button class="iconbtn" title="Copy the command" aria-label="Copy the command ${esc(x.command)}" onclick="copyText('${esc(x.command)}')">${I.copy}</button></div>`).join('')}`
    :`<b>Your agent is up to date</b><div class="muted">Nothing is waiting for it.</div>`}</div>
   <button class="navlink" onclick="App.theme()">${light?I.moon:I.sun}<span>${light?'Dark':'Light'} theme</span></button>`;
 },
 theme(){const t=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=t;store.set('theme',t);try{localStorage.setItem('tl-theme',t);}catch{/* private window */}this.side();},
};
