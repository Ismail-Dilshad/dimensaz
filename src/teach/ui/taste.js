'use strict';
// Your taste: one page of what you like, built from what you taught, kept and rated, and yours
// to edit. Every new video starts from it and every preview is measured against its targets.
const Taste={pid:store.get('taste-profile','main')};
App.register('taste',{
 title:()=>'Your taste',sub:()=>'What every new video starts from',
 head(){const b=App.screens.taste.data;return {title:b.id==='main'?'What your studio starts from':b.name,text:`Built from ${b.videos?`${b.videos.length} chosen videos`:`${b.basedOn.good} good and ${b.basedOn.bad} bad examples`}, the lessons you kept and your own rules. The agent reads this before every step and measures its own preview against the targets before you see it.`};},
 load(){const pid=App.arg||Taste.pid;return api('/api/taste?profile='+encodeURIComponent(pid)).catch(()=>{Taste.pid='main';store.set('taste-profile','main');return api('/api/taste');});},
 actions(){const b=App.screens.taste.data;if(!b)return '';
  return `${b.profiles.length>1?`<select aria-label="Profile" onchange="tasteGo(this.value)">${b.profiles.map(p=>`<option value="${esc(p.id)}"${p.id===b.id?' selected':''}>${esc(p.name)}</option>`).join('')}</select>`:''}
   <button class="btn small" onclick="tasteExport()">${I.down} Export</button><button class="btn small primary" onclick="tasteNew()">New profile</button>`;},
 render(el){
  const b=this.data,post=(action,extra,done)=>act(()=>api('/api/taste',{method:'POST',body:JSON.stringify({action,profile:b.id,...extra})}),done);Taste.post=post;Taste.b=b;
  const src={pattern:'from your examples',lesson:'lesson',rule:'your rule',you:'written by you'};
  const empty=!b.topics.length&&!b.targets.length;
  el.innerHTML=`  ${empty?`<div class="empty"><h2>Nothing here yet</h2><p>Teach three good examples and keep some lessons: your taste fills in by itself. You can also write lines below.</p><a class="btn primary" href="#/teach/add">Teach a video</a></div>`:''}
  <div class="cols"><div>
   ${b.topics.map(t=>`<div class="card teach-settings" style="margin-bottom:12px"><div class="teach-section-head"><h3>${esc(t.label)}</h3><span class="muted small">${t.lines.filter(l=>l.on).length} in use</span></div>${t.lines.map(l=>`<label class="teach-setting" style="${l.on?'':'opacity:.55'}"><span style="min-width:0"><b dir="auto" style="font-weight:500;line-height:1.6">${l.avoid&&!/^(avoid|never|no |do not|don't)/i.test(l.text)?'Avoid: ':''}${esc(l.text)}</b><small>${src[l.source]}${l.source==='you'?'':', confidence '+l.strength+'%'}</small></span>
     ${l.ref.startsWith('own-')?`<button class="iconbtn" aria-label="Remove this line" onclick="event.preventDefault();Taste.post('drop',{id:'${esc(l.ref)}'},'Removed')">${I.x}</button>`:`<input type="checkbox" role="switch" aria-label="Use this line" ${l.on?'checked':''} onchange="Taste.post('line',{ref:'${esc(l.ref)}',on:this.checked})">`}</label>`).join('')}</div>`).join('')}
   <div class="card"><h3>Add a line in your own words</h3>
    <div class="row" style="margin-top:10px;align-items:stretch"><select id="tl-topic" aria-label="Topic" style="max-width:190px">${b.topicList.map(t=>`<option value="${t.id}">${esc(t.label)}</option>`).join('')}</select>
     <input type="text" id="tl-text" dir="auto" maxlength="400" placeholder="For example: never use stock photos of people" style="flex:1;min-width:200px"><button class="btn" id="tl-add">Add</button></div></div>
  </div>
  <div>
   <div class="card"><h3>Targets</h3><div class="muted small">Measured on every preview. Outside a range, the agent fixes it before you look.</div>
    ${b.targets.length?b.targets.map(t=>`<div style="margin-top:14px"><div class="row"><b>${esc(t.label)}</b><span class="chip">${t.from==='you'?'set by you':`from ${t.videos} examples`}</span>
      ${t.from==='you'?`<button class="btn small ghost" style="margin-left:auto" onclick="Taste.post('target',{metric:'${t.metric}',lo:null},'Back to your examples')">Reset</button>`:`<button class="btn small ghost" style="margin-left:auto" onclick="Taste.post('line',{ref:'teach-pattern-${t.metric}',on:false},'Ignored')">Ignore</button>`}</div>
     <div class="row" style="margin-top:6px"><input type="number" step="any" value="${t.lo}" data-lo="${t.metric}" aria-label="${esc(t.label)} from" style="width:92px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:5px 8px"><span class="muted">to</span>
      <input type="number" step="any" value="${t.hi}" data-hi="${t.metric}" aria-label="${esc(t.label)} to" style="width:92px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:5px 8px"><span class="muted">${esc(t.unit)}</span></div>
     <div class="muted small">${esc(t.about)}</div></div>`).join(''):'<div class="muted" style="margin-top:10px">None yet. They appear when three good examples agree, or set one yourself below.</div>'}
    ${b.untargeted.length?`<details><summary>${b.untargeted.length} measurement${b.untargeted.length>1?'s':''} without a target</summary>${b.untargeted.map(u=>`<div class="row" style="margin-top:8px"><span style="flex:1">${esc(u.label)} <span class="muted small">${esc(u.unit)}</span></span>
      ${u.offRef?`<button class="btn small" onclick="Taste.post('line',{ref:'${esc(u.offRef)}',on:true},'Using your examples again')">Use my examples</button>`:''}<button class="btn small ghost" onclick="tasteSet('${u.metric}','${esc(u.label)}','${esc(u.unit)}')">Set a target</button></div>`).join('')}</details>`:''}</div>
   <div class="card" style="margin-top:12px"><h3>In your own words</h3><textarea id="tl-notes" dir="auto" maxlength="2000" placeholder="Anything the agent should know about your style, brand or audience." style="margin-top:8px">${esc(b.notes)}</textarea><div class="muted small">Saved when you click away.</div></div>
   ${b.rejects.length?`<div class="card" style="margin-top:12px"><h3>What you reject most</h3><div class="chips">${b.rejects.map(r=>`<span class="chip"><b>${esc(r.reason)}</b> ${r.times}×</span>`).join('')}</div></div>`:''}
   ${b.id!=='main'?`<div class="card" style="margin-top:12px"><h3>This profile</h3><div class="muted small">${b.videos?`Based on ${b.videos.length} of your taught videos.`:'Based on all your taught videos.'}</div>
     <div class="row" style="margin-top:10px"><button class="btn small" onclick="tasteVideos()">Choose its videos</button><button class="btn small ghost" onclick="tasteRemove()">Remove this profile</button></div></div>`:''}
  </div></div>`;
  $('#tl-add').onclick=()=>{const text=$('#tl-text').value.trim();if(text.length<8)return toast('Write the line as a short sentence.',true);post('add',{topic:$('#tl-topic').value,text},'Added');};
  $('#tl-text').onkeydown=e=>{if(e.key==='Enter')$('#tl-add').click();};
  $('#tl-notes').onchange=e=>post('notes',{notes:e.target.value},'Saved');
  el.querySelectorAll('[data-lo],[data-hi]').forEach(i=>i.onchange=()=>{const m=i.dataset.lo||i.dataset.hi,lo=Number(el.querySelector(`[data-lo="${m}"]`).value),hi=Number(el.querySelector(`[data-hi="${m}"]`).value);
   if(!(hi>=lo))return toast('The second number must not be below the first.',true);post('target',{metric:m,lo,hi},'Target set');});
 }});
window.tasteGo=id=>{Taste.pid=id;store.set('taste-profile',id);App.screens.taste.data=null;App.refresh(true);};
window.tasteExport=async()=>{const b=Taste.b,on=l=>l.on;
 const md=`# Taste profile: ${b.name}\n\n${b.notes?b.notes+'\n\n':''}`+b.topics.map(t=>`## ${t.label}\n\n${t.lines.filter(on).map(l=>`- ${l.avoid&&!/^(avoid|never|no |do not|don't)/i.test(l.text)?'Avoid: ':''}${l.text}`).join('\n')}\n`).join('\n')+(b.targets.length?`\n## Targets\n\n${b.targets.map(t=>`- ${t.label}: ${t.lo} to ${t.hi}${t.unit?' '+t.unit:''}`).join('\n')}\n`:'');
 download(`taste-${b.id}.md`,md);};
window.tasteNew=()=>{const b=Taste.b;
 dialog(`<h2>New taste profile</h2><p class="muted">For a client or a brand with its own style. It can use all your taught videos, or only some.</p>
  <label class="f" for="tp-name">Name</label><input type="text" id="tp-name" maxlength="60" placeholder="For example: Hawler Roasters">
  ${b.allVideos.length?`<label class="f">Based on <span class="muted">(leave all unticked to use every video)</span></label><div class="topics" id="tp-v" style="grid-template-columns:1fr">${b.allVideos.map(v=>`<label><input type="checkbox" value="${esc(v.id)}"> <span dir="auto">${esc(v.title)}</span> <span class="muted small">${v.verdict}</span></label>`).join('')}</div>`:''}
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" onclick="closeDialog()">Cancel</button><button class="btn primary" id="tp-go">Create it</button></div>`);
 $('#tp-name').focus();
 $('#tp-go').onclick=async()=>{try{const r=await api('/api/taste',{method:'POST',body:JSON.stringify({action:'create',name:$('#tp-name').value.trim(),videos:[...document.querySelectorAll('#tp-v input:checked')].map(i=>i.value)})});closeDialog(true);toast('Profile created');tasteGo(r.id);}catch(e){toast(e.message,true);}};};
window.tasteVideos=()=>{const b=Taste.b,cur=new Set(b.videos||[]);
 dialog(`<h2>Videos this profile is based on</h2><p class="muted">Its patterns and lessons come from these only. Untick all to use every video.</p>
  <div class="topics" id="tv" style="grid-template-columns:1fr">${b.allVideos.map(v=>`<label><input type="checkbox" value="${esc(v.id)}" ${cur.has(v.id)?'checked':''}> <span dir="auto">${esc(v.title)}</span> <span class="muted small">${v.verdict}</span></label>`).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" onclick="closeDialog()">Cancel</button><button class="btn primary" id="tv-go">Save</button></div>`);
 $('#tv-go').onclick=()=>{const videos=[...document.querySelectorAll('#tv input:checked')].map(i=>i.value);closeDialog(true);Taste.post('videos',{videos},'Saved');};};
window.tasteRemove=async()=>{if(!await ask('Remove this profile?','Its own lines and targets go. Your lessons and videos stay.','Remove it',true))return;
 try{await api('/api/taste',{method:'POST',body:JSON.stringify({action:'remove',profile:Taste.b.id})});toast('Removed');tasteGo('main');}catch(e){toast(e.message,true);}};
window.tasteSet=(metric,label,unit)=>{
 dialog(`<h2>Set a target: ${esc(label)}</h2><div class="row" style="margin-top:10px"><input type="number" step="any" id="ts-lo" placeholder="from" style="width:120px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px"><span class="muted">to</span>
   <input type="number" step="any" id="ts-hi" placeholder="to" style="width:120px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px"><span class="muted">${esc(unit)}</span></div>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" onclick="closeDialog()">Cancel</button><button class="btn primary" id="ts-go">Set it</button></div>`);
 $('#ts-lo').focus();
 $('#ts-go').onclick=()=>{const lo=Number($('#ts-lo').value),hi=Number($('#ts-hi').value);if($('#ts-lo').value===''||$('#ts-hi').value===''||!(hi>=lo))return toast('Give two numbers, the second not below the first.',true);closeDialog(true);Taste.post('target',{metric,lo,hi},'Target set');};};
