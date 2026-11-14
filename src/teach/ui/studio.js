'use strict';
// Studio: brief a video (motion or an edit), follow every step, rate each one, pick a look, tell
// the studio anything, and see whether the ratings are getting better.
const LANGS=[['','Automatic'],['en','English'],['ckb','Kurdish (Sorani)'],['kmr','Kurdish (Kurmanji)'],['badini','Kurdish (Badini)'],['ar','Arabic'],['fa','Persian']];
const PRESETS=[
 {name:'Product ad, 30 s',mode:'motion',seconds:'30',shape:'vertical',notes:'A product ad: a hook in the first 2 seconds, the problem, the product as the answer, one proof, a clear call to action.'},
 {name:'Launch teaser, 15 s',mode:'motion',seconds:'15',shape:'vertical',notes:'A short teaser: one idea, the product name, the date or link. No feature list.'},
 {name:'Explainer, 60 s',mode:'motion',seconds:'60',shape:'horizontal',notes:'An explainer: what it is, how it works in three steps, who it is for.'},
 {name:'Talking-head short',mode:'edit',seconds:'45',shape:'vertical',captions:true,visuals:true,notes:'Keep the strongest part. Cut pauses and filler words. Big readable captions.'},
 {name:'Clean up a recording',mode:'edit',seconds:'',shape:'',captions:false,visuals:false,notes:'Keep everything said. Only remove long pauses and mistakes, fix the sound and the colour.'}];
const blankBrief=()=>({id:null,mode:'motion',text:'',script:false,link:'',seconds:'30',shape:'vertical',language:'',voice:false,captions:true,visuals:true,pick:true,useColors:false,primary:'#0B3B3C',accent:'#FF6B4A',background:'#FFF1D6',like:'',notes:'',profile:'',files:[]});
const Studio={N:{...blankBrief(),...store.get('studio-brief',{})},busy:null,sending:false,F:{},showArchived:false,
 load(){return api('/api/studio/state');},
 get S(){const here=App.screens[App.route];return here?.data?.reasons?here.data:['studio/new','studio/videos','studio/scores'].map(r=>App.screens[r].data).find(Boolean);},
 save(){store.set('studio-brief',Studio.N);},
 form(job,task){return Studio.F[job+'|'+task]??=({open:false,reasons:new Set(),parts:[],note:''});}};
const AGENT_LINE=`<b>Waiting for your agent.</b> Tell it “check the studio inbox” <button class="iconbtn" style="vertical-align:middle" title="Copy the command" aria-label="Copy the command" onclick="copyText('pnpm tempoloom studio inbox')">${I.copy}</button>`;

// ---------- new video ----------
const fileRow=(kind,label,hint,accept,multiple)=>{
 const N=Studio.N,mine=N.files.filter(f=>f.kind===kind);
 return `<label class="f">${label} <span class="muted">${hint}</span></label>
 <div class="pickfile"><button class="btn small" data-pick="${kind}">${mine.length&&!multiple?'Replace':'Choose file'+(multiple?'s':'')}</button>${Studio.busy&&Studio.busy.kind===kind?`<span class="muted small" id="upmsg"><span class="spin"></span> <span>${esc(Studio.busy.text)}</span></span>`:''}
  <input type="file" hidden data-file="${kind}" accept="${accept}" ${multiple?'multiple':''}></div>
 ${mine.length?`<ul class="files">${mine.map(f=>`<li><span class="nm" dir="auto">${esc(f.name)}</span><span class="muted">${mb(f.bytes)}</span><button class="iconbtn" data-rm="${esc(f.name)}" aria-label="Remove ${esc(f.name)}">${I.x}</button></li>`).join('')}</ul>`:''}`;
};
App.register('studio/new',{
 head:()=>({title:'Bring your next story to life.',text:'Start with an idea or your footage. Shape the direction, review each step, and make it yours.'}),
 title:()=>'New video',sub:()=>'Your agent makes it; you rate every step',load:Studio.load,hold:()=>!!Studio.busy,
 actions:()=>`<button class="btn small ghost" onclick="clearBrief()">Start over</button>`,
 render(el){
  const S=this.data,N=Studio.N;
  // A saved brief whose uploads are gone starts without them.
  if(N.id&&!S.requests.some(r=>r.id===N.id&&r.status==='draft')){N.id=null;N.files=[];Studio.save();}
  const m=N.mode==='motion',sel=(id,opts,val)=>`<select id="${id}">${opts.map(([v,l])=>`<option value="${v}"${String(val)===String(v)?' selected':''}>${l}</option>`).join('')}</select>`;
  const past=S.jobs.filter(j=>j.brief).slice(0,6);
  el.innerHTML=`<div class="teach-modes" style="grid-template-columns:1fr 1fr;margin:0 0 20px">
   <button class="teach-mode" aria-pressed="${m}" data-mode="motion"><span class="teach-mode-icon">${I.pattern}</span><span><b>Motion graphics video</b><small>From a script, a prompt, a topic, or only a link. Everything is designed and animated for you.</small></span></button>
   <button class="teach-mode" aria-pressed="${!m}" data-mode="edit"><span class="teach-mode-icon">${I.film}</span><span><b>Edit my footage</b><small>Your talking-head or any video. Say what you want, or say nothing and the studio decides.</small></span></button></div>
  <div class="presets"><span class="muted small" style="align-self:center">Start from</span>${PRESETS.filter(p=>p.mode===N.mode).map(p=>`<button class="btn small" data-preset="${PRESETS.indexOf(p)}">${esc(p.name)}</button>`).join('')}
   ${past.length?`<select id="reuse" aria-label="Reuse an earlier brief" style="max-width:240px"><option value="">Reuse an earlier brief</option>${past.map(j=>`<option value="${esc(j.job)}">${esc(jobTitle(j).slice(0,48))}</option>`).join('')}</select>`:''}</div>
  <div class="form">
   <div class="card">
    ${m?`<h2>What is the video about?</h2>
     <label class="f" for="text">A script, a prompt or just a topic <span class="muted">(or leave empty and give only a link)</span></label>
     <textarea class="big" id="text" dir="auto" maxlength="12000" placeholder="For example: a 30 second ad for my coffee shop's new cold brew, playful, ends with our address.&#10;&#10;Or paste your finished script, one sentence a line.">${esc(N.text)}</textarea>
     <div class="row" style="margin-top:6px"><span class="muted small" id="count"></span></div>
     <label class="check" style="margin-top:8px"><input type="checkbox" id="script" ${N.script?'checked':''}> This is my finished script: use it word for word</label>
     <label class="f" for="link">Link <span class="muted">(a product page or article: read for facts and brand)</span></label>
     <input type="url" id="link" placeholder="https://" value="${esc(N.link)}">`
    :`<h2>Your footage</h2>
     ${fileRow('footage','Video to edit','(up to 8 files, '+S.can.maxMB+' MB each; they stay on this computer)','video/*,audio/*,.mkv,.mov',true)}
     <label class="f" for="text">What should the edit do? <span class="muted">(optional)</span></label>
     <textarea class="big" id="text" dir="auto" maxlength="12000" placeholder="Leave this empty and the studio decides everything: what to keep, the cuts, captions, music and visuals.&#10;&#10;Or say what you want: cut the pauses, make it 45 seconds, big bold captions, add my logo at the end.">${esc(N.text)}</textarea>`}
    <label class="f" for="notes">Anything else <span class="muted">(audience, mood, must-haves)</span></label>
    <textarea id="notes" dir="auto" maxlength="2000" style="min-height:70px">${esc(N.notes)}</textarea>
   </div>
   <div class="card">
    <h2>Details</h2>
    <div class="two"><div><label class="f" for="seconds">Length</label>${sel('seconds',[['','Studio decides'],['15','15 seconds'],['30','30 seconds'],['45','45 seconds'],['60','1 minute'],['90','1.5 minutes'],['120','2 minutes']],N.seconds)}</div>
     <div><label class="f" for="shape">Shape</label>${sel('shape',[['','Studio decides'],['vertical','Vertical 9:16'],['horizontal','Horizontal 16:9'],['square','Square 1:1']],N.shape)}</div></div>
    <label class="f" for="language">Language</label>${sel('language',LANGS,N.language)}
    ${(S.profiles||[]).length>1?`<label class="f" for="profile">Taste profile</label>${sel('profile',S.profiles.map(p=>[p.id==='main'?'':p.id,esc(p.name)]),N.profile)}`:''}
    ${m?`<label class="check" style="margin-top:12px"><input type="checkbox" id="voice" ${N.voice?'checked':''}> Add a voice-over (uses your ElevenLabs account)</label>
     <label class="check" style="margin-top:6px"><input type="checkbox" id="pick" ${N.pick?'checked':''}> Show me two looks and let me pick</label>`
    :`<label class="check" style="margin-top:12px"><input type="checkbox" id="captions" ${N.captions?'checked':''}> Captions</label>
     <label class="check" style="margin-top:6px"><input type="checkbox" id="visuals" ${N.visuals?'checked':''}> Designed visuals over the footage, where they help</label>`}
    ${fileRow('logo','Logo','(optional)','image/*,.svg',false)}
    <label class="check" style="margin-top:12px"><input type="checkbox" id="useColors" ${N.useColors?'checked':''}> Use these colours for this video</label>
    <div class="colors" style="margin-top:8px"${N.useColors?'':' hidden'}>${[['primary','Main'],['accent','Accent'],['background','Background']].map(([k,l])=>`<label><input type="color" id="c-${k}" value="${esc(N[k])}"> ${l}</label>`).join('')}</div>
    ${fileRow('reference','Reference','(a video or image to study, never copied)','video/*,image/*',true)}
    ${m&&S.taught.length?`<label class="f" for="like">In the spirit of a video you taught</label>${sel('like',[['','None'],...S.taught.map(v=>[v.id,esc(v.title.slice(0,60))])],N.like)}`:''}
    ${fileRow('asset','Other files','(photos, screenshots, music, a PDF)','image/*,video/*,audio/*,.pdf,.txt,.md',true)}
    <div class="row" style="margin-top:18px"><button class="btn primary" id="send" ${Studio.sending||Studio.busy?'disabled':''}>Send to the studio</button><span class="muted small">Saved as you type</span></div>
   </div></div>`;
  const count=()=>{const c=$('#count');if(!c)return;const w=N.text.trim()?N.text.trim().split(/\s+/).length:0,secs=N.script&&w?Math.round(w/2.5):0;c.textContent=w?`${w} words${secs?`, about ${secs} seconds when read aloud`:''}`:'';};count();
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{N.mode=b.dataset.mode;Studio.save();App.show(false);});
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const {name,...p}=PRESETS[b.dataset.preset];Object.assign(N,p);Studio.save();App.show(false);});
  if($('#reuse'))$('#reuse').onchange=e=>{const j=S.jobs.find(x=>x.job===e.target.value);if(!j)return;const b=j.brief;
   Object.assign(N,{mode:b.mode,text:b.text||'',script:!!b.script,link:b.link||'',seconds:b.seconds?String(b.seconds):'',shape:b.shape||'',language:b.language||'',voice:!!b.voice,captions:b.captions!==false,visuals:b.visuals!==false,pick:b.pick!==false,notes:b.notes||'',like:b.like||'',
    useColors:!!(b.colors&&Object.keys(b.colors).length),...(b.colors||{})});Studio.save();App.show(false);toast('Brief copied. Files are not copied: add them again.');};
  for(const id of ['text','link','notes'])if($('#'+id))$('#'+id).oninput=e=>{N[id]=e.target.value;Studio.save();count();};
  for(const id of ['seconds','shape','language','like','profile'])if($('#'+id))$('#'+id).onchange=e=>{N[id]=e.target.value;Studio.save();};
  for(const id of ['script','voice','pick','captions','visuals'])if($('#'+id))$('#'+id).onchange=e=>{N[id]=e.target.checked;Studio.save();count();};
  $('#useColors').onchange=e=>{N.useColors=e.target.checked;Studio.save();App.show(false);};
  for(const k of ['primary','accent','background'])$('#c-'+k).oninput=e=>{N[k]=e.target.value;Studio.save();};
  document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>$(`[data-file="${b.dataset.pick}"]`).click());
  document.querySelectorAll('[data-file]').forEach(i=>i.onchange=()=>briefUpload(i.dataset.file,[...i.files]));
  document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>act(async()=>{const r=await api(`/api/studio/requests/${N.id}/files?name=${encodeURIComponent(b.dataset.rm)}`,{method:'DELETE'});N.files=r.files;Studio.save();}));
  $('#send').onclick=sendBrief;
 }});
window.clearBrief=async()=>{if(!await ask('Start over?','The brief and its uploaded files are cleared.','Clear it'))return;
 act(async()=>{if(Studio.N.id)await api('/api/studio/requests/'+Studio.N.id,{method:'DELETE'}).catch(()=>0);Studio.N=blankBrief();Studio.save();},'Cleared');};
async function ensureRequest(){const N=Studio.N;if(!N.id){N.id=(await api('/api/studio/requests',{method:'POST'})).id;Studio.save();}return N.id;}
async function briefUpload(kind,files){
 const N=Studio.N,S=Studio.S;
 try{const id=await ensureRequest();
  if(kind==='logo')for(const f of N.files.filter(x=>x.kind==='logo'))N.files=(await api(`/api/studio/requests/${id}/files?name=${encodeURIComponent(f.name)}`,{method:'DELETE'})).files;
  for(const f of files){
   if(f.size>S.can.maxMB*1048576)throw new Error(`${f.name} is over ${S.can.maxMB} MB.`);
   Studio.busy={kind,text:'Uploading '+f.name};App.show(false);
   const r=await new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('POST',`/api/studio/requests/${id}/files?kind=${kind}&name=${encodeURIComponent(f.name)}`);x.setRequestHeader('x-teach-key',KEY);
    x.upload.onprogress=e=>{if(e.lengthComputable&&Studio.busy){Studio.busy.text=`Uploading ${f.name} ${Math.round(e.loaded/e.total*100)}%`;const el=$('#upmsg span:last-child');if(el)el.textContent=Studio.busy.text;}};
    x.onload=()=>{let j={};try{j=JSON.parse(x.responseText);}catch{}x.status===200?res(j):rej(new Error(j.error||'The upload failed'));};x.onerror=()=>rej(new Error('The upload failed. Is the terminal still open?'));x.send(f);});
   N.files=r.files;Studio.save();}
 }catch(e){toast(e.message,true);}
 Studio.busy=null;App.show(false);
}
async function sendBrief(){
 const N=Studio.N;if(Studio.sending)return;
 const body={mode:N.mode,text:N.text.trim(),script:N.mode==='motion'&&N.script,link:N.mode==='motion'?N.link.trim():'',voice:N.mode==='motion'&&N.voice,captions:N.captions,visuals:N.visuals,pick:N.mode==='motion'&&N.pick,
  colors:N.useColors?{primary:N.primary,accent:N.accent,background:N.background}:{},notes:N.notes.trim(),
  ...(N.seconds?{seconds:Number(N.seconds)}:{}),...(N.shape?{shape:N.shape}:{}),...(N.language?{language:N.language}:{}),...(N.mode==='motion'&&N.like?{like:N.like}:{}),...(N.profile?{profile:N.profile}:{})};
 if(N.mode==='motion'&&!body.text&&!body.link)return toast('Write a script, a prompt or a topic, or give a link.',true);
 if(N.mode==='edit'&&!N.files.some(f=>f.kind==='footage'))return toast('Choose the footage to edit.',true);
 Studio.sending=true;
 try{const id=await ensureRequest();await api(`/api/studio/requests/${id}/submit`,{method:'POST',body:JSON.stringify(body)});Studio.N=blankBrief();Studio.save();Studio.sending=false;toast('Sent to the studio');App.go('studio/videos');}
 catch(e){Studio.sending=false;toast(e.message,true);App.show(false);}
}

// ---------- videos ----------
const jobTitle=j=>{const m=/(?:to use as written|write one\)|What the user wants):\n([^\n]+)/.exec(j.request);return (m?m[1]:j.request.split('\n')[0]).slice(0,90);};
const stateBadge=(j,working)=>working&&!j.finished?'<span class="badge wait"><span class="live-pulse"></span> being worked on</span>':j.finished?`<span class="badge good">finished</span>`:j.waitingFor==='you'?'<span class="badge bad">waiting for you</span>':'<span class="badge wait">waiting for the agent</span>';
const mediaUrl=(j,t,slot,dl)=>withKey(`/studio-file/job/${j.job}/${t.index}/${slot}`)+(dl?'&dl=1':'');
App.register('studio/videos',{
 head:a=>{const j=a&&Studio.S?.jobs.find(x=>x.job===a);return j?{title:jobTitle(j),text:'Look at each step, rate it, and approve to continue. A step you rate bad is redone on its own.'}:{title:'Videos in production',text:'Every video the studio is making or has made. Open one to follow its steps.'};},
 title:a=>{const j=a&&Studio.S?.jobs.find(x=>x.job===a);return j?jobTitle(j):'Videos';},sub:a=>a?'':'Every video the studio made or is making',
 load:async()=>{const S=await Studio.load(),a=App.arg;const [live,list]=await Promise.all([a?api('/api/studio/live/'+encodeURIComponent(a)).catch(()=>null):null,a?null:api('/api/studio/live').catch(()=>({jobs:[]}))]);S.live=live;S.liveList=list?.jobs||[];return S;},
 hold:()=>{const f=$('#live-feed');return !!f&&f.matches(':hover')&&f.scrollHeight-f.scrollTop-f.clientHeight>40;},
 actions:a=>{const j=a&&Studio.S?.jobs.find(x=>x.job===a);return j?`<a class="btn small ghost" href="#/studio/videos">All videos</a><button class="btn small" onclick="tellStudio('${esc(j.job)}')">Tell the studio something</button><button class="btn small ghost" onclick="archiveJob('${esc(j.job)}',${!j.archived})">${j.archived?'Bring back':'Archive'}</button><button class="btn small danger-text" onclick="deleteStudioJob('${esc(j.job)}')">Delete</button>`:`<a class="btn small primary" href="#/studio/new">New video</a>`;},
 render(el,arg){
  const S=this.data;
  if(arg){const j=S.jobs.find(x=>x.job===arg);const old=$('#live-feed'),keep=old?{top:old.scrollTop,end:old.scrollHeight-old.scrollTop-old.clientHeight<40}:{end:true};
   el.innerHTML=j?jobHtml(j,S.live):`<div class="empty"><h2>This video is not here</h2><a class="btn" href="#/studio/videos">All videos</a></div>`;
   const feed=$('#live-feed');if(feed)feed.scrollTop=keep.end?feed.scrollHeight:keep.top;if(j&&S.live)Live.stream(j.job,S.live.lastSeq);return;}
  const waiting=S.requests.filter(r=>r.status==='waiting'),archived=S.jobs.filter(j=>j.archived),jobs=S.jobs.filter(j=>Studio.showArchived||!j.archived);
  if(!waiting.length&&!S.jobs.length){el.innerHTML=`<div class="empty"><h2>No videos yet</h2><p>Create a video from an idea or your own footage. Follow its progress and review each step here.</p><a class="btn primary" href="#/studio/new">New video</a></div>`;return;}
  el.innerHTML=`${waiting.length?`<div class="banner">${AGENT_LINE}</div>`:''}<div class="grid">
  ${waiting.map(r=>`<div class="card"><div class="row"><h3>${r.input.mode==='edit'?'Edit':'Motion video'}</h3><span class="badge wait">sent, not started</span><span class="muted small">${ago(r.created)}</span><button class="btn small ghost" style="margin-left:auto" onclick="editQueued('${r.id}')">Edit brief</button><button class="btn small danger-text" onclick="deleteQueued('${r.id}')">Delete</button></div>
    <div class="muted small" dir="auto" style="margin-top:6px">${esc(r.summary)}</div>${r.input.text?`<div dir="auto" style="margin-top:6px">${esc(r.input.text.slice(0,220))}${r.input.text.length>220?'…':''}</div>`:''}</div>`).join('')}
  ${jobs.map(j=>{const good=j.ratings.filter(r=>r.rating==='good').length,bad=j.ratings.filter(r=>r.rating==='bad').length,now=(S.liveList||[]).find(x=>x.job===j.job&&x.active);return `<div class="card job"><a class="job-link" href="#/studio/videos/${encodeURIComponent(j.job)}">
    <div class="row">${now?`<img class="job-face" src="/mascot/${esc(now.face||'thinking')}.svg" alt="${esc(FACE_LABEL[now.face]||'Working')}" width="34" height="26">`:''}<h3 dir="auto">${esc(jobTitle(j))}</h3><span class="badge st">${j.mode==='edit'?'edit':'motion'}</span>${stateBadge(j,!!now)}${j.archived?'<span class="chip">archived</span>':''}
     <span class="muted small" style="margin-left:auto">${good||bad?`${good} good, ${bad} bad, `:''}${j.done} of ${j.of} steps, ${ago(j.created)}</span></div>
    <div class="prog"><i style="width:${Math.round(j.done/j.of*100)}%"></i></div>${now&&now.said?`<div class="muted small job-said" dir="auto">${esc(now.said)}</div>`:''}</a><button class="btn small danger-text job-delete" aria-label="Delete ${esc(jobTitle(j))}" onclick="deleteStudioJob('${esc(j.job)}')">Delete</button></div>`;}).join('')}</div>
  ${archived.length?`<button class="btn small ghost" style="margin-top:14px" onclick="Studio.showArchived=!Studio.showArchived;App.show(false)">${Studio.showArchived?'Hide':'Show'} ${archived.length} archived</button>`:''}`;
 }});
window.editQueued=id=>{
 const request=Studio.S.requests.find(r=>r.id===id);
 dialog(`<form id="brief-edit"><h2>Edit queued brief</h2><label class="f" for="brief-text">${request.input.script?'Script':'Instructions'}</label><textarea id="brief-text" dir="auto" maxlength="12000">${esc(request.input.text)}</textarea><div class="dialog-actions"><button type="button" class="btn ghost" onclick="closeDialog()">Cancel</button><button class="btn primary">Save changes</button></div></form>`);
 $('#brief-text').focus();
 $('#brief-edit').onsubmit=async e=>{
  e.preventDefault();
  try{await api('/api/studio/requests/'+id,{method:'PATCH',body:JSON.stringify({text:$('#brief-text').value})});closeDialog();await App.refresh(true);}catch(err){toast(err.message,true);}
 };
};
window.deleteQueued=async id=>{
 if(await ask('Delete queued video?','This removes the brief and the files uploaded with it.','Delete request',true))
  await act(()=>api('/api/studio/requests/'+id,{method:'DELETE'}),'Request deleted');
};
window.deleteStudioJob=async job=>{
 if(await ask('Delete this studio job?','This removes its plan from the studio and closes future steps. Any render already running can finish. Saved project files, exports and lessons are kept.','Delete job',true))
  await act(async()=>{await api('/api/studio/jobs/'+job,{method:'DELETE'});App.go('studio/videos');},'Job deleted');
};
window.archiveJob=(job,on)=>act(async()=>{await api(`/api/studio/jobs/${job}/archive`,{method:'POST',body:JSON.stringify({on})});if(on)App.go('studio/videos');},on?'Archived. Nothing was deleted.':'Brought back');
window.tellStudio=job=>{
 dialog(`<h2>Tell the studio something</h2><p class="muted">In your own words. It is saved as a rule, sent to the roles it concerns, and their steps are redone.</p>
  <textarea id="ts" dir="auto" maxlength="800" placeholder="For example: the music is too loud under the voice, and the captions should be bigger."></textarea>
  <label class="check" style="margin-top:10px"><input type="checkbox" id="tp"> This is praise: keep doing it (nothing is redone)</label>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" onclick="closeDialog()">Cancel</button><button class="btn primary" id="tsend">Send</button></div>`);
 $('#ts').focus();
 $('#tsend').onclick=async()=>{try{const r=await api(`/api/studio/jobs/${job}/feedback`,{method:'POST',body:JSON.stringify({said:$('#ts').value,praise:$('#tp').checked})});closeDialog(true);
  toast(`Saved as a rule for ${r.goesTo.join(', ')}${r.reopened.length?`. Redoing: ${r.reopened.join(', ')}`:''}`);await App.refresh(true);}catch(e){toast(e.message,true);}};
};
const gateTitle=t=>t.title.replace(/^The user approves/,'Approve').replace(/^The user picks/,'Pick');
function jobHtml(j,live){
 const final=j.tasks.find(t=>t.id==='final'),shown=j.tasks.filter(t=>!t.gate&&t.status!=='todo'),working=live?.driver.state==='working';
 const dot=t=>t.rating?(t.rating.rating==='bad'?'b':t.rating.rating==='good'?'g':''):'';
 return `<div class="jobgrid">
  <nav class="stepnav" aria-label="Steps">${j.tasks.filter(t=>!t.gate).map(t=>t.status==='todo'?`<a style="opacity:.5"><span class="dot"></span>${esc(shortStep(t))}</a>`:`<a href="#step-${t.id}" onclick="event.preventDefault();jumpStep('${t.id}')" ${t.status==='doing'?'class="doing"':''}><span class="dot ${t.status==='doing'?'live-pulse':dot(t)}"></span>${esc(shortStep(t))}</a>`).join('')}</nav>
  <div>
   <div class="card"><div class="row">${stateBadge(j,working)}<span class="badge st">${j.mode==='edit'?'edit':'motion'}</span><span class="muted small" style="margin-left:auto">${j.done} of ${j.of} steps, started ${ago(j.created)}</span></div>
    <div class="prog"><i style="width:${Math.round(j.done/j.of*100)}%"></i></div>
    <details><summary>The request</summary><div class="out" dir="auto">${esc(j.request)}</div></details></div>
   ${liveHtml(live)}
   ${j.finished||working?'':j.waitingFor==='you'?`<div class="banner you"><b>Your turn.</b> Look at the steps below, rate them, then approve to continue.</div>`:`<div class="banner">${AGENT_LINE}${j.agentReady.length?`<div class="muted small" style="margin-top:4px">Ready for it: ${j.agentReady.map(esc).join(', ')}</div>`:''}</div>`}
   ${(()=>{
    // Steps before the last approval are folded away, unless one of them is being redone.
    let cut=-1;j.tasks.forEach((t,i)=>{if(t.gate&&t.status==='approved')cut=i;});
    const early=j.tasks.slice(0,cut+1),rest=j.tasks.slice(cut+1),html=l=>l.map(t=>t.gate?gateHtml(j,t):stepHtml(j,t,final)).join('');
    const open=Studio.openEarly===j.job||early.some(t=>!t.gate&&(t.status==='redo'||t.status==='doing'))||!rest.some(t=>t.gate||t.status!=='todo');
    const n=early.filter(t=>!t.gate).length;
    return cut<0?html(j.tasks):`<details ${open?'open':''} ontoggle="Studio.openEarly=this.open?'${esc(j.job)}':null"><summary>${n} earlier step${n===1?'':'s'}, approved</summary>${html(early)}</details>${html(rest)}`;})()}
   ${j.feedback.length?`<h2 style="margin:22px 0 6px">Rules this video created</h2>${j.feedback.map(f=>`<div class="lesson"><div dir="auto">${esc(f.rule)}</div><div class="muted small">Sent to: ${f.goesTo.map(esc).join(', ')}</div></div>`).join('')}`:''}
  </div></div>`;
}
const shortStep=t=>({intake:'Intake',brief:'Brief',research:'Research',facts:'Facts',script:'Script',style:'Look',storyboard:'Storyboard',sound:'Sound',voice:'Voice',design:'Design',build:'Preview',review:'Review',final:'Final video',learn:'Wrap-up',analysis:'Footage analysis','cut-plan':'Cut plan',overlays:'Visuals',captions:'Captions',finish:'Finishing',reference:'Reference'})[t.id]||t.title;
function gateHtml(j,t){
 if(t.status==='later')return '';
 if(t.status==='approved')return `<div class="step muted small">✓ ${esc(gateTitle(t))}: approved</div>`;
 return `<div class="card step" style="border-color:var(--coral)"><div class="row"><h3>${esc(gateTitle(t))}</h3>
  <button class="btn primary" style="margin-left:auto" ${t.blockedBy.length?'disabled':''} onclick="act(()=>api('/api/studio/jobs/${j.job}/approve/${t.id}',{method:'POST',body:'{}'}),'Approved')">Approve and continue</button></div>
  <div class="muted small" style="margin-top:6px">${t.blockedBy.length?'Pick a version above first.':'Rate the steps above first if you like. A step you rate bad is redone before this comes back.'}</div></div>`;
}
function stepHtml(j,t,final){
 const st={todo:'',doing:'<span class="badge wait"><span class="spin"></span> working</span>',done:'<span class="badge st">ready</span>',redo:'<span class="badge bad">being redone</span>'}[t.status];
 if(t.status==='todo')return `<div class="step todo muted small">○ ${esc(t.title)}, ${esc(t.owner)}</div>`;
 const f=Studio.form(j.job,t.id),isScript=/script\.txt$/.test(t.outputName||''),isFinal=t.id==='final';
 const flagged=p=>f.parts.some(x=>x.part===p);
 const vids=t.show.filter(s=>s.type==='video'),imgs=t.show.filter(s=>s.type==='image'),auds=t.show.filter(s=>s.type==='audio');
 const rateable=t.canRate&&!(isFinal&&j.verdict),J=esc(j.job);
 const dl=(slot,label='Download')=>`<a class="btn small ghost" href="${mediaUrl(j,t,slot,true)}" download>${I.down} ${label}</a>`;
 return `<div class="card step" id="step-${t.id}" style="scroll-margin-top:84px">
  <div class="row"><h3>${esc(t.title)}</h3>${st}${t.round>1?`<span class="chip">version ${t.round}</span>`:''}<span class="muted small" style="margin-left:auto">${esc(t.owner)}</span></div>
  ${t.choices.length?`<div class="choices">${t.choices.map(c=>`<div class="choice ${t.picked===c.label?'picked':''}">${c.type==='video'?`<video controls preload="metadata" src="${mediaUrl(j,t,'choice-'+c.k)}"></video>`:c.type==='image'?`<img alt="${esc(c.label)}" src="${mediaUrl(j,t,'choice-'+c.k)}">`:''}
    <div class="row" style="margin-top:8px"><b dir="auto">${esc(c.label)}</b>${t.picked===c.label?'<span class="badge good">your pick</span>':t.picked?'':`<button class="btn small primary" style="margin-left:auto" onclick="act(()=>api('/api/studio/jobs/${J}/pick/${t.id}',{method:'POST',body:JSON.stringify({label:${esc(JSON.stringify(c.label))}})}),'Picked')">Pick this one</button>`}</div></div>`).join('')}</div>`:''}
  ${vids.length?`<div class="media wide">${vids.map(s=>`<figure><video controls preload="metadata" id="vid-${t.id}-${s.k}" src="${mediaUrl(j,t,'show-'+s.k)}"></video><figcaption><span>${esc(s.name)}</span><span class="row">${dl('show-'+s.k)}${rateable?`<button class="btn small" onclick="flagMoment('${J}','${t.id}','vid-${t.id}-${s.k}')">Flag this moment</button>`:''}</span></figcaption></figure>`).join('')}</div>`:''}
  ${imgs.length?`<div class="media">${imgs.map((s,n)=>{const p='picture '+(n+1);return `<figure class="${flagged(p)?'flag':''}"><img loading="lazy" alt="${esc(s.name)}" src="${mediaUrl(j,t,'show-'+s.k)}" style="cursor:zoom-in" onclick="zoomImage(this.src,'${esc(s.name)}')"><figcaption><span>${n+1}. ${esc(s.name)}</span>${rateable?`<button class="btn small ${flagged(p)?'b on':''}" onclick="flagPart('${J}','${t.id}','${p}')">${flagged(p)?'Flagged':'Flag'}</button>`:''}</figcaption></figure>`;}).join('')}</div>`:''}
  ${auds.map(s=>`<div style="margin-top:10px"><div class="row"><span class="muted small">${esc(s.name)}</span>${dl('show-'+s.k)}</div><audio controls preload="none" src="${mediaUrl(j,t,'show-'+s.k)}"></audio></div>`).join('')}
  ${t.output!==null?(isScript?`<div class="out" dir="auto">${t.output.split('\n').map((l,n)=>l.trim()?`<span class="ln ${flagged('line '+(n+1))?'flag':''}" ${rateable?`onclick="flagPart('${J}','${t.id}','line ${n+1}')"`:''} title="${rateable?'Click to flag this line':''}">${esc(l)}</span>`:'<br>').join('')}</div><div class="row" style="margin-top:6px">${rateable?'<span class="muted small">Click a line to flag it.</span>':''}<button class="btn small ghost" style="margin-left:auto" onclick="copyText(${esc(JSON.stringify(t.output))})">${I.copy} Copy the script</button></div>`
   :`<details ${vids.length||imgs.length||t.choices.length?'':'open'}><summary>${esc(t.outputName||'What was decided')}</summary><div class="out" dir="auto">${esc(t.output)}</div></details>`):''}
  ${t.selfcheck?`<details ${t.selfcheck.off?'open':''}><summary>${I.eye} The studio checked its own video against your taste (${esc(t.selfcheck.profile)}): ${t.selfcheck.passed} match${t.selfcheck.near?`, ${t.selfcheck.near} close`:''}${t.selfcheck.off?`, ${t.selfcheck.off} off`:''}${t.selfcheck.attempt>1?`, after ${t.selfcheck.attempt} tries`:''}</summary>
    ${t.selfcheck.accepted?`<div class="muted small" style="margin-top:6px">Kept as it is because: ${esc(t.selfcheck.accepted)}</div>`:''}
    <div class="cmp" style="grid-template-columns:max-content max-content 1fr;margin-top:8px">${t.selfcheck.checks.map(c=>`<span class="k">${esc(c.label)}</span><span><span class="badge ${c.verdict==='pass'?'good':c.verdict==='near'?'wait':'bad'}">${c.verdict==='pass'?'matches':c.verdict==='near'?'close':'off'}</span></span><span class="muted small">${c.value}${c.unit?' '+esc(c.unit):''}, you like ${c.lo} to ${c.hi}</span>`).join('')}</div></details>`:''}
  ${t.expected&&!t.rating?`<div class="muted small" style="margin-top:8px">The studio's guess: you will rate this ${t.expected.good>=.5?'good':'bad'} (${Math.round(t.expected.good*100)}% good, from ${t.expected.basis} earlier ratings of this step).</div>`:''}
  ${t.lessons.length?`<details><summary>${t.lessons.length} lesson${t.lessons.length>1?'s':''} this step used (your rating scores these)</summary>${t.lessons.map(l=>`<div class="lesson"><span class="badge ${l.status==='trial'?'wait':'st'}">${l.status==='trial'?'on trial':esc(l.status)}</span> <span dir="auto">${esc(l.title)}</span></div>`).join('')}</details>`:''}
  ${t.rating?`<div class="ratebar"><span class="badge ${t.rating.rating==='bad'?'bad':t.rating.rating==='good'?'good':'st'}">You rated it ${t.rating.rating==='ok'?'not bad':t.rating.rating}</span>${t.rating.rule?`<span class="muted small" dir="auto">Rule saved: ${esc(t.rating.rule)}</span>`:''}</div>`:''}
  ${t.earlier.length?`<div class="muted small" style="margin-top:6px">Earlier: ${t.earlier.map(e=>`version ${e.round} ${e.rating==='ok'?'not bad':e.rating}`).join(', ')}</div>`:''}
  ${rateable?`<div class="ratebar"><span class="muted small">${isFinal?'The finished video:':'This step:'}</span>
    <button class="btn small g" onclick="rateNow('${J}','${t.id}','good',${isFinal})">Good</button><button class="btn small" onclick="rateNow('${J}','${t.id}','ok',${isFinal})">Not bad</button>
    <button class="btn small b ${f.open?'on':''}" onclick="toggleBad('${J}','${t.id}')">Bad</button>${f.parts.length&&!f.open?`<span class="muted small">${f.parts.length} flagged</span>`:''}</div>
   ${f.open?`<div class="why"><b class="small">What is wrong?</b>
    <div class="reasons">${Studio.S.reasons.map(r=>`<button class="btn small ${f.reasons.has(r.id)?'b on':''}" onclick="toggleReason('${J}','${t.id}','${r.id}')">${esc(r.label)}</button>`).join('')}</div>
    ${f.parts.length?`<ul class="parts">${f.parts.map((p,n)=>`<li><span class="p">${esc(p.part)}</span><input type="text" dir="auto" maxlength="300" placeholder="What is wrong here?" value="${esc(p.note)}" oninput="Studio.F['${J}|${t.id}'].parts[${n}].note=this.value" aria-label="What is wrong at ${esc(p.part)}"><button class="iconbtn" onclick="Studio.F['${J}|${t.id}'].parts.splice(${n},1);App.show(false)" aria-label="Remove">${I.x}</button></li>`).join('')}</ul>`:''}
    <textarea dir="auto" maxlength="600" placeholder="In your own words (optional if you chose a reason)" oninput="Studio.F['${J}|${t.id}'].note=this.value" style="min-height:64px">${esc(f.note)}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn small primary" onclick="rateNow('${J}','${t.id}','bad',${isFinal})">Send and redo this step</button><span class="muted small">The reason is saved as a rule for the ${esc(t.owner)}, and only this step is redone.</span></div></div>`:''}`:''}
 </div>`;
}
window.jumpStep=id=>{const el=document.getElementById('step-'+id);if(!el)return;const d=el.closest('details');if(d)d.open=true;el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});};
window.zoomImage=(src,name)=>dialog(`<img alt="${esc(name)}" src="${esc(src)}" style="display:block;max-width:100%;max-height:76vh;margin:0 auto;border-radius:10px"><div class="row" style="justify-content:space-between;margin-top:12px"><span class="muted small">${esc(name)}</span><span class="row"><a class="btn small ghost" href="${esc(src)}&dl=1" download>${I.down} Download</a><button class="btn small" onclick="closeDialog()">Close</button></span></div>`,{wide:true});
window.toggleBad=(job,task)=>{const f=Studio.form(job,task);f.open=!f.open;App.show(false);};
window.toggleReason=(job,task,id)=>{const f=Studio.form(job,task);f.reasons.has(id)?f.reasons.delete(id):f.reasons.add(id);App.show(false);};
window.flagPart=(job,task,part)=>{const f=Studio.form(job,task),i=f.parts.findIndex(p=>p.part===part);i>=0?f.parts.splice(i,1):f.parts.push({part,note:''});if(f.parts.length)f.open=true;App.show(false);};
window.flagMoment=(job,task,vid)=>{const v=document.getElementById(vid);v.pause();const f=Studio.form(job,task),part='at '+fmtS(v.currentTime);if(!f.parts.some(p=>p.part===part))f.parts.push({part,note:''});f.open=true;App.show(false);};
window.rateNow=async(job,task,rating,isFinal)=>{
 const f=Studio.form(job,task);
 const body={rating,reasons:rating==='bad'?[...f.reasons]:[],note:rating==='bad'?f.note.trim():'',parts:rating==='bad'?f.parts.map(p=>({part:p.part,rating:'bad',note:p.note.trim()})):[]};
 if(rating==='bad'&&!body.reasons.length&&!body.note&&!body.parts.some(p=>p.note))return toast('Say what is wrong: choose a reason or write a note.',true);
 act(async()=>{await api(isFinal?`/api/studio/jobs/${job}/final`:`/api/studio/jobs/${job}/rate/${task}`,{method:'POST',body:JSON.stringify(body)});delete Studio.F[job+'|'+task];},rating==='bad'?'Sent. This step will be redone.':rating==='good'?'Rated good':'Rated not bad');
};

// ---------- scores ----------
function scoreTrend(trend){
 if(!trend.length)return '<p class="muted">Rate a first version to see its score here.</p>';
 const points=trend.map((t,i)=>({x:44+(trend.length===1?168:i*336/(trend.length-1)),y:101-85*t.good/t.rated,percent:Math.round(100*t.good/t.rated),...t}));
 const date=t=>new Date(t.created).toLocaleDateString(undefined,{month:'short',day:'numeric'});
 return `<svg class="score-line" viewBox="0 0 400 126" role="img" aria-label="First-pass approval from ${points[0].percent}% to ${points.at(-1).percent}%">
 ${[0,50,100].map(n=>`<line x1="44" x2="381" y1="${101-n*.85}" y2="${101-n*.85}"/><text x="35" y="${105-n*.85}" text-anchor="end">${n}%</text>`).join('')}
 <polyline points="${points.map(p=>p.x+','+p.y).join(' ')}"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3"><title>${esc(p.job)} · ${p.good}/${p.rated} good</title></circle>`).join('')}
 <text x="44" y="123">${esc(date(points[0]))}</text>${points.length>1?`<text x="380" y="123" text-anchor="end">${esc(date(points.at(-1)))}</text>`:''}</svg>
 <details><summary>View chart data</summary>${points.map(p=>`<div class="chart-row"><a href="#/studio/videos/${encodeURIComponent(p.job)}">${esc(p.job)}</a><span>${p.good}/${p.rated} · ${p.percent}%</span></div>`).join('')}</details>`;
}
App.register('studio/scores',{
 head(){const s=this.data.scores;return {title:'How the studio is doing',text:`Every rating scores only the lessons its step used. ${s.good} good and ${s.bad} bad ratings across ${s.jobs} videos.`};},
 title:()=>'Scores',sub:()=>'Is it getting better?',load:Studio.load,
 render(el){
  const s=this.data.scores;s.guesses=s.guesses||{judged:0};
  if(!s.ratings){el.innerHTML=`<div class="empty"><h2>No ratings yet</h2><p>Rate the steps of a video and the scores appear here.</p><a class="btn primary" href="#/studio/new">New video</a></div>`;return;}
  const row=l=>`<div class="lesson"><div class="row"><span class="badge ${l.status==='trial'?'wait':l.status==='retired'?'st':'good'}">${l.status==='trial'?'on trial':esc(l.status)}</span><span class="muted small" style="margin-left:auto">${l.wins} good, ${l.losses} bad, confidence ${l.confidence}%</span></div><div dir="auto" style="margin-top:4px">${esc(l.title)}</div></div>`;
  const ok=s.ratings-s.good-s.bad;
  const mix=[['Good',s.good,'var(--good)'],['Not bad',ok,'var(--warn)'],['Bad',s.bad,'var(--bad)']];
  let offset=0;
  const stops=mix.map(([,count,color])=>{const start=offset;offset+=count/s.ratings*100;return color+' '+start+'% '+offset+'%';});
  el.innerHTML=`<div class="score-grid"><section class="card"><h2>Rating distribution</h2><div class="rating-summary"><div class="rating-ring" style="background:conic-gradient(${stops.join(',')})"><div><strong>${s.ratings}</strong><span>ratings</span></div></div><div class="rating-key">${mix.map(([label,count,color])=>`<div><i style="background:${color}"></i><span>${label}</span><b>${count}</b></div>`).join('')}</div></div></section>
   <section class="card"><h2>First-pass approval</h2><p class="muted small">Share of first-version steps rated good, in video creation order.</p>${scoreTrend(s.trend)}</section></div>
  <div class="grid">   <div class="card"><h3 style="margin-bottom:12px">By step</h3><div class="bars">${s.steps.map(x=>{const n=x.good+x.ok+x.bad;return `<span>${esc(x.step)}</span><span class="barx" role="img" aria-label="${x.good} good, ${x.ok} not bad, ${x.bad} bad"><i style="width:${x.good/n*100}%;background:var(--good)"></i><i style="width:${x.ok/n*100}%;background:var(--line)"></i><i style="width:${x.bad/n*100}%;background:var(--bad)"></i></span><span class="muted small">${x.good} good, ${x.bad} bad</span>`;}).join('')}</div></div></div>
  <section class="card" style="margin-top:16px"><h2>Does the studio guess your ratings?</h2>
   ${s.guesses.judged?`<div class="meter" style="margin:14px 0 8px"><i style="width:${s.guesses.share}%"></i></div><div>${s.guesses.matched} of ${s.guesses.judged} guesses matched your rating (${s.guesses.share}%).</div>
    <p class="muted small">${s.guesses.trusted?'It is reliable enough: the agent now improves a step it expects you to reject before showing it.':'A guess is only advice until 20 are judged and 7 in 10 match.'}</p>`
    :'<p class="muted small">Before you rate a step, the studio guesses your rating from how you rated that kind of step before. After a few ratings the guesses are counted here.</p>'}</section>
  <div class="cols"><div><h2 style="margin:8px 0 4px">Lessons that are working</h2>${s.best.length?s.best.map(row).join(''):'<div class="muted">None yet.</div>'}</div>
   <div><h2 style="margin:8px 0 4px">Lessons that are failing</h2>${s.worst.length?s.worst.map(row).join(''):'<div class="muted">None. Good.</div>'}</div></div>
  ${s.rules.length?`<h2 style="margin:22px 0 6px">Rules from your ratings</h2>${s.rules.map(r=>`<div class="lesson" dir="auto">${esc(r)}</div>`).join('')}`:''}`;
 }});
