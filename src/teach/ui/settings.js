'use strict';
// Models and keys: connect the services the browser studio may use, pick a model for the team and
// for each role, who makes images, sound and voice, the budgets, and what may leave the computer.
// Keys are typed here once and never shown again: the page only ever sees their last 4 letters.
I.gear=ICON('<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.650 1.650 0 0 0 .330 1.820l.060.060a2 2 0 1 1-2.830 2.830l-.060-.060a1.650 1.650 0 0 0-1.820-.330 1.650 1.650 0 0 0-1 1.510V21a2 2 0 1 1-4 0v-.090A1.650 1.650 0 0 0 9 19.400a1.650 1.650 0 0 0-1.820.330l-.060.060a2 2 0 1 1-2.830-2.830l.060-.060A1.650 1.650 0 0 0 4.680 15a1.650 1.650 0 0 0-1.510-1H3a2 2 0 1 1 0-4h.090A1.650 1.650 0 0 0 4.600 9a1.650 1.650 0 0 0-.330-1.820l-.060-.060a2 2 0 1 1 2.830-2.830l.060.060A1.650 1.650 0 0 0 9 4.680a1.650 1.650 0 0 0 1-1.510V3a2 2 0 1 1 4 0v.090a1.650 1.650 0 0 0 1 1.510 1.650 1.650 0 0 0 1.820-.330l.060-.060a2 2 0 1 1 2.830 2.830l-.060.060A1.650 1.650 0 0 0 19.400 9a1.650 1.650 0 0 0 1.510 1H21a2 2 0 1 1 0 4h-.090a1.650 1.650 0 0 0-1.510 1z"/>');
I.key=ICON('<circle cx="7.500" cy="15.500" r="4.500"/><path d="M10.700 12.300 21 2M16 7l3 3M19 4l2 2"/>');
const SetUI={GROUPS:[['models','Models for the agents'],['makers','Make images, video and sound'],['voice','Voice'],['sources','Free sources'],['local','On this computer or your network']],
 CAN:{agents:'agents',vision:'see frames',images:'images',video:'video',speech:'speech'}};

const usd=n=>n==null?'':n===0?'free':'$'+(n<1?n.toFixed(2):n%1?n.toFixed(2):n);
const modelLabel=m=>`${m.name}${m.price?` (${usd(m.price.in)} in, ${usd(m.price.out)} out per 1M tokens)`:''}`;
function modelSelect(attr,list,cur,services,blank){
 const byProv=new Map();for(const m of list){if(!byProv.has(m.provider))byProv.set(m.provider,[]);byProv.get(m.provider).push(m);}
 const val=cur?cur.provider+'|'+cur.model:'';
 return `<select ${attr}><option value="">${esc(blank)}</option>${[...byProv].map(([p,ms])=>`<optgroup label="${esc(services.find(s=>s.id===p)?.name||p)}">${ms.map(m=>`<option value="${esc(m.provider+'|'+m.model)}" ${val===m.provider+'|'+m.model?'selected':''}>${esc(modelLabel(m))}</option>`).join('')}</optgroup>`).join('')}</select>`;
}
function serviceRow(s){
 const caps=s.models?Object.entries(SetUI.CAN).filter(([k])=>s.models[k]).map(([k,l])=>`${s.models[k]} ${l}`).join(', '):'';
 const status=s.error?`<span class="badge bad">not working</span>`:s.connected?`<span class="badge good">connected</span>`:'<span class="badge st">not connected</span>';
 return `<div class="service ${s.connected?'on':''}"><div class="service-main"><div class="row" style="gap:8px"><b>${esc(s.name)}</b>${status}${s.hint?`<span class="muted small">key ${esc(s.hint)}${s.stored==='keychain'?', in your keychain':s.stored==='env-file'?', in .env':s.stored==='environment'?', from your environment':''}</span>`:''}</div>
  <p class="muted small">${esc(s.about)}</p>
  ${s.error?`<p class="small" style="color:var(--bad)">${esc(s.error)}</p>`:''}
  ${s.connected&&(caps||s.note)?`<p class="small">${caps?esc(caps):''}${caps&&s.note?'. ':''}${s.note?esc(s.note):''}${s.checked?` <span class="muted">(checked ${ago(s.checked)})</span>`:''}</p>`:''}</div>
  <div class="row service-actions">${s.group==='local'?`<button class="btn small" onclick="setTest('${s.id}')">Test</button><button class="btn small danger-text" onclick="setRemoveLocal('${s.id}')">Remove</button>`
   :s.connected?`<button class="btn small" onclick="setTest('${s.id}')">Test</button><button class="btn small ghost" onclick="setConnect('${s.id}')">Change key</button>${s.stored!=='environment'?`<button class="btn small danger-text" onclick="setRemoveKey('${s.id}')">Remove</button>`:''}`
   :`<button class="btn small" onclick="setConnect('${s.id}')">${I.key} Connect</button>`}</div></div>`;
}

App.register('settings',{
 title:()=>'Models and keys',sub:()=>'Optional: the browser studio',
 async load(){const [o,agents,images]=await Promise.all([api('/api/settings'),api('/api/settings/models?can=agents'),api('/api/settings/models?can=images')]);return {...o,agents:agents.models,imageModels:images.models};},
 head:()=>({title:'Models and keys',text:'Connect the services the browser studio may use. Everything here is optional: with no key, your terminal agent does the work as before. Keys stay on this computer and are never shown again.'}),
 render(el){
  const d=this.data,s=d.settings,svc=d.services,conn=svc.filter(x=>x.connected);
  const maker=(kind,label,can,note)=>{const ok=svc.filter(x=>x.group!=='local'&&x.connected&&can.some(c=>x.can[c]));
   return `<label class="teach-setting"><span><b>${label}</b><small class="muted">${note}</small></span><select data-maker="${kind}" aria-label="${label}"><option value="off">Off: find it or draw it with code</option>${ok.map(x=>`<option value="${x.id}" ${s.makers[kind]===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;};
  const tile=(group,v,name,about,icon,cur)=>`<button type="button" class="teach-mode" aria-pressed="${cur===v}" onclick="setPatch({${group}:'${v}'})"><span class="teach-mode-icon">${I[icon]}</span><span><b>${name}</b><small>${about}</small></span></button>`;
  el.innerHTML=`${d.warnings.length?`<div class="banner warn">${d.warnings.map(esc).join('<br>')}</div>`:''}
  <section class="card"><div class="teach-section-head"><h3>Who works on new videos</h3><span class="badge st">your terminal agent</span></div>
   <p class="muted small" style="margin:0">Claude Code, Codex or Gemini CLI does the work, and the <a href="#/studio/live">Live studio</a> shows it as it happens. The browser studio's own agents are the next step of this plan: the services and models you set here are what they will use.</p></section>
  ${SetUI.GROUPS.map(([g,label])=>{const list=svc.filter(x=>x.group===g);return `<section class="card"><div class="teach-section-head"><h3>${label}</h3><span class="muted small">${list.filter(x=>x.connected).length} of ${list.length} connected</span></div>
   ${list.map(serviceRow).join('')||'<p class="muted small">No model server added yet.</p>'}
   ${g==='local'?`<div class="row" style="margin-top:12px">${d.presets.map(p=>`<button class="btn small" onclick="setAddLocal('${esc(p.name)}','${esc(p.baseURL)}')">Add ${esc(p.name)}</button>`).join('')}<button class="btn small ghost" onclick="setAddLocal()">Another server</button></div>`:''}</section>`;}).join('')}
  <section class="card teach-settings"><div class="teach-section-head"><h3>Models for the team</h3><span class="muted small">${d.agents.length} models can run agents</span></div>
   ${d.agents.length?`<label class="teach-setting"><span><b>Main model</b><small class="muted">Every role uses it unless you choose another below.</small></span>${modelSelect('data-model="main" aria-label="Main model"',d.agents,s.model,svc,'Choose a model')}</label>
   <details class="teach-focus"><summary>A different model for some roles<span class="muted">${Object.keys(s.roleModels).length} set</span></summary>
    ${d.roles.map(r=>`<label class="teach-setting"><span><b>${esc(r.title)}</b>${r.id==='reviewer'?'<small class="muted">Give it a different model from the producer, so its review is independent.</small>':''}</span>${modelSelect(`data-role="${r.id}" aria-label="Model for ${esc(r.title)}"`,d.agents,s.roleModels[r.id],svc,'Same as the main model')}</label>`).join('')}</details>`
   :`<p class="muted small">Connect Claude, OpenAI, Gemini, OpenRouter or a local model server below, then choose the model here.</p>`}</section>
  <section class="card teach-settings"><div class="teach-section-head"><h3>Who makes what</h3></div><p class="muted small" style="margin:0 0 4px">Text in a video is always drawn by Tempoloom, in fonts that cover every Kurdish letter, never by an image model.</p>
   ${maker('images','Images',['images'],'Backgrounds, objects, product shots.')}${maker('video','Video clips',['video'],'Costly; leave off unless you need them.')}${maker('music','Music',['music'],'Only when you ask for music.')}${maker('sfx','Sound effects',['sound'],'Whooshes, clicks and hits on the motion.')}
   <label class="teach-setting"><span><b>Voice</b><small class="muted">Only when you ask for a voice-over.</small></span><select data-maker="voice" aria-label="Voice"><option value="elevenlabs" ${s.makers.voice==='elevenlabs'?'selected':''}>ElevenLabs</option><option value="off" ${s.makers.voice==='off'?'selected':''}>Off: captions only</option></select></label></section>
  <section class="card teach-settings"><div class="teach-section-head"><h3>Budgets</h3><span class="muted small">US dollars</span></div>
   <div class="budget-row">${[['perJob','Per video'],['perDay','Per day'],['askAbove','Ask me before one step over']].map(([k,l])=>`<label class="f">${l}<input type="number" min="0" step="0.5" data-budget="${k}" value="${s.budget[k]}"></label>`).join('')}<button class="btn" onclick="setBudget()">Save budgets</button></div></section>
  <section class="card"><div class="teach-section-head"><h3>What may leave this computer</h3></div>
   <div class="teach-modes four">${tile('share','frames','Frames only','Pictures from your video, not the video.','eye',s.share)}${tile('share','clips','Short clips','A few seconds at a time.','film',s.share)}${tile('share','full','Full videos','For models that watch a whole video.','play',s.share)}${tile('share','local','Nothing','Local models and free sources only.','home',s.share)}</div></section>
`;
  el.querySelectorAll('[data-model],[data-role]').forEach(x=>x.onchange=()=>{const v=x.value?{provider:x.value.split('|')[0],model:x.value.split('|').slice(1).join('|')}:null;setPatch(x.dataset.model?{model:v}:{roleModels:{[x.dataset.role]:v}});});
  el.querySelectorAll('[data-maker]').forEach(x=>x.onchange=()=>setPatch({makers:{[x.dataset.maker]:x.value}}));
 }
});
window.setPatch=patch=>act(()=>api('/api/settings',{method:'PATCH',body:JSON.stringify(patch)}),'Saved');
window.setBudget=()=>{const b={};document.querySelectorAll('[data-budget]').forEach(x=>b[x.dataset.budget]=Number(x.value));setPatch({budget:b});};
window.setTest=id=>act(async()=>{const r=await api('/api/settings/test/'+id,{method:'POST'});if(!r.ok)throw new Error(r.error);toast(`Works: ${r.count} model${r.count===1?'':'s'}${r.note?'. '+r.note:''}`);});
window.setRemoveKey=async id=>{const s=App.screens.settings.data.services.find(x=>x.id===id);if(await ask(`Remove the ${s.name} key?`,'Tempoloom stops using this service. You can connect it again any time.','Remove',true))act(()=>api('/api/settings/keys/'+id,{method:'DELETE'}),'Removed');};
window.setRemoveLocal=async id=>{if(await ask('Remove this server?','Roles that used its models go back to the main model.','Remove',true))act(()=>api('/api/settings/local/'+id,{method:'DELETE'}),'Removed');};
window.setConnect=id=>{const s=App.screens.settings.data.services.find(x=>x.id===id);
 dialog(`<h2>Connect ${esc(s.name)}</h2><p class="muted">${esc(s.about)} <a href="${esc(s.signup)}" target="_blank" rel="noopener noreferrer">Get a key</a>.</p>
  <form id="keyform"><label class="f" for="keyin">The key</label><input id="keyin" type="password" autocomplete="off" spellcheck="false" placeholder="Paste it here" required>
  <p class="muted small" style="margin-top:8px">It is saved in your system's keychain, or in .env when there is none, and never shown again. Tempoloom checks it now by reading the service's model list.</p>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn primary" type="submit">Save and check</button></div></form>`);
 $('#modal [data-no]').onclick=()=>closeDialog();
 $('#keyform').onsubmit=async e=>{e.preventDefault();const b=$('#keyform button[type=submit]');b.disabled=true;b.innerHTML='<span class="spin"></span> Checking';
  try{const r=await api('/api/settings/keys/'+id,{method:'POST',body:JSON.stringify({key:$('#keyin').value})});closeDialog(true);
   r.test.ok?toast(`${s.name} is connected: ${r.test.count} model${r.test.count===1?'':'s'}${r.test.note?'. '+r.test.note:''}`):toast(`Saved, but the check failed: ${r.test.error}`,true);}
  catch(err){toast(err.message,true);b.disabled=false;b.textContent='Save and check';return;}
  App.refresh(true);};};
window.setAddLocal=(name,baseURL)=>{
 dialog(`<h2>Add a model server</h2><p class="muted">Any server that speaks the OpenAI API: Ollama, LM Studio, llama.cpp, vLLM. Start it first.</p>
  <form id="localform"><label class="f" for="ln">Name</label><input id="ln" type="text" value="${esc(name||'')}" required maxlength="60"><label class="f" for="lu" style="margin-top:10px">Address</label><input id="lu" type="url" value="${esc(baseURL||'http://localhost:11434/v1')}" required>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn ghost" data-no>Cancel</button><button class="btn primary" type="submit">Add and check</button></div></form>`);
 $('#modal [data-no]').onclick=()=>closeDialog();
 $('#localform').onsubmit=async e=>{e.preventDefault();try{const r=await api('/api/settings/local',{method:'POST',body:JSON.stringify({name:$('#ln').value,baseURL:$('#lu').value})});closeDialog(true);
  r.test.ok?toast(`${r.added.name}: ${r.test.count} model${r.test.count===1?'':'s'}`):toast(`Added, but it did not answer: ${r.test.error}`,true);}catch(err){toast(err.message,true);return;}App.refresh(true);};};
