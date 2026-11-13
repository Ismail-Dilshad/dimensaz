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
 heart:ICON('<path d="M12 20s-7-4.500-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.500-9 9-9 9z"/>'),eye:ICON('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
 x:ICON('<path d="M6 6l12 12M18 6L6 18"/>'),down:ICON('<path d="M12 4v12M6 11l6 6 6-6M4 21h16"/>')};

const toastStackMotion=new WeakMap();
function arrangeToasts(change){
 const items=[...$('#toasts').children],positions=new Map(items.map(el=>[el,el.getBoundingClientRect().top]));
 items.forEach(el=>toastStackMotion.get(el)?.cancel());
 change();
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 for(const el of items){
  if(!el.isConnected)continue;
  const distance=positions.get(el)-el.getBoundingClientRect().top;
  if(Math.abs(distance)<1)continue;
  const animation=el.animate([{translate:`0 ${distance}px`},{translate:'0 0'}],{duration:360,easing:'cubic-bezier(.22,1,.36,1)'});
  toastStackMotion.set(el,animation);
 }
}
function toast(msg,bad){
 const t=document.createElement('div');t.className='toast'+(bad?' bad':'');
 const symbol=bad?'<path d="M12 7v6M12 17h.01"/>':'<path d="m7 12 3 3 7-7"/>';
 t.innerHTML=`<div class="toast-heading"><div class="toast-symbol">${ICON(symbol)}</div><strong>${bad?'Something went wrong':'Done'}</strong><button class="iconbtn" aria-label="Dismiss notification">${I.x}</button></div><div class="toast-reveal"><div><p dir="auto">${esc(msg)}</p></div></div>`;
 let closing=false,timer=null,remaining=bad?9000:3500,started=0,hovered=false,focused=false;
 const resume=()=>{
  if(closing||hovered||focused||timer!==null)return;
  started=performance.now();timer=setTimeout(dismiss,remaining);
 };
 const pause=()=>{
  if(timer===null)return;
  clearTimeout(timer);timer=null;
  remaining=Math.max(0,remaining-(performance.now()-started));
 };
 const dismiss=()=>{
  if(closing)return;
  closing=true;clearTimeout(timer);
  const remove=()=>{if(t.isConnected)arrangeToasts(()=>t.remove());};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){remove();return;}
  t.style.setProperty('--toast-exit-width',t.getBoundingClientRect().width+'px');
  t.classList.add('leaving');
  t.addEventListener('animationend',e=>{if(e.target===t&&e.animationName==='toast-collapse')remove();});
  setTimeout(remove,850);
 };
 t.querySelector('button').onclick=dismiss;
 t.onpointerenter=e=>{if(e.pointerType==='touch')return;hovered=true;pause();};
 t.onpointerleave=()=>{hovered=false;resume();};
 t.onfocusin=()=>{focused=true;pause();};
 t.onfocusout=e=>{if(t.contains(e.relatedTarget))return;focused=false;resume();};
 arrangeToasts(()=>$('#toasts').append(t));
 resume();
}
/** Runs an action, says what went wrong, and refreshes. `done` is the message when it worked. */
async function act(fn,done){try{await fn();if(done)toast(done);}catch(e){toast(e.message,true);}await App.refresh(true);}
/** A question with two answers; resolves true for yes. */
function ask(title,text,yes='Yes',danger=false){return new Promise(res=>{
 dialog(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" data-no>Cancel</button><button class="btn ${danger?'':'primary'}" data-yes style="${danger?'background:var(--bad);border-color:var(--bad);color:var(--on-bad)':''}">${esc(yes)}</button></div>`,{onclose:()=>res(false)});
 $('#modal [data-yes]').onclick=()=>{closeDialog(true);res(true);};$('#modal [data-no]').onclick=()=>closeDialog();$('#modal [data-'+(danger?'no':'yes')+']').focus();});}
let dialogClose=null,lastFocus=null;
function dialog(html,o={}){lastFocus=document.activeElement;dialogClose=o.onclose||null;
 $('#modal').innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="dialog ${o.wide?'wide':''}">${html}</div></div>`;
 const surface=$('#modal .modal'),heading=$('h2',surface);
 if(heading){heading.id='dialog-title';surface.setAttribute('aria-labelledby',heading.id);}
 surface.onkeydown=e=>{
  if(e.key!=='Tab')return;
  const controls=[...surface.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),video[controls],a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 };
 surface.querySelector('input:not(:disabled),textarea,button')?.focus();
 $('#modal .modal').onmousedown=e=>{if(e.target.classList.contains('modal'))closeDialog();};}
function closeDialog(silent){const f=dialogClose;dialogClose=null;$('#modal').innerHTML='';if(!silent&&f)f();lastFocus?.focus?.();}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modal').innerHTML)closeDialog();});
async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Copied');}catch{toast('Copy it by hand: '+t,true);}}
function download(name,text,type='text/markdown'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}

// Progressive custom select: the original select remains the form's source of truth.
const Controls={
 open:null,serial:0,
 mount(root=document){
  root.querySelectorAll('select:not([multiple])').forEach(select=>{
   if(select.dataset.enhanced)return;
   select.dataset.enhanced='true';select.hidden=true;
   const wrap=document.createElement('div');wrap.className='select-control';
   select.before(wrap);wrap.append(select);
   const trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';
   trigger.id='select-control-'+(++this.serial);trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
   const labels=[...select.labels];labels.forEach(label=>label.htmlFor=trigger.id);
   const label=select.getAttribute('aria-label')||labels.map(l=>l.textContent.trim()).join(' ')||'Choose an option';
   const sync=()=>{trigger.innerHTML=`<span>${esc(select.selectedOptions[0]?.textContent||'Choose an option')}</span>${ICON('<path d="m7 10 5 5 5-5"/>')}`;trigger.disabled=select.disabled;trigger.setAttribute('aria-label',label+': '+(select.selectedOptions[0]?.textContent||''));};
   wrap.append(trigger);sync();select.addEventListener('change',sync);
   trigger.onclick=()=>this.open?.trigger===trigger?this.close():this.show(select,trigger);
   trigger.onkeydown=e=>{
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(this.open?.trigger!==trigger)this.show(select,trigger);else this.move(e.key);}
   };
  });
 },
 close(focus=false){
  const o=this.open;if(!o)return;this.open=null;
  o.trigger.setAttribute('aria-expanded','false');o.trigger.removeAttribute('aria-controls');o.trigger.removeAttribute('aria-activedescendant');
  o.menu.setAttribute('aria-hidden','true');o.menu.inert=true;o.menu.style.pointerEvents='none';
  o.menu.removeAttribute('id');o.menu.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)o.menu.remove();
  else{
   const style=getComputedStyle(o.menu),from={opacity:style.opacity,transform:style.transform};
   o.animation?.cancel();
   const animation=o.menu.animate([from,{opacity:0,transform:'translateY('+o.direction*5+'px) scale(.98)'}],{duration:160,easing:'ease-in',fill:'forwards'});
   animation.finished.then(()=>o.menu.remove(),()=>o.menu.remove());
   setTimeout(()=>o.menu.remove(),220);
  }
  if(focus&&o.trigger.isConnected)o.trigger.focus();
 },
 show(select,trigger){
  this.close();if(select.disabled)return;
  const options=[...select.options],enabled=options.map((o,i)=>!o.disabled&&!o.parentElement.disabled?i:-1).filter(i=>i>=0);
  if(!enabled.length)return;
  const menu=document.createElement('div');menu.className='select-menu';menu.id=trigger.id+'-list';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',trigger.getAttribute('aria-label'));
  menu.innerHTML=options.map((o,i)=>`<div id="${menu.id}-${i}" class="select-option" role="option" aria-label="${esc(o.textContent)}" aria-selected="${o.selected}" aria-disabled="${!enabled.includes(i)}" data-index="${i}">${esc(o.textContent)}</div>`).join('');
  document.body.append(menu);const r=trigger.getBoundingClientRect();const height=Math.min(280,menu.scrollHeight,innerHeight-24),below=innerHeight-r.bottom-8;
  menu.style.width=Math.min(Math.max(r.width,180),innerWidth-16)+'px';menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';
  menu.style.maxHeight=height+'px';menu.style.top=(below>=height?r.bottom+5:Math.max(8,r.top-height-5))+'px';
  this.open={select,trigger,menu,options,enabled,direction:below>=height?-1:1,animation:null,index:enabled.includes(select.selectedIndex)?select.selectedIndex:enabled[0],query:'',typed:0};
  trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',menu.id);this.highlight();
  menu.style.transformOrigin=below>=height?'top center':'bottom center';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
   this.open.animation=menu.animate([{opacity:0,transform:'translateY('+this.open.direction*6+'px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  menu.onmousedown=e=>e.preventDefault();
  menu.onclick=e=>{const row=e.target.closest('[data-index]');if(row)this.choose(Number(row.dataset.index));};
 },
 highlight(){const o=this.open;if(!o)return;o.menu.querySelectorAll('[data-index]').forEach(row=>row.classList.toggle('active',Number(row.dataset.index)===o.index));const active=document.getElementById(o.menu.id+'-'+o.index);o.trigger.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});},
 move(key){const o=this.open;if(!o)return;const p=o.enabled.indexOf(o.index);o.index=key==='Home'?o.enabled[0]:key==='End'?o.enabled.at(-1):o.enabled[(p+(key==='ArrowUp'?-1:1)+o.enabled.length)%o.enabled.length];this.highlight();},
 choose(index){const o=this.open;if(!o||!o.enabled.includes(index))return;const changed=o.select.selectedIndex!==index;o.select.selectedIndex=index;this.close(true);if(changed){o.select.dispatchEvent(new Event('input',{bubbles:true}));o.select.dispatchEvent(new Event('change',{bubbles:true}));}},
 start(){
  new MutationObserver(()=>{if(this.open&&!this.open.trigger.isConnected)this.close();this.mount();}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('pointerdown',e=>{if(this.open&&!this.open.menu.contains(e.target)&&!this.open.trigger.contains(e.target))this.close();});
  document.addEventListener('keydown',e=>{const o=this.open;if(!o)return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close(true);}
   else if(e.key==='Tab')this.close();
   else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){if(e.target===o.trigger)return;e.preventDefault();this.move(e.key);}
   else if(e.key==='Enter'||e.key===' '){e.preventDefault();this.choose(o.index);}
   else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();const now=Date.now();o.query=(now-o.typed>700?'':o.query)+e.key.toLowerCase();o.typed=now;const found=o.enabled.find(i=>o.options[i].textContent.trim().toLowerCase().startsWith(o.query));if(found!==undefined){o.index=found;this.highlight();}}
  },true);
  window.addEventListener('resize',()=>this.close());document.addEventListener('scroll',e=>{if(this.open&&!this.open.menu.contains(e.target))this.close();},true);
  this.mount();
 }
};

const Tooltips={
 target:null,timer:null,tip:null,
 mount(){
  document.querySelectorAll('[title],.iconbtn[aria-label]').forEach(el=>{
   const text=el.getAttribute('title')||el.getAttribute('aria-label');
   if(text)el.dataset.tooltip=text;
   if(el.hasAttribute('title'))el.removeAttribute('title');
  });
  if(this.target&&!this.target.isConnected)this.hide();
 },
 hide(){
  clearTimeout(this.timer);
  if(this.target){
   const ids=(this.target.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='dashboard-tooltip');
   if(ids.length)this.target.setAttribute('aria-describedby',ids.join(' '));else this.target.removeAttribute('aria-describedby');
  }
  this.target=null;this.tip.classList.remove('visible');
 },
 show(target,delay){
  if(target===this.target)return;
  this.hide();this.target=target;
  this.timer=setTimeout(()=>{
   if(!target.isConnected)return this.hide();
   this.tip.textContent=target.dataset.tooltip;
   this.tip.dir='auto';
   const rect=target.getBoundingClientRect(),width=this.tip.offsetWidth,height=this.tip.offsetHeight;
   const below=rect.top<height+18;
   this.tip.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.left+(rect.width-width)/2))+'px';
   this.tip.style.top=Math.max(8,Math.min(innerHeight-height-8,below?rect.bottom+9:rect.top-height-9))+'px';
   const ids=new Set((target.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));
   ids.add(this.tip.id);target.setAttribute('aria-describedby',[...ids].join(' '));
   this.tip.classList.add('visible');
  },delay);
 },
 start(){
  this.tip=document.createElement('div');this.tip.id='dashboard-tooltip';this.tip.className='soft-tooltip';this.tip.setAttribute('role','tooltip');document.body.append(this.tip);
  this.mount();
  new MutationObserver(()=>this.mount()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['title']});
  document.addEventListener('pointerover',e=>{
   if(e.pointerType==='touch')return;
   if(this.tip.contains(e.target)){clearTimeout(this.timer);return;}
   const target=e.target.closest('[data-tooltip]');
   if(target)this.show(target,300);
  });
  document.addEventListener('pointerout',e=>{
   if(!this.target)return;
   if(this.target.contains(e.relatedTarget)||this.tip.contains(e.relatedTarget))return;
   if(this.target.contains(document.activeElement))return;
   clearTimeout(this.timer);this.timer=setTimeout(()=>this.hide(),100);
  });
  document.addEventListener('focusin',e=>{const target=e.target.closest('[data-tooltip]');if(target)this.show(target,100);});
  document.addEventListener('focusout',e=>{if(this.target?.contains(e.target))this.hide();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.target){e.preventDefault();e.stopImmediatePropagation();this.hide();}},true);
  document.addEventListener('pointerdown',()=>this.hide());
  document.addEventListener('scroll',()=>this.hide(),true);
  window.addEventListener('resize',()=>this.hide());
 }
};

const App={
 home:null,route:'home',arg:null,screens:{},
 /** Sections: [route, label, icon, group, count from home]. */
 nav:[['home','Home','home',''],['taste','Your taste','heart',''],
  ['teach/add','Teach a video','add','Teach'],['teach/library','Library','lib','Teach',h=>[h.teach.videos+h.teach.waiting,h.teach.waiting]],['teach/lessons','Lessons','lesson','Teach',h=>[h.teach.lessons,0]],['teach/patterns','Patterns','pattern','Teach',h=>[h.teach.patterns,0]],
  ['studio/new','New video','add','Studio'],['studio/videos','Videos','film','Studio',h=>[h.studio.jobs,h.studio.waitingForYou]],['studio/scores','Scores','chart','Studio',h=>[h.scores.good+h.scores.bad,0]]],
 register(route,screen){this.screens[route]=screen;},
 go(route,arg){location.hash='#/'+route+(arg?'/'+encodeURIComponent(arg):'');},
 parse(){const h=location.hash.replace(/^#\/?/,''),known=Object.keys(this.screens).sort((a,b)=>b.length-a.length).find(r=>h===r||h.startsWith(r+'/'));
  if(!known){this.route=location.pathname==='/studio'?'studio/new':'home';this.arg=null;return;}
  this.route=known;this.arg=h.length>known.length?decodeURIComponent(h.slice(known.length+1)):null;},
 async start(){
  Controls.start();Tooltips.start();
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
   const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''),playing=[...document.querySelectorAll('video,audio')].some(m=>!m.paused),busy=$('#modal').innerHTML||Controls.open;
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
  const emptyIcon=this.route==='studio/scores'?I.chart:this.route==='teach/lessons'?I.lesson:this.route==='teach/patterns'?I.pattern:this.route==='teach/library'?I.lib:I.film;
  $('#view').querySelectorAll('.empty').forEach(el=>{
   if(!el.querySelector('.empty-art'))el.insertAdjacentHTML('afterbegin',`<div class="empty-art" aria-hidden="true"><div>${emptyIcon}</div></div>`);
  });
  if(!routeChanged)window.scrollTo(0,y);
 },
 side(){
  const h=this.home;if(!h)return;let grp='';
  const links=this.nav.map(([r,l,ic,g,count])=>{const c=count?count(h):null,head=g&&g!==grp?`<div class="grp">${g}</div>`:'';grp=g||grp;
   return head+`<a class="navlink" href="#/${r}" ${this.route===r?'aria-current="page"':''}>${I[ic]}<span>${l}</span>${c&&(c[0]||c[1])?`<span class="n ${c[1]?'hot':''}" title="${c[1]?c[1]+' waiting':''}">${c[1]||c[0]}</span>`:''}</a>`;}).join('');
  const a=h.agent,light=document.documentElement.dataset.theme==='light';
  const navScroll=$('.side-body')?.scrollTop||0,footerScroll=$('.side-footer')?.scrollTop||0;
  $('#side').innerHTML=`<header class="side-header"><a class="logo" href="#/home" aria-label="Tempoloom home"><img class="logo-mark" src="/logo${light?'-light':''}.svg?v=4" alt="Tempoloom" width="146" height="31"></a></header><nav class="side-body" aria-label="Main navigation">${links}</nav><footer class="side-footer">
   <div class="agent ${a.length?'busy':''}">${a.length?`<b>Your agent has work</b>${a.map(x=>`<div class="muted" style="margin-top:6px">${esc(x.why)}. Tell it:</div><div class="say"><span>“${esc(x.say)}”</span><button class="iconbtn" title="Copy the command" aria-label="Copy the command ${esc(x.command)}" onclick="copyText('${esc(x.command)}')">${I.copy}</button></div>`).join('')}`
    :`<b>Your agent is up to date</b><div class="muted">Nothing is waiting for it.</div>`}</div>
   <button class="navlink" onclick="App.theme()">${light?I.moon:I.sun}<span>${light?'Dark':'Light'} theme</span></button></footer>`;
  $('.side-body').scrollTop=navScroll;$('.side-footer').scrollTop=footerScroll;
 },
 theme(){const t=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=t;store.set('theme',t);try{localStorage.setItem('tl-theme',t);}catch{/* private window */}this.side();},
};
