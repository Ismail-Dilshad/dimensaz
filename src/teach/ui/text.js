'use strict';
// Edit by text: your footage as its words. Strike a sentence and it is cut; fillers, long pauses and
// lines said more than once are found for you, each on a list where it can be put back. Pick an
// opening, a shape that follows you, and b-roll from your own clips; then make the edit.
I.text=ICON('<path d="M4 6h16M4 12h10M4 18h7"/><path d="M15 16l5 5M20 16l-5 5"/>');
App.nav.splice(App.nav.findIndex(n=>n[0]==='studio/videos')+1,0,['studio/text','Edit by text','text','Studio']);
const TX={busy:null,mode:'edit',playing:false,raf:0,openCuts:false};
const KIND={filler:'filler',pause:'pause',take:'repeated take',sentence:'you struck it',words:'you struck it',start:'silence at the start',end:'silence at the end'};
const txApi=(id,body)=>api('/api/text/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify(body)});
App.register('studio/text',{
 title:a=>{const d=a&&App.screens['studio/text'].data;return d&&d.id?d.title:'Edit by text';},sub:a=>a?'':'Your footage as its words',
 load:()=>App.arg?api('/api/text/'+encodeURIComponent(App.arg)):api('/api/text'),hold:()=>!!TX.busy||TX.playing||!!window.getSelection()?.toString(),
 head:a=>a?null:{title:'Edit by text',text:'Your footage becomes its words. Strike a sentence and it is cut. Fillers, long pauses and lines you said twice are found for you, and every cut can be put back.'},
 actions:a=>a?`<a class="btn small ghost" href="#/studio/text">All edits</a>`:'',
 render(el,arg){const d=this.data;if(arg&&d.id)return txDoc(el,d);if(arg){el.innerHTML='<div class="empty"><h2>This edit is not here</h2><a class="btn" href="#/studio/text">All edits</a></div>';return;}txList(el,d);}
});

// ---------- the list, a new edit, your clips ----------
function txList(el,d){
 el.innerHTML=`<section class="card"><div class="teach-section-head"><h3>Start from a video</h3></div>
  ${d.can.speech?`<div class="pickfile"><button class="btn primary" onclick="$('#txfile').click()" ${TX.busy?'disabled':''}>${I.add} Choose a video</button>${TX.busy?`<span class="muted small"><span class="spin"></span> ${esc(TX.busy)}</span>`:''}<input type="file" id="txfile" hidden accept="video/*,.mkv,.mov"></div>
   <p class="muted small">The speech is read with your ElevenLabs account (once per video; it is remembered). The video stays on this computer.</p>
   ${d.footage.length?`<label class="f" for="txreq">Or footage you already sent to the studio</label><div class="row"><select id="txreq">${d.footage.map((f,k)=>`<option value="${k}">${esc(f.name)}${f.job?` (${esc(f.job)})`:''}</option>`).join('')}</select><button class="btn" onclick="txFromRequest()" ${TX.busy?'disabled':''}>Read it</button></div>`:''}`
  :`<div class="banner">Reading the speech needs your ElevenLabs key: add it in <a href="#/settings">Models and keys</a>. Or from a terminal with a saved transcript: <code>pnpm tempoloom edit text FOOTAGE --transcript WORDS.json</code></div>`}</section>
 ${d.edits.length?`<section class="card"><div class="teach-section-head"><h3>Your edits</h3><span class="muted small">${d.edits.length}</span></div>${d.edits.map(e=>`<a class="tx-row" href="#/studio/text/${encodeURIComponent(e.id)}"><b dir="auto">${esc(e.title)}</b><span class="muted small">${fmtS(e.duration)} of footage${e.renders?`, ${e.renders} made`:''}${e.working?', being made':''}, ${ago(e.updated)}</span></a>`).join('')}</section>`:''}
 <section class="card"><div class="teach-section-head"><h3>Your clips, for b-roll</h3><span class="muted small">${d.library.length}</span></div>
  <p class="muted small">Add clips you filmed. Each is split into shots; describe what a shot shows and the edits suggest it where you say the same thing.</p>
  <div class="pickfile"><button class="btn" onclick="$('#brfile').click()" ${TX.busy?'disabled':''}>${I.add} Add clips</button><input type="file" id="brfile" hidden multiple accept="video/*,.mkv,.mov"></div>
  ${d.library.map(c=>`<div class="br-clip"><div class="row"><b dir="auto">${esc(c.name)}</b><span class="muted small">${c.shots.length} shot${c.shots.length>1?'s':''}</span><button class="btn small ghost danger-text" style="margin-left:auto" onclick="brRemove('${c.id}')">Remove</button></div>
   <div class="br-shots">${c.shots.map(s=>`<figure class="br-shot"><img loading="lazy" alt="Shot ${s.n} of ${esc(c.name)}" src="${withKey(`/broll-sheet/${c.id}/${s.n}`)}"><figcaption><input type="text" dir="auto" maxlength="300" value="${esc(s.description)}" aria-label="What shot ${s.n} shows" onchange="brDescribe('${c.id}',${s.n},this.value)"><span class="muted small">${fmtS(s.start)} to ${fmtS(s.end)}${s.by==='name'?', from the file name':''}</span></figcaption></figure>`).join('')}</div></div>`).join('')}</section>`;
 const f=$('#txfile');if(f)f.onchange=()=>f.files[0]&&txUpload(f.files[0]);
 $('#brfile').onchange=e=>brUpload([...e.target.files]);
}
async function sendFile(url,f){return new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('POST',url);x.setRequestHeader('x-teach-key',KEY);
 x.upload.onprogress=e=>{if(e.lengthComputable&&TX.busy){TX.busy=`Uploading ${f.name} ${Math.round(e.loaded/e.total*100)}%`;if(e.loaded===e.total)TX.busy='Reading the speech';App.show(false);}};
 x.onload=()=>{let j={};try{j=JSON.parse(x.responseText);}catch{}x.status===200?res(j):rej(new Error(j.error||'The upload failed'));};x.onerror=()=>rej(new Error('The upload failed. Is the terminal still open?'));x.send(f);});}
async function txUpload(f){TX.busy='Uploading '+f.name;App.show(false);
 try{const d=await sendFile(`/api/text/upload?name=${encodeURIComponent(f.name)}`,f);TX.busy=null;App.go('studio/text',d.id);}catch(e){TX.busy=null;toast(e.message,true);App.show(false);}}
window.txFromRequest=async()=>{const f=App.screens['studio/text'].data.footage[Number($('#txreq').value)];TX.busy='Reading the speech';App.show(false);
 try{const d=await api('/api/text/from-request',{method:'POST',body:JSON.stringify({request:f.request,name:f.name})});TX.busy=null;App.go('studio/text',d.id);}catch(e){TX.busy=null;toast(e.message,true);App.show(false);}};
async function brUpload(files){for(const f of files){TX.busy='Adding '+f.name;App.show(false);try{await sendFile(`/api/broll/upload?name=${encodeURIComponent(f.name)}`,f);}catch(e){toast(e.message,true);}}TX.busy=null;App.refresh(true);}
window.brDescribe=(clip,n,text)=>act(()=>api(`/api/broll/${clip}/${n}`,{method:'POST',body:JSON.stringify({description:text})}));
window.brRemove=async clip=>{if(await ask('Remove this clip from your b-roll?','Its shots and descriptions are removed from the list. The video file itself is not deleted.','Remove'))act(()=>api('/api/broll/'+clip,{method:'DELETE'}));};

// ---------- one edit ----------
const clockOf=t=>fmtS(t)+(t<60?'.'+String(Math.floor(t%1*10)):'');
function txDoc(el,d){
 const J=esc(d.id),cutCount=d.removals.filter(r=>r.on).length,shapes=[['','Original'],['9:16','Vertical 9:16'],['1:1','Square'],['4:5','4:5']];
 const old=$('#tx-video'),keep=old?{t:old.currentTime}:null;
 el.innerHTML=`<div class="tx-grid">
  <aside class="tx-side"><div class="card">
   <div class="tx-player ${d.shape?'shaped':''}" style="--ar:${d.shape?d.shape.aspect.replace(':','/'):d.width+'/'+d.height}"><video id="tx-video" preload="metadata" src="${withKey('/text-file/'+d.id+'/source')}" controls></video></div>
   <div class="seg tx-mode" role="group" aria-label="What plays"><button class="btn small" aria-pressed="${TX.mode==='edit'}" onclick="txMode('edit')">The edit</button><button class="btn small" aria-pressed="${TX.mode==='all'}" onclick="txMode('all')">All the footage</button></div>
   <div class="tx-len"><b>${fmtS(d.seconds)}</b><span class="muted small">from ${fmtS(d.duration)} of footage, ${cutCount} cut${cutCount===1?'':'s'}</span></div>
   <label class="f">Shape</label><div class="seg" role="group" aria-label="Shape">${shapes.map(([a,l])=>`<button class="btn small" aria-pressed="${(d.shape?.aspect||'')===a}" onclick="txShape('${a}')" ${TX.busy?'disabled':''}>${l}</button>`).join('')}</div>
   ${d.shape?`<p class="muted small">${esc(d.shape.note)}${d.shape.following?' The preview here shows the middle of the frame; the edit follows the speaker.':''}</p>`:''}
   <label class="check" style="margin-top:10px"><input type="checkbox" ${d.captions?'checked':''} onchange="txDo('${J}',{action:'captions',on:this.checked})"> Captions from the words that stay</label>
   ${d.captions&&d.captionStyles?(()=>{const cur=d.captionStyle||d.defaultStyle,st=d.captionStyles.find(x=>x.name===cur);return `<label class="f" for="txcs">Caption style</label><select id="txcs" onchange="txDo('${J}',{action:'caption-style',name:this.value})">${d.captionStyles.map(x=>`<option value="${esc(x.name)}" ${x.name===cur?'selected':''}>${esc(x.label)}${x.yours?' (yours)':''}${x.name===d.defaultStyle?' (default)':''}</option>`).join('')}</select>
    ${st?`<p class="muted small">${esc(st.about)}</p>`:''}<button class="btn small ghost" onclick="txSaveStyle('${J}')">Save as my style</button>`;})():''}
   <label class="check" style="margin-top:10px"><input type="checkbox" ${d.sounds!==false?'checked':''} onchange="txDo('${J}',{action:'sounds',on:this.checked})"> Sounds where something moves, under your voice</label>
   <label class="f">Clean-up</label>
   <label class="check"><input type="checkbox" ${d.steady?.on?'checked':''} ${TX.busy?'disabled':''} onchange="txSteady('${J}',this.checked)"> Steady the picture</label>
   ${TX.busy==='Measuring the shake'?'<p class="muted small"><span class="spin"></span> Measuring the shake</p>':d.steady?`<p class="small ${d.steady.verdict==='too-shaky'?'tx-warn':'muted'}">${esc(d.steady.why)}</p>`:''}
   <div class="tx-blur"><span class="small">Blur, when you ask</span>${[['faces','Faces of other people'],['plates','Number plates'],['phones','Phone numbers']].map(([k,l])=>`<label class="check"><input type="checkbox" data-blur="${k}" ${d.blur?.[k]?'checked':''} onchange="txBlur('${J}')"> ${l}</label>`).join('')}
    ${d.blur?'<p class="muted small">Found when the edit is made, on this computer (the media tools); your own face is kept.</p>':''}</div>
   <div class="row" style="margin-top:14px"><button class="btn primary" onclick="txRender('${J}')" ${d.render?.state==='working'||TX.busy?'disabled':''}>${d.render?.state==='working'?'<span class="spin"></span> Making the edit':'Make the edit'}</button></div>
   ${d.render?.state==='failed'?`<div class="err small">${esc(d.render.error||'It failed')}</div>`:''}
   ${d.renders.length?`<div class="tx-made">${d.renders.slice().reverse().map(r=>`<div class="row"><span class="small">${new Date(r.at).toLocaleString()}, ${fmtS(r.seconds)}</span>${r.exists?`<a class="btn small ghost" style="margin-left:auto" href="${withKey(`/text-file/${d.id}/out-${r.k}`)}&dl=1" download>${I.down} Download</a>`:'<span class="muted small" style="margin-left:auto">moved or deleted</span>'}</div>`).join('')}</div>`:''}
   <label class="f">Open in another editor</label>
   <p class="muted small" style="margin-top:0">A timeline with your footage cut the same way, to keep working there. The footage stays where it is.</p>
   <div class="row">${[['premiere','Premiere or Resolve'],['fcp','Final Cut Pro'],['edl','Any editor (EDL)'],['capcut','CapCut']].map(([k,l])=>`<button class="btn small" ${TX.busy?'disabled':''} onclick="txExport('${J}','${k}')">${l}</button>`).join('')}</div>
   ${TX.busy==='Exporting'?'<p class="muted small"><span class="spin"></span> Writing the timeline</p>':''}
   ${d.timeline?`<div class="tx-made">${d.timeline.files.map(f=>`<div class="row"><span class="small" dir="auto">${esc(f)}</span><a class="btn small ghost" style="margin-left:auto" href="${withKey(`/text-file/${d.id}/timeline/${encodeURIComponent(f)}`)}" download>${I.down} Download</a></div>`).join('')}
    <ul class="tx-notes small muted">${d.timeline.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`:''}
  </div></aside>
  <div class="tx-main">
   ${d.hooks.length?`<section class="card"><div class="teach-section-head"><h3>The opening</h3><span class="muted small">the ${d.hooks.length} strongest, ranked</span></div>
    <p class="muted small" style="margin-top:0">${d.hook?`The edit opens with number ${d.hook.rank}, ${d.hook.move?'moved from its place':'and it still plays in its place'}.`:'The edit opens where the footage starts. Pick a stronger opening: it plays first.'}</p>
    <ol class="tx-hooks">${d.hooks.map(h=>`<li class="${d.hook?.rank===h.rank?'on':''}"><button class="btn small ghost t" onclick="txSeek(${h.start},${h.end})">${h.at}</button><div><span dir="auto">“${esc(h.text)}”</span><div class="muted small">${esc(h.why.join(', '))}</div></div>
     ${d.hook?.rank===h.rank?`<button class="btn small" onclick="txDo('${J}',{action:'hook',rank:null})">Remove</button>`:`<button class="btn small" onclick="txDo('${J}',{action:'hook',rank:${h.rank}})">Open with it</button>`}</li>`).join('')}</ol>
    ${d.hook?`<label class="check"><input type="checkbox" ${d.hook.move?'checked':''} onchange="txDo('${J}',{action:'hook',rank:${d.hook.rank},move:this.checked})"> Move it to the start (do not play it twice)</label>`:''}</section>`:''}
   ${d.takes.length?`<section class="card"><div class="teach-section-head"><h3>Lines you said more than once</h3><span class="muted small">${d.takes.length}</span></div>
    ${d.takes.map(g=>`<div class="tx-takes"><div class="muted small">${esc(g.why)}</div>${g.takes.map((t,k)=>`<label class="tx-take ${g.best===t.sentence?'on':''}"><input type="radio" name="${g.id}" ${g.best===t.sentence?'checked':''} onchange="txDo('${J}',{action:'take',group:'${g.id}',sentence:${t.sentence}})">
     <span><b class="small">Take ${k+1}</b> <button type="button" class="btn small ghost t" onclick="event.preventDefault();txSeek(${d.sentences[t.sentence-1].start},${d.sentences[t.sentence-1].end})">${t.at}</button> <span dir="auto">${esc(t.text)}</span>${t.notes.length?`<span class="muted small"> (${esc(t.notes.join(', '))})</span>`:''}</span></label>`).join('')}</div>`).join('')}</section>`:''}
   <section class="card"><div class="teach-section-head"><h3>What you said</h3><span class="muted small">Click a sentence's number to strike it; select words to cut them</span></div>
    <div class="tx-text" dir="auto" id="tx-text">${d.sentences.map(s=>`<p class="tx-s ${s.struck?'struck':''}" data-n="${s.n}"><button class="tx-n" title="${s.struck?'Bring it back':'Strike it'}" aria-label="${s.struck?'Bring back':'Strike'} sentence ${s.n}" aria-pressed="${s.struck}" onclick="txDo('${J}',{action:'cut',sentence:${s.n},on:${!s.struck}})">${s.n}</button>${s.words.map(w=>`<span class="w ${w.cut?'cut '+w.cut:''} ${w.filler?'fl':''}" data-i="${w.i}" data-t="${w.start}">${esc(w.text)}</span>`).join(' ')}</p>`).join('')}</div>
    <div class="tx-selbar" id="tx-selbar" hidden><button class="btn small primary" onclick="txCutSelection('${J}')">Cut these words</button></div></section>
   <section class="card"><div class="teach-section-head"><h3>Every cut</h3><span class="muted small">${cutCount} of ${d.removals.length} on: turn any back off to keep it</span></div>
    <div class="row tx-kinds">${Object.entries(d.counts).filter(([,c])=>c.all).map(([k,c])=>`<span class="chip">${esc(KIND[k]||k)}: ${c.on} of ${c.all}</span><button class="btn small ghost" onclick="txDo('${J}',{action:'all',kind:'${k}',on:${c.on<c.all}})">${c.on<c.all?'Cut all':'Keep all'}</button>`).join('')}</div>
    <details ${TX.openCuts?'open':''} ontoggle="TX.openCuts=this.open"><summary>The list</summary><ul class="tx-cuts">${d.removals.map(r=>`<li class="${r.on?'':'off'}"><button class="btn small ghost t" onclick="txSeek(${Math.max(0,r.start-1)},${r.end+1})">${r.at}</button><span class="badge ${r.on?'bad':'st'}">${esc(KIND[r.kind]||r.kind)}</span><span class="small" dir="auto">${esc(r.text||r.why)}${r.text&&r.kind!=='take'?`<span class="muted"> (${esc(r.why)})</span>`:''} <span class="muted">${r.seconds} s</span></span>
     <button class="btn small" onclick="txDo('${J}',{action:'toggle',id:'${r.id}',on:${!r.on}})">${r.on?'Keep it':'Cut it'}</button></li>`).join('')}</ul></details></section>
   <section class="card"><div class="teach-section-head"><h3>B-roll from your clips</h3><span class="muted small">${d.broll.filter(b=>b.on).length} used</span></div>
    ${d.broll.length?d.broll.map(b=>`<div class="tx-broll ${b.on?'on':''}"><img loading="lazy" alt="${esc(b.description)}" src="${withKey(`/broll-sheet/${b.clip}/${b.shot}`)}"><div><div class="small" dir="auto">“${esc(b.text)}”</div><div class="muted small" dir="auto">${esc(b.shotInfo?b.shotInfo.name+': '+b.shotInfo.description:b.description)} (shares: ${esc(b.shared.join(', '))})</div></div>
     <button class="btn small ${b.on?'':'primary'}" onclick="txDo('${J}',{action:'broll',sentence:${b.sentence},on:${!b.on}})">${b.on?'Remove':'Use it'}</button></div>`).join('')
     :`<p class="muted small">${d.library?'No shot of your clips shows what is said here. Describe your shots more fully, then suggest again.':'Add clips you filmed under Edit by text, Your clips; shots whose description says what a sentence says are suggested here.'}</p>`}
    <div class="row" style="margin-top:8px"><button class="btn small ghost" onclick="txDo('${J}',{action:'refresh-broll'})">Suggest again</button><a class="btn small ghost" href="#/studio/text">Your clips</a></div></section>
  </div></div>`;
 const v=$('#tx-video');if(keep)v.addEventListener('loadedmetadata',()=>{v.currentTime=keep.t;},{once:true});
 v.onplay=()=>{TX.playing=true;if(TX.mode==='edit')txFollow(d);};v.onpause=v.onended=()=>{TX.playing=false;cancelAnimationFrame(TX.raf);};
 v.ontimeupdate=()=>{const t=v.currentTime;document.querySelectorAll('#tx-text .w.now').forEach(x=>x.classList.remove('now'));const w=[...document.querySelectorAll('#tx-text .w')].reverse().find(x=>Number(x.dataset.t)<=t);if(w)w.classList.add('now');};
 $('#tx-text').onclick=e=>{const w=e.target.closest('.w');if(w&&!window.getSelection().toString()){v.currentTime=Number(w.dataset.t);}};
 document.onselectionchange=()=>{const bar=$('#tx-selbar');if(!bar)return;const r=txSelection();bar.hidden=!r;};
}
/** Plays only what stays, in its order: at the end of each part, on to the next. */
function txFollow(d){
 const v=$('#tx-video'),segs=d.segments;let k=segs.findIndex(s=>v.currentTime>=s.start-.05&&v.currentTime<s.end);
 if(k<0){k=0;v.currentTime=segs[0].start;}
 const tick=()=>{if(v.paused)return;if(v.currentTime>=segs[k].end-.03){k++;if(k>=segs.length){v.pause();return;}v.currentTime=segs[k].start;}TX.raf=requestAnimationFrame(tick);};TX.raf=requestAnimationFrame(tick);
}
window.txMode=m=>{TX.mode=m;const v=$('#tx-video');if(v&&!v.paused){v.pause();v.play();}App.show(false);};
window.txSeek=(a,b)=>{const v=$('#tx-video');if(!v)return;TX.mode='all';document.querySelectorAll('.tx-mode button').forEach((x,i)=>x.setAttribute('aria-pressed',String(i===1)));v.currentTime=a;v.play();
 const stop=()=>{if(v.currentTime>=b){v.pause();v.removeEventListener('timeupdate',stop);}};v.addEventListener('timeupdate',stop);};
function txSelection(){const s=window.getSelection();if(!s||s.isCollapsed)return null;const box=$('#tx-text');if(!box||!box.contains(s.anchorNode)||!box.contains(s.focusNode))return null;
 const ws=[...box.querySelectorAll('.w')].filter(w=>s.containsNode(w,true)).map(w=>Number(w.dataset.i));return ws.length?{from:Math.min(...ws),to:Math.max(...ws)+1}:null;}
window.txCutSelection=id=>{const r=txSelection();if(!r)return;window.getSelection().removeAllRanges();txDo(id,{action:'words',...r});};
window.txDo=async(id,body)=>{try{const d=await txApi(id,body);App.screens['studio/text'].data=d;App.show(false);}catch(e){toast(e.message,true);}};
window.txShape=async a=>{const id=App.arg;TX.busy='Finding the speaker';App.show(false);
 try{const d=await txApi(id,{action:'shape',aspect:a||null});App.screens['studio/text'].data=d;}catch(e){toast(e.message,true);}TX.busy=null;App.show(false);};
window.txRender=id=>act(async()=>{await txApi(id,{action:'render'});toast('Making the edit. It shows here, and in the gallery, when it is ready.');});
window.txSaveStyle=id=>{
 dialog(`<h2>Save as your caption style</h2><p class="muted">This style with your colour, under your own name. Use it in any edit; make it the one new edits start with.</p>
  <label class="f" for="cs-name">Name</label><input type="text" id="cs-name" maxlength="40" placeholder="For example: My bold captions">
  <label class="f" for="cs-hl">Highlight colour</label><input type="color" id="cs-hl" value="#FFD400">
  <label class="check" style="margin-top:10px"><input type="checkbox" id="cs-def" checked> Use it for new edits</label>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" onclick="closeDialog()">Cancel</button><button class="btn primary" id="cs-save">Save</button></div>`);
 $('#cs-save').onclick=async()=>{const name=$('#cs-name').value.trim();if(name.length<2)return toast('Give it a name',true);
  try{const d=await txApi(id,{action:'save-style',label:name,fields:{highlight:$('#cs-hl').value.toUpperCase()},default:$('#cs-def').checked});closeDialog(true);App.screens['studio/text'].data=d;App.show(false);toast('Saved as '+name);}catch(e){toast(e.message,true);}};
};
window.txSteady=async(id,on)=>{TX.busy=on?'Measuring the shake':null;App.show(false);try{const d=await txApi(id,{action:'steady',on});App.screens['studio/text'].data=d;}catch(e){toast(e.message,true);}TX.busy=null;App.show(false);};
window.txExport=async(id,to)=>{TX.busy='Exporting';App.show(false);try{const d=await txApi(id,{action:'export',to:to==='premiere'?['premiere','resolve']:[to]});App.screens['studio/text'].data=d;toast('The timeline is ready');}catch(e){toast(e.message,true);}TX.busy=null;App.show(false);};
window.txBlur=id=>{const pick=k=>!!document.querySelector(`[data-blur="${k}"]`)?.checked;txDo(id,{action:'blur',faces:pick('faces'),plates:pick('plates'),phones:pick('phones')});};
