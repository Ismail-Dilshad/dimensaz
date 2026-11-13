'use strict';
// Teach: add videos (one or many), choose the part, crop, mark, say what to learn; the library
// of taught videos with search, details and compare; the lessons; the patterns.
const Teach={
 data:null,D:{},cur:null,up:null,linkInfo:null,ed:null,editing:null,
 lib:store.get('teach-lib',{q:'',verdict:'all',status:'all',topic:'all',sort:'new'}),picked:new Set(),
 les:store.get('teach-les',{q:'',status:'all',topic:'all'}),
 load(){return api('/api/state');},
 /** The current teach screen's data (each screen loads the same state). */
 get S(){const here=App.screens[App.route];return here?.data?.topics?here.data:['teach/add','teach/library','teach/lessons','teach/patterns'].map(r=>App.screens[r].data).find(Boolean);},
};
const word=(n,a)=>a.find(([max])=>n<max)[1];
const topicLabel=id=>Teach.S.topics.find(t=>t.id===id)?.label||id;

const TEACH_MODES=[
 {id:'motion',name:'Motion design',short:'Motion study',icon:'pattern',description:'Animation, type & composition',topics:['motion','typography','transitions','design','pacing']},
 {id:'edit',name:'Footage editing',short:'Editing study',icon:'film',description:'Cut rhythm, flow & sound',topics:['editing','pacing','transitions','audio']},
 {id:'story',name:'Storytelling',short:'Story study',icon:'lesson',description:'Hooks, narrative & captions',topics:['script','captions','pacing','design']}
];
const teachMode=id=>TEACH_MODES.find(m=>m.id===id)||TEACH_MODES[0];
function modePicker(selected,location){
 return `<div class="teach-modes" role="group" aria-label="Learning mode">${TEACH_MODES.map(m=>`<button type="button" class="teach-mode" data-mode="${m.id}" aria-pressed="${m.id===selected}" onclick="setTeachMode('${m.id}','${location}')"><span class="teach-mode-icon">${I[m.icon]}</span><span><b>${m.name}</b><small>${m.description}</small></span></button>`).join('')}</div>`;
}
function automaticTitle(d){
 const mode=teachMode(d.mode);
 const base=d.sourceTitle.replace(/^Video by /i,'').replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_]+/g,' ').trim();
 const generic=/^(video|clip|source|download|reel|untitled|screen recording|[a-f0-9-]{16,})(?:\s|$)/i.test(base)||/^\d+$/.test(base);
 const title=generic?`${mode.short} · ${fmtS(d.end-d.start)}`:`${base} · ${mode.short}`;
 if(title.length<=120)return title;
 let shortened='';
 for(const word of title.split(/\s+/u)){const next=(shortened+' '+word).trim();if(next.length>120)break;shortened=next;}
 return shortened||mode.short;
}
function automaticPrompt(d){
 const topics=Teach.S.topics.filter(t=>d.topics.has(t.id)).map(t=>t.label.toLowerCase());
 const subject=topics.length?topics.join(', '):'the selected learning focus';
 const direction=d.verdict==='good'?'Explain what works and why, with techniques worth reusing.':'Explain what does not work and why, with concrete changes to avoid repeating those problems.';
 const part=d.start<=.01&&d.end>=d.seconds-.01?'Study the full clip.':`Study only ${fmtT(d.start)} to ${fmtT(d.end)}.`;
 let prompt=`${part} Focus on ${subject}. ${direction} Ground each lesson in a visible moment and describe how to apply it to another video.${d.sound&&d.audio?' Include how the sound supports the visuals.':''}`;
 for(const mark of d.marks.filter(m=>m.t>=d.start&&m.t<=d.end)){
  const instruction=` Pay attention at ${fmtT(mark.t)}${mark.note?' — '+mark.note:''}.`;
  if(prompt.length+instruction.length>1950){prompt+=' Review the remaining marked moments as well.';break;}
  prompt+=instruction;
 }
 return prompt;
}
function syncTeachLearning(d){
 if($('#editor')?.dataset.id!==d.id)return;
 if(d.autoTitle){d.title=automaticTitle(d);$('#study-title').value=d.title;}
 if(d.autoPrompt){d.prompt=automaticPrompt(d);$('#prompt').value=d.prompt;}
 $('#auto-title').checked=d.autoTitle;$('#auto-prompt').checked=d.autoPrompt;
 document.querySelectorAll('.teach-settings [data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===d.mode)));
 document.querySelectorAll('#topics [data-topic]').forEach(b=>b.setAttribute('aria-pressed',String(d.topics.has(b.dataset.topic))));
 $('#focus-count').textContent=d.topics.size+' selected';
 $('#learning-summary').textContent=`${d.end-d.start<d.seconds-.02?'Selected segment':'Full clip'} · ${fmtS(d.end-d.start)} · ${d.topics.size} focus areas`;
 $('#send').disabled=d.sending||d.cropping||d.cropOn||!d.topics.size||!d.title.trim();
 $('#cancel').disabled=!!d.cropping;
}
window.setTeachMode=(id,location)=>{
 const mode=teachMode(id);store.set('teach-mode',mode.id);
 if(location==='upload'){
  document.querySelectorAll('.teach-upload [data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode.id)));
  return;
 }
 const d=Teach.D[Teach.cur];if(!d)return;
 d.mode=mode.id;d.topics=new Set(mode.topics.filter(t=>t!=='audio'||d.audio));
 d.sound=d.audio&&d.topics.has('audio');if(!d.sound)d.speech=false;
 $('#sound').checked=d.sound;$('#speech').checked=d.speech;$('#speech').disabled=!d.sound;
 syncTeachLearning(d);
};
window.openTeachUpload=()=>{Teach.cur=null;Teach.addMore=true;App.show(true);};

// ---------- add ----------
App.register('teach/add',{
 title:()=>'Teach a video',sub:()=>'Choose a clip and tell the studio what to learn',load:Teach.load,
 hold:()=>!!Teach.up,
 render(el,arg,routeChanged){
  const S=this.data,drafts=S.videos.filter(v=>v.status==='draft');
  if(Teach.cur&&!drafts.some(d=>d.id===Teach.cur))Teach.cur=null;
  if(!Teach.cur&&drafts.length&&!Teach.up&&!Teach.addMore)Teach.cur=drafts[0].id;
  // The editor is not re-drawn while the user works in it: only the queue beside it.
  if(Teach.cur&&$('#editor')?.dataset.id===Teach.cur&&!routeChanged){$('#queue').innerHTML=queueHtml(drafts);return;}
  if(Teach.ed){Teach.ed.video.pause();Teach.ed.dispose?.();Teach.ed=null;}
  el.innerHTML=Teach.cur?`<div id="edwrap"></div><div id="queue">${queueHtml(drafts)}</div>`:dropHtml(S)+`<div id="queue">${queueHtml(drafts)}</div>`;
  el.classList.toggle('teach-editor-view',!!Teach.cur);
  if(Teach.cur)openEditor(drafts.find(d=>d.id===Teach.cur));else wireDrop(S);
 }});
function queueHtml(drafts){
 const up=Teach.up;if(!drafts.length&&!up)return '';
 if(!up&&drafts.length===1&&drafts[0].id===Teach.cur)return '';
 return `<h3 style="margin:22px 0 8px">Reference queue <span class="muted small">${drafts.length}</span></h3><div class="queue">
  ${drafts.map(d=>`<div class="q ${d.id===Teach.cur?'cur':''}"><span dir="auto" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.title)}</span><span class="muted small">${fmtS(d.media.seconds)}</span>
   ${d.id===Teach.cur?'<span class="badge st">open</span>':`<button class="btn small" onclick="Teach.cur='${d.id}';Teach.addMore=false;App.show(true)">Set up</button>`}<button class="iconbtn" aria-label="Remove ${esc(d.title)}" onclick="removeDraft('${d.id}')">${I.x}</button></div>`).join('')}
  ${up?`<div class="q"><span class="spin"></span><span style="flex:1" dir="auto">${esc(up.text)}</span><span class="muted small">${up.left?up.left+' more after this':''}</span></div>`:''}
  </div>`;
}
window.removeDraft=id=>act(async()=>{await api('/api/videos/'+id,{method:'DELETE'});delete Teach.D[id];if(Teach.cur===id)Teach.cur=null;},'Removed');
function dropHtml(S){
 return `<section class="teach-upload"><div class="upload-intro"><h2>Teach your studio something new</h2><p class="muted">Add a video and choose what to learn from its style, pacing, or editing.</p></div>
 <div class="ingest-modes"><h3>What do you want to learn?</h3>${modePicker(teachMode(store.get('teach-mode','motion')).id,'upload')}</div>
 <div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose videos">
  <div class="upload-symbol" aria-hidden="true">${I.film}</div>
  <h3>Drop videos here</h3><div class="muted small">or click to browse · up to ${S.can.maxMB} MB each</div>
  <div id="up">${Teach.up?`<div class="bar"><i style="width:${Teach.up.pct}%"></i></div>`:''}</div>
  <input type="file" id="file" accept="video/*,.mkv,.mov,.avi,.webm" multiple hidden></div>
 <label class="f" for="link">Or use a video link</label>
 <div class="or"><input type="url" id="link" placeholder="Paste a YouTube, TikTok, or Instagram link" aria-label="Link to a video"><button class="btn" id="linkgo">Open link</button></div>
 <div id="linkbox"></div></section>`;
}
function wireDrop(S){
 const drop=$('#drop'),file=$('#file');
 drop.onclick=()=>file.click();drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click();}};
 file.onchange=()=>uploadMany([...file.files]);
 drop.ondragover=e=>{e.preventDefault();drop.classList.add('over');};drop.ondragleave=()=>drop.classList.remove('over');
 drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');uploadMany([...e.dataTransfer.files]);};
 $('#linkgo').onclick=()=>teachLink(false);$('#link').onkeydown=e=>{if(e.key==='Enter')teachLink(false);};
 if(Teach.linkInfo)showLink();
}
async function uploadMany(files){
 if(Teach.up||!files.length)return;const S=Teach.S,big=files.filter(f=>f.size>S.can.maxMB*1048576);
 if(big.length)toast(`${big.map(f=>f.name).join(', ')} ${big.length>1?'are':'is'} over ${S.can.maxMB} MB and was skipped.`,true);
 files=files.filter(f=>f.size<=S.can.maxMB*1048576);let failed=0;
 for(let i=0;i<files.length;i++){
  const f=files[i];Teach.up={pct:0,text:'Uploading '+f.name,left:files.length-i-1};App.show(false);
  try{const uploaded=await new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('POST','/api/upload?name='+encodeURIComponent(f.name));x.setRequestHeader('x-teach-key',KEY);
   x.upload.onprogress=e=>{if(e.lengthComputable&&Teach.up){Teach.up.pct=Math.round(e.loaded/e.total*100);Teach.up.text=(Teach.up.pct>=100?'Preparing the preview of ':'Uploading ')+f.name+(Teach.up.pct<100?' '+Teach.up.pct+'%':'');const q=$('#queue');if(q)q.innerHTML=queueHtml(Teach.S.videos.filter(v=>v.status==='draft'));const b=$('#up .bar i');if(b)b.style.width=Teach.up.pct+'%';}};
   x.onload=()=>{let j={};try{j=JSON.parse(x.responseText);}catch{}x.status===200?res(j):rej(new Error(j.error||'The upload failed'));};x.onerror=()=>rej(new Error('The upload failed. Is the terminal still open?'));x.send(f);});Teach.cur=uploaded.id;Teach.addMore=false;}
  catch(e){failed++;toast(`${f.name}: ${e.message}`,true);}
  Teach.up=null;await App.refresh(true);
 }
 if(files.length>1&&failed<files.length)toast(`${files.length-failed} videos are ready to set up`);
}
async function teachLink(confirm){
 const current=Teach.linkInfo;
 if(current?.busy)return;
 const url=confirm?current?.url:$('#link').value.trim();if(!url)return;
 const selected=current?.info?.choices.find(v=>v.item===current.item);
 const request={url,confirm,...(confirm?{previewToken:current.previewToken,selection:{id:selected.id,item:selected.item}}:{})};
 const pending={...current,url,busy:true};
 try{
  Teach.linkInfo=pending;showLink();
  const r=await api('/api/link',{method:'POST',body:JSON.stringify(request)});
  if(Teach.linkInfo!==pending)return;
  if(r.status==='needs-confirmation'){Teach.linkInfo={url,info:r.info,item:r.info.item,previewToken:r.previewToken};showLink();}
  else{Teach.linkInfo=null;Teach.cur=r.video.id;Teach.addMore=false;await App.refresh(true);}
 }catch(e){if(Teach.linkInfo===pending){Teach.linkInfo=current?.info?{...current,busy:false}:null;toast(e.message,true);showLink();}}
}
window.teachLink=teachLink;
function platformEmbed(url){
 const u=new URL(url),host=u.hostname.replace(/^www\./,'');
 if(host==='youtube.com'||host==='youtu.be'){
  const id=host==='youtu.be'?u.pathname.slice(1).split('/')[0]:u.searchParams.get('v')||u.pathname.split('/')[2];
  if(/^[a-zA-Z0-9_-]{11}$/.test(id||''))return 'https://www.youtube-nocookie.com/embed/'+id;
 }
 if(host==='instagram.com'||host==='instagr.am'){
  const code=/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(u.pathname)?.[1];
  if(code)return 'https://www.instagram.com/p/'+code+'/embed/';
 }
 if(host.endsWith('tiktok.com')){const id=/\/video\/(\d+)/.exec(u.pathname)?.[1];if(id)return 'https://www.tiktok.com/player/v1/'+id;}
 if(host==='vimeo.com'){const id=/^\/(\d+)/.exec(u.pathname)?.[1];if(id)return 'https://player.vimeo.com/video/'+id;}
 return null;
}
function platformOriginal(url,item){
 const u=new URL(url);if(/(^|\.)(instagram.com|instagr.am)$/.test(u.hostname))u.searchParams.set('img_index',String(item));return u.toString();
}
window.chooseLinkVideo=value=>{Teach.linkInfo.item=Number(value);showLink();};
window.cancelLinkPreview=()=>{Teach.linkInfo=null;const box=$('#linkbox');if(box)box.replaceChildren();};
function showLink(){
 const b=$('#linkbox'),state=Teach.linkInfo;if(!b)return;
 if(!state){b.replaceChildren();return;}
 if(state.busy){b.innerHTML=`<div class="link-pending" role="status"><span class="spin"></span> ${state.info?'Downloading the selected video…':'Finding your video…'}</div>`;return;}
 const info=state.info,selected=info.choices.find(v=>v.item===state.item),embed=platformEmbed(info.page||state.url);
 const https=value=>typeof value==='string'&&value.startsWith('https://')?value:null;
 const stream=https(selected.previewUrl),poster=https(selected.thumbnail);
 const player=embed&&info.choices.length===1&&!stream?`<iframe src="${esc(embed)}" title="Preview ${esc(selected.title)}" allow="fullscreen; picture-in-picture" referrerpolicy="no-referrer" allowfullscreen></iframe>`
  :stream?`<video controls playsinline preload="none" ${poster?'poster="'+esc(poster)+'"':''} src="${esc(stream)}"></video>`
  :embed?`<iframe src="${esc(embed)}" title="Preview post" allow="fullscreen; picture-in-picture" referrerpolicy="no-referrer" allowfullscreen></iframe>`
  :poster?`<img src="${esc(poster)}" alt="Preview of ${esc(selected.title)}" referrerpolicy="no-referrer">`:'';
 b.innerHTML=`<section class="link-preview">
  ${info.choices.length>1?`<label class="f" for="link-video-choice">Choose a video from this post</label><select id="link-video-choice" onchange="chooseLinkVideo(this.value)">${info.choices.map(v=>`<option value="${v.item}" ${v.item===state.item?'selected':''}>Video ${v.item} · ${esc(v.title)}</option>`).join('')}</select>`:''}
  ${player?`<div class="link-player">${player}</div>`:''}
  <h3 dir="auto">${esc(selected.title)}</h3>
  <p class="muted small">${esc(selected.creator||info.creator||'')}${selected.duration?' · '+fmtS(selected.duration):''}${selected.approxMB?' · about '+selected.approxMB+' MB':''}</p>
  <a class="small" href="${esc(platformOriginal(state.url,state.item))}" target="_blank" rel="noopener noreferrer">Open original video</a>
  <p class="muted small">Check this is the video you want, then download it to choose the part to study.</p>
  <div class="row"><button class="btn primary" onclick="teachLink(true)">Download this video</button><button class="btn ghost" onclick="cancelLinkPreview()">Cancel</button></div>
 </section>`;
 const video=$('video',b);if(video)video.onerror=()=>{if(!$('.preview-error',b))video.insertAdjacentHTML('afterend','<p class="muted small preview-error">This preview could not play. Use Open original video to check it before downloading.</p>');};
}

async function buildTeachFilmstrip(src,container,duration,signal){
 const reader=document.createElement('video');reader.muted=true;reader.playsInline=true;reader.preload='auto';
 const wait=(event,action)=>new Promise((resolve,reject)=>{
  const finish=error=>{clearTimeout(timeout);reader.removeEventListener(event,ready);reader.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);error?reject(error):resolve();};
  const ready=()=>finish(),failed=()=>finish(new Error('Timeline frames unavailable')),aborted=()=>finish(new DOMException('Cancelled','AbortError'));
  const timeout=setTimeout(()=>failed(),8000);
  reader.addEventListener(event,ready,{once:true});reader.addEventListener('error',failed,{once:true});signal.addEventListener('abort',aborted,{once:true});
  if(signal.aborted)return aborted();
  try{action();}catch(error){finish(error);}
 });
 try{
  await wait('loadeddata',()=>{reader.src=src;reader.load();});
  const canvas=document.createElement('canvas');canvas.width=144;canvas.height=82;
  const context=canvas.getContext('2d');if(!context)throw new Error('Timeline frames unavailable');
  for(let i=0;i<8;i++){
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   const time=Math.max(0,Math.min(reader.duration-.08,duration*i/7));
   if(Math.abs(reader.currentTime-time)>.01)await wait('seeked',()=>{reader.currentTime=time;});
   const scale=Math.max(canvas.width/reader.videoWidth,canvas.height/reader.videoHeight);
   const width=reader.videoWidth*scale,height=reader.videoHeight*scale;
   context.drawImage(reader,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
   const image=document.createElement('img');image.alt='';image.src=canvas.toDataURL('image/jpeg',.7);
   container.append(image);
  }
  return true;
 }catch(error){return false;}
 finally{reader.removeAttribute('src');reader.load();}
}

function openEditor(v){
 const S=Teach.S,mode=teachMode(store.get('teach-mode','motion'));
 const d=Teach.D[v.id]??={id:v.id,sourceTitle:v.title,mode:mode.id,autoTitle:true,autoPrompt:true,fps:v.media.fps||30,seconds:v.media.seconds,w:v.media.width,h:v.media.height,audio:v.media.audio,title:v.title,verdict:'good',prompt:'',
  topics:new Set(mode.topics.filter(t=>t!=='audio'||v.media.audio)),marks:[],start:0,end:v.media.seconds,crop:null,cropOn:false,appliedCrop:null,croppedPreview:null,cropping:false,keepPlayback:v.source!=='link',sound:v.media.audio&&mode.topics.includes('audio'),speech:false,aspect:'free',sending:false};
 $('#edwrap').innerHTML=`<section class="teach-workspace">
 <header class="teach-workspace-head"><div><h2>Shape what your studio learns</h2><p class="muted">Choose a focus, find the moments that matter, and turn this reference into reusable lessons.</p></div><button class="btn" onclick="openTeachUpload()">${I.add} Add video</button></header>
 <div class="editor" id="editor" data-id="${d.id}">
 <section class="teach-preview card" aria-label="Video workspace">
  <div class="teach-section-head preview-source"><div><h3>Reference monitor</h3><p dir="auto">${esc(v.title)}</p></div><button class="iconbtn" id="fullscreen" aria-label="Full screen preview" title="Full screen preview">${ICON('<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>')}</button></div>
  <div class="stage" id="stage"><video id="v" src="${withKey('/media/'+d.id+'/'+(!d.cropOn&&d.croppedPreview?d.croppedPreview:'preview.mp4'))}" playsinline preload="metadata"></video>
   <div class="crop" id="crop"><div class="box" id="box"><i class="h nw" data-h="nw"></i><i class="h ne" data-h="ne"></i><i class="h sw" data-h="sw"></i><i class="h se" data-h="se"></i></div></div></div>
  <div class="preview-media-meta"><span id="preview-dimensions">${v.media.width} × ${v.media.height}</span><span>${Math.round(d.fps*100)/100} fps</span><span id="frame-count"></span></div>
  <div class="tools teach-transport">
   <div class="transport-playback"><button class="iconbtn" id="back" aria-label="Previous frame" title="Previous frame (Left arrow)">${ICON('<path d="M5 5v14M19 5l-10 7 10 7z"/>')}</button><button class="btn" id="play" title="Play or pause (Space)">Play</button><button class="iconbtn" id="fwd" aria-label="Next frame" title="Next frame (Right arrow)">${ICON('<path d="M19 5v14M5 5l10 7-10 7z"/>')}</button></div>
   <span class="time" id="time"></span>
   <div class="transport-options"><select id="speed" aria-label="Playback speed">${[.25,.5,.75,1,1.25,1.5,2].map(speed=>`<option value="${speed}" ${speed===1?'selected':''}>${speed}×</option>`).join('')}</select><button class="iconbtn" id="mute" aria-label="Mute preview" title="Mute preview" ${d.audio?'':'disabled'}>${ICON('<path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>')}</button></div>
  </div>
  <div class="teach-section-head teach-segment-head"><h3>Study range</h3><span id="range-duration" class="range-duration"></span></div>
  <div id="timeline-ruler" class="timeline-ruler" aria-hidden="true"></div>
  <div class="track" id="track" role="group" aria-label="Video timeline">
   <div class="timeline-filmstrip" id="filmstrip" aria-hidden="true"></div><div class="timeline-shade" id="shade-before"></div><div class="timeline-shade" id="shade-after"></div>
   <div id="seek" class="timeline-seek" role="slider" tabindex="0" aria-label="Playhead" aria-valuemin="0" aria-valuemax="${d.seconds}" aria-valuenow="0"></div>
   <div class="sel" id="sel"></div><div class="grip" id="g0" role="slider" tabindex="0" aria-label="Study start" aria-valuemin="0" aria-valuemax="${d.end}" aria-valuenow="${d.start}"></div><div class="grip" id="g1" role="slider" tabindex="0" aria-label="Study end" aria-valuemin="${d.start}" aria-valuemax="${d.seconds}" aria-valuenow="${d.end}"></div><div id="mks"></div><div class="head" id="head"></div>
  </div>
  <p id="filmstrip-status" class="muted small">Preparing timeline frames…</p>
  <div class="range-preview-actions"><button class="btn" id="preview-range">Play selection</button><button class="btn" id="loop" aria-pressed="false" title="Repeat the selected range">${ICON('<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3"/>')} Loop</button><button class="btn ghost" id="whole">Whole clip</button></div>
  <div class="teach-range-fields"><label>In<input type="number" id="range-in" min="0" max="${d.seconds}" step="0.01" value="${d.start.toFixed(2)}"></label><label>Out<input type="number" id="range-out" min="0.5" max="${d.seconds}" step="0.01" value="${d.end.toFixed(2)}"></label><button class="btn small" id="first5">First 5 s</button><button class="btn small" id="first10">First 10 s</button></div>
  <div class="muted small" id="partinfo"></div>
  <div class="tools teach-edit-tools"><button class="btn small" id="setin" title="Start the part to study here (I)">Start here</button><button class="btn small" id="setout" title="End the part to study here (O)">End here</button><button class="btn small" id="mark" title="Mark this moment (M)">${I.add} Add moment</button><button class="btn small ghost" id="cropbtn">Crop frame</button></div>
  <div id="aspects" hidden>${['free','9:16','1:1','16:9','4:5'].map(a=>`<button class="btn small" data-a="${a}">${a==='free'?'Free':a}</button>`).join(' ')}</div>
  <div class="crop-apply-actions" id="crop-actions" hidden><p class="muted small">Position the frame, then apply the crop to preview the result.</p><div><button class="btn primary" id="apply-crop">Apply crop</button><button class="btn ghost" id="cancel-crop">Cancel crop</button></div></div>
  <div class="crop-result"><span id="crop-status" role="status"></span><button class="btn ghost" id="reset-crop" hidden>Reset crop</button></div>
  <ul class="marks" id="marks"></ul>
  <p class="teach-preview-note muted small">Mark a moment to guide the study. Trim or crop to keep attention on the part you care about.</p>
 </section>
 <section class="teach-settings card" aria-label="Learning setup">
  <div class="teach-section-head"><h3>Learning setup</h3></div>
  <label class="f">Learning mode</label>${modePicker(d.mode,'editor')}
  <details class="teach-focus"><summary>Refine the focus <span id="focus-count">${d.topics.size} selected</span></summary><div id="topics" class="focus-chips" role="group" aria-label="Learning focus">${S.topics.map(t=>`<button type="button" data-topic="${t.id}" ${t.id==='audio'&&!d.audio?'disabled title="This video has no audio track"':''} aria-pressed="${d.topics.has(t.id)}">${esc(t.label)}</button>`).join('')}</div><p class="muted small">Selected topics shape the lessons. Change only what matters for this reference.</p></details>
  <fieldset class="teach-example"><legend>How should this example guide the studio?</legend><div class="example-choices">
   <label><input type="radio" name="example" id="vgood" value="good" ${d.verdict==='good'?'checked':''}><span><b>Learn from it</b><small>Keep the techniques that work.</small></span></label>
   <label><input type="radio" name="example" id="vbad" value="bad" ${d.verdict==='bad'?'checked':''}><span><b>Learn what to avoid</b><small>Understand what needs to change.</small></span></label>
  </div></fieldset>
  <div class="teach-field-head"><label class="f" for="study-title">Reference title</label><label class="teach-auto"><input type="checkbox" id="auto-title" role="switch" ${d.autoTitle?'checked':''}> Auto name</label></div>
  <input type="text" id="study-title" dir="auto" maxlength="120" value="${esc(d.title)}">
  <div class="teach-field-head"><label class="f" for="prompt">Study direction</label><label class="teach-auto"><input type="checkbox" id="auto-prompt" role="switch" ${d.autoPrompt?'checked':''}> Auto compose</label></div>
  <textarea id="prompt" dir="auto" maxlength="2000" placeholder="What should the studio notice?">${esc(d.prompt)}</textarea>
  <p class="teach-prompt-hint muted small">Built from your focus and selected range. Edit it to add your own direction.</p>
  <details class="teach-options"><summary>Audio & library settings</summary>
   <label class="teach-setting" ${d.audio?'':'hidden'}><span><b>Study the soundtrack</b><small>Tempo, sound design, and cuts on the beat.</small></span><input type="checkbox" role="switch" id="sound" ${d.sound?'checked':''}></label>
   <label class="teach-setting" ${d.audio&&S.can.speech?'':'hidden'}><span><b>Transcribe speech</b><small>Uses your ElevenLabs account.</small></span><input type="checkbox" role="switch" id="speech" ${d.speech?'checked':''} ${d.sound?'':'disabled'}></label>
   <label class="teach-setting"><span><b>Keep a playable copy</b><small>Watch the studied clip in your library.</small></span><input type="checkbox" role="switch" id="keepPlayback" ${d.keepPlayback?'checked':''}></label>
  </details>
  <footer class="teach-submit"><p class="muted small" id="learning-summary" aria-live="polite"></p><div><button class="btn ghost danger-text" id="cancel">Remove video</button><button class="btn primary" id="send">Teach this video ${I.lesson}</button></div></footer>
 </section></div></section>`;
 setupEditor(d);syncTeachLearning(d);
}
function setupEditor(d){
 const v=$('#v'),track=$('#track'),stage=$('#stage'),box=$('#box'),crop=$('#crop');
 const fps=d.fps;let loop=false,selectionPlayback=false,frameRequest=null;
 let filmController=new AbortController();
 const refreshFilmstrip=()=>{
  filmController.abort();filmController=new AbortController();
  const signal=filmController.signal,container=$('#filmstrip'),status=$('#filmstrip-status');
  container.replaceChildren();status.hidden=false;status.textContent='Preparing timeline frames…';
  buildTeachFilmstrip(v.src,container,d.seconds,signal).then(ready=>{
   if(signal.aborted)return;
   status.textContent=ready?'':'Timeline frames unavailable. You can still scrub and trim the clip.';
   status.hidden=ready;
  });
 };
 Teach.ed={video:v,dispose:()=>filmController.abort()};
 refreshFilmstrip();
 let restoreTime=null;
 const loadPreview=name=>{
  restoreTime=v.currentTime;v.pause();v.src=withKey('/media/'+d.id+'/'+name);v.load();refreshFilmstrip();
 };
 const frac=t=>Math.max(0,Math.min(1,t/d.seconds));
 const updatePlayhead=()=>{
  if(!v.isConnected)return;
  $('#head').style.left=frac(v.currentTime)*100+'%';
  $('#time').textContent=fmtT(v.currentTime)+' / '+fmtT(d.seconds);
  $('#frame-count').textContent='Frame '+Math.min(Math.max(1,Math.round(v.currentTime*fps)+1),Math.ceil(d.seconds*fps))+' / '+Math.ceil(d.seconds*fps);
  $('#seek').setAttribute('aria-valuenow',v.currentTime.toFixed(3));
  $('#seek').setAttribute('aria-valuetext',fmtT(v.currentTime));
 };
 const paint=()=>{
  if(!v.isConnected||$('#editor')?.dataset.id!==d.id)return;
  $('#sel').style.left=frac(d.start)*100+'%';$('#sel').style.width=(frac(d.end)-frac(d.start))*100+'%';
  $('#g0').style.left=frac(d.start)*100+'%';$('#g1').style.left=frac(d.end)*100+'%';updatePlayhead();
  $('#shade-before').style.width=frac(d.start)*100+'%';$('#shade-after').style.left=frac(d.end)*100+'%';
  $('#range-duration').textContent=(d.end-d.start).toFixed(2)+' s selected';
  for(const [id,value,min,max] of [['seek',v.currentTime,0,d.seconds],['g0',d.start,0,Math.max(0,d.end-.5)],['g1',d.end,Math.min(d.seconds,d.start+.5),d.seconds]]){
   const slider=$('#'+id);slider.setAttribute('aria-valuenow',value.toFixed(3));slider.setAttribute('aria-valuemin',String(min));slider.setAttribute('aria-valuemax',String(max));slider.setAttribute('aria-valuetext',fmtT(value));
  }
  $('#loop').setAttribute('aria-pressed',String(loop));
  $('#mute').setAttribute('aria-pressed',String(v.muted));
  $('#mute').setAttribute('aria-label',!d.audio?'No audio track':v.muted?'Unmute preview':'Mute preview');
  $('#mks').innerHTML=d.marks.map(m=>`<i class="mk" style="left:${frac(m.t)*100}%"></i>`).join('');
  const whole=d.start<=.01&&d.end>=d.seconds-.01;
  $('#partinfo').textContent=(whole?'Studying the whole video':'Studying '+fmtT(d.start)+' to '+fmtT(d.end))+' ('+(d.end-d.start).toFixed(1)+' s)'+(d.appliedCrop?', crop applied':'');
  $('#vgood').checked=d.verdict==='good';$('#vbad').checked=d.verdict==='bad';
  $('#loop').classList.toggle('on',loop);$('#cropbtn').classList.toggle('on',d.cropOn);$('#aspects').hidden=!d.cropOn;
  $('#crop-actions').hidden=!d.cropOn;$('#reset-crop').hidden=!d.appliedCrop||d.cropOn;
  $('#cropbtn').textContent=d.appliedCrop?'Adjust crop':'Crop frame';
  for(const id of ['cropbtn','apply-crop','cancel-crop','reset-crop'])$('#'+id).disabled=!!d.cropping;
  $('#cropbtn').disabled=d.cropping||d.cropOn;
  $('#aspects').inert=!!d.cropping;
  $('#apply-crop').textContent=d.cropping?'Applying crop…':'Apply crop';
  $('#crop-status').textContent=d.cropping?'Preparing the cropped video…':d.appliedCrop&&!d.cropOn?'Crop applied':'';
  $('#preview-dimensions').textContent=d.cropOn||!d.appliedCrop?d.w+' × '+d.h:d.cropMedia.width+' × '+d.cropMedia.height;
  document.querySelectorAll('#aspects button').forEach(b=>b.classList.toggle('on',b.dataset.a===d.aspect));
  $('#play').innerHTML=(v.paused?ICON('<path d="m8 5 11 7-11 7z"/>'):ICON('<path d="M8 5v14M16 5v14"/>'))+'<span>'+(v.paused?'Play':'Pause')+'</span>';
  if(document.activeElement!==$('#range-in'))$('#range-in').value=d.start.toFixed(2);
  if(document.activeElement!==$('#range-out'))$('#range-out').value=d.end.toFixed(2);
 };
 const marks=()=>{$('#marks').innerHTML=d.marks.map((m,i)=>`<li><button class="btn small ghost t" data-go="${i}" title="Go to this moment">${fmtT(m.t)}</button><input type="text" dir="auto" maxlength="200" placeholder="What happens here? (for example: this transition)" value="${esc(m.note)}" data-note="${i}" aria-label="Note for the mark at ${fmtT(m.t)}"><button class="iconbtn" data-del="${i}" aria-label="Remove this mark">${I.x}</button></li>`).join('');};
 $('#marks').onclick=e=>{const g=e.target.dataset.go,x=e.target.closest('[data-del]')?.dataset.del;if(g!==undefined){v.currentTime=d.marks[g].t;}if(x!==undefined){d.marks.splice(x,1);marks();paint();syncTeachLearning(d);}};
 $('#marks').oninput=e=>{const n=e.target.dataset.note;if(n!==undefined){d.marks[n].note=e.target.value;syncTeachLearning(d);}};
 const checkBoundary=()=>{
  if(!v.paused){
   if(loop&&(v.currentTime>=d.end||v.currentTime<d.start-.05))v.currentTime=d.start;
   else if(selectionPlayback&&v.currentTime>=d.end){v.pause();v.currentTime=d.end;selectionPlayback=false;}
  }
 };
 const watchPlayback=()=>{
  if(v.paused||!v.requestVideoFrameCallback||frameRequest!==null)return;
  frameRequest=v.requestVideoFrameCallback(()=>{frameRequest=null;checkBoundary();updatePlayhead();watchPlayback();});
 };
 v.ontimeupdate=()=>{checkBoundary();paint();};
 v.onplay=()=>{watchPlayback();paint();};
 v.onpause=()=>{if(frameRequest!==null){v.cancelVideoFrameCallback(frameRequest);frameRequest=null;}paint();};
 v.onseeked=v.onvolumechange=paint;
 v.onended=()=>{if(loop){v.currentTime=d.start;toggle();}else paint();};
 v.onloadedmetadata=()=>{
  if(!d.appliedCrop&&isFinite(v.duration)&&v.duration>0){d.seconds=v.duration;d.end=Math.min(d.end,v.duration)||v.duration;}
  if(restoreTime!==null){v.currentTime=Math.min(restoreTime,Math.max(0,v.duration-.01));restoreTime=null;}
  paint();layoutCrop();syncTeachLearning(d);
 };
 v.onerror=()=>toast('The preview could not be played. Remove it and upload the video again.',true);
 const toggle=()=>{
  if(v.paused){
   if(loop&&(v.currentTime>=d.end||v.currentTime<d.start))v.currentTime=d.start;
   v.play().catch(error=>{if(error.name!=='AbortError'&&!v.error)toast('The preview could not start. Try playing it again.',true);});
  }else v.pause();
 };
 $('#play').onclick=()=>{selectionPlayback=false;toggle();};v.onclick=()=>{if(!d.cropOn&&!v.controls){selectionPlayback=false;toggle();}};
 $('#preview-range').onclick=()=>{v.pause();v.currentTime=d.start;selectionPlayback=true;toggle();};
 $('#mute').onclick=()=>{v.muted=!v.muted;paint();};
 stage.onfullscreenchange=()=>{v.controls=document.fullscreenElement===stage;crop.hidden=v.controls;layoutCrop();};
 $('#fullscreen').onclick=async()=>{
  try{if(document.fullscreenElement===stage)await document.exitFullscreen();else await stage.requestFullscreen();}
  catch{toast('Full screen is unavailable in this browser.',true);}
 };
 const stepF=n=>{v.pause();v.currentTime=Math.max(0,Math.min(d.seconds,v.currentTime+n/fps));};
 $('#back').onclick=()=>stepF(-1);$('#fwd').onclick=()=>stepF(1);
 $('#speed').onchange=e=>{v.playbackRate=Number(e.target.value);};
 $('#loop').onclick=()=>{loop=!loop;paint();};
 $('#timeline-ruler').innerHTML=[0,.25,.5,.75,1].map(part=>'<span>'+fmtS(d.seconds*part)+'</span>').join('');
 $('#setin').onclick=()=>{d.start=Math.max(0,Math.min(v.currentTime,d.end-.5));paint();syncTeachLearning(d);};
 $('#setout').onclick=()=>{d.end=Math.min(d.seconds,Math.max(v.currentTime,d.start+.5));paint();syncTeachLearning(d);};
 $('#whole').onclick=()=>{d.start=0;d.end=d.seconds;paint();syncTeachLearning(d);};
 $('#first5').onclick=()=>{d.start=0;d.end=Math.min(5,d.seconds);paint();syncTeachLearning(d);};
 $('#first10').onclick=()=>{d.start=0;d.end=Math.min(10,d.seconds);paint();syncTeachLearning(d);};
 $('#range-in').onchange=e=>{const value=Number(e.target.value);d.start=Number.isFinite(value)?Math.max(0,Math.min(d.end-.5,value)):d.start;e.target.value=d.start.toFixed(2);paint();syncTeachLearning(d);};
 $('#range-out').onchange=e=>{const value=Number(e.target.value);d.end=Number.isFinite(value)?Math.min(d.seconds,Math.max(d.start+.5,value)):d.end;e.target.value=d.end.toFixed(2);paint();syncTeachLearning(d);};
 $('#mark').onclick=()=>{if(d.marks.length>=12)return toast('At most 12 marks.',true);d.marks.push({t:Math.round(v.currentTime*100)/100,note:''});d.marks.sort((a,b)=>a.t-b.t);marks();paint();syncTeachLearning(d);};
 let drag=null;
 const at=e=>{const r=track.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*d.seconds;};
 const move=e=>{if(!drag)return;const t=at(e);if(drag==='in')d.start=Math.max(0,Math.min(t,d.end-.5));else if(drag==='out')d.end=Math.min(d.seconds,Math.max(t,d.start+.5));v.currentTime=drag==='out'?d.end:drag==='in'?d.start:t;paint();};
 track.onpointerdown=e=>{track.setPointerCapture(e.pointerId);drag=e.target.id==='g0'?'in':e.target.id==='g1'?'out':'seek';selectionPlayback=false;v.pause();move(e);};
 track.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();v.pause();selectionPlayback=false;
  const id=e.target.id,current=id==='g0'?d.start:id==='g1'?d.end:v.currentTime;
  const delta=e.shiftKey?1:1/fps;
  const time=e.key==='Home'?0:e.key==='End'?d.seconds:current+(e.key==='ArrowLeft'?-delta:delta);
  if(id==='g0'){d.start=Math.max(0,Math.min(d.end-.5,time));v.currentTime=d.start;}
  else if(id==='g1'){d.end=Math.min(d.seconds,Math.max(d.start+.5,time));v.currentTime=d.end;}
  else v.currentTime=Math.max(0,Math.min(d.seconds,time));
  paint();syncTeachLearning(d);
 };
 track.onpointermove=move;track.onpointerup=track.onpointercancel=()=>{drag=null;syncTeachLearning(d);};
 const rect=()=>{const s=stage.getBoundingClientRect(),r=v.getBoundingClientRect();return {l:r.left-s.left,t:r.top-s.top,w:r.width,h:r.height};};
 function layoutCrop(){
  const width=v.videoWidth||d.w,height=v.videoHeight||d.h;
  const scale=Math.min(stage.clientWidth/width,stage.clientHeight/height);
  v.style.width=width*scale+'px';v.style.height=height*scale+'px';
  crop.classList.toggle('on',d.cropOn);if(!d.cropOn||!d.crop)return;const r=rect();
  Object.assign(box.style,{left:r.l+d.crop.x*r.w+'px',top:r.t+d.crop.y*r.h+'px',width:d.crop.w*r.w+'px',height:d.crop.h*r.h+'px'});}
 const ratio=()=>{if(d.aspect==='free')return null;const [a,b]=d.aspect.split(':').map(Number);return (a/b)/(d.w/d.h);};
 const fit=()=>{const k=ratio();if(!k)return;let w=d.crop.w,h=w/k;if(h>1){h=1;w=k;}if(w>1){w=1;h=1/k;}const cx=d.crop.x+d.crop.w/2,cy=d.crop.y+d.crop.h/2;
  d.crop={w,h,x:Math.max(0,Math.min(1-w,cx-w/2)),y:Math.max(0,Math.min(1-h,cy-h/2))};};
 $('#cropbtn').onclick=()=>{
  d.cropOn=true;d.crop=d.appliedCrop?{...d.appliedCrop}:(d.crop??{x:.1,y:.1,w:.8,h:.8});
  fit();loadPreview('preview.mp4');paint();layoutCrop();syncTeachLearning(d);
 };
 $('#cancel-crop').onclick=()=>{
  d.cropOn=false;d.crop=d.appliedCrop?{...d.appliedCrop}:null;d.aspect=d.appliedAspect??'free';
  loadPreview(d.croppedPreview??'preview.mp4');paint();layoutCrop();syncTeachLearning(d);
 };
 $('#reset-crop').onclick=()=>{
  d.cropOn=false;d.crop=null;d.appliedCrop=null;d.croppedPreview=null;d.appliedAspect=null;d.aspect='free';
  loadPreview('preview.mp4');paint();layoutCrop();syncTeachLearning(d);
 };
 $('#apply-crop').onclick=async()=>{
  if(d.cropping)return;
  const chosen={...d.crop},aspect=d.aspect;d.cropping=true;paint();syncTeachLearning(d);
  try{
   const result=await api('/api/videos/'+d.id+'/crop',{method:'POST',body:JSON.stringify(chosen)});
   d.appliedCrop=result.crop;d.crop={...result.crop};d.croppedPreview=result.name;d.cropMedia=result.media;d.appliedAspect=aspect;d.cropOn=false;
   if(v.isConnected&&$('#editor')?.dataset.id===d.id){loadPreview(result.name);layoutCrop();}
  }catch(error){toast(error.message,true);}
  finally{
   d.cropping=false;
   if(v.isConnected&&$('#editor')?.dataset.id===d.id){paint();syncTeachLearning(d);}
   else if(App.route==='teach/add'&&$('#editor')?.dataset.id===d.id)App.show(true);
  }
 };
 $('#aspects').onclick=e=>{const a=e.target.dataset.a;if(!a)return;d.aspect=a;if(a==='free')d.crop={x:.1,y:.1,w:.8,h:.8};else{d.crop={x:0,y:0,w:1,h:1};fit();}paint();layoutCrop();};
 let cd=null;
 box.onpointerdown=e=>{if(d.cropping)return;e.preventDefault();box.setPointerCapture(e.pointerId);cd={h:e.target.dataset.h||'move',x:e.clientX,y:e.clientY,c:{...d.crop}};};
 box.onpointermove=e=>{if(!cd||d.cropping)return;const r=rect(),dx=(e.clientX-cd.x)/r.w,dy=(e.clientY-cd.y)/r.h,c=cd.c,k=ratio(),min=.1;let x=c.x,y=c.y,w=c.w,h=c.h;
  if(cd.h==='move'){x=Math.max(0,Math.min(1-w,c.x+dx));y=Math.max(0,Math.min(1-h,c.y+dy));}
  else{const L=cd.h.includes('w'),Tp=cd.h.includes('n');
   let x0=L?Math.max(0,Math.min(c.x+c.w-min,c.x+dx)):c.x,x1=L?c.x+c.w:Math.max(c.x+min,Math.min(1,c.x+c.w+dx));
   let y0=Tp?Math.max(0,Math.min(c.y+c.h-min,c.y+dy)):c.y,y1=Tp?c.y+c.h:Math.max(c.y+min,Math.min(1,c.y+c.h+dy));
   w=x1-x0;h=y1-y0;
   if(k){h=w/k;if(Tp?(y1-h<0):(y0+h>1)){h=Tp?y1:1-y0;w=h*k;}if(Tp)y0=y1-h;else y1=y0+h;if(L)x0=x1-w;}
   x=x0;y=y0;}
  d.crop={x,y,w,h};layoutCrop();paint();};
 box.onpointerup=box.onpointercancel=()=>{cd=null;};
 const resize=new ResizeObserver(layoutCrop);resize.observe(stage);Teach.ed.dispose=()=>{
  filmController.abort();resize.disconnect();
  if(frameRequest!==null)v.cancelVideoFrameCallback(frameRequest);
  v.onplay=v.onpause=v.onseeked=v.ontimeupdate=v.onended=v.onloadedmetadata=v.onvolumechange=v.onerror=null;
  stage.onfullscreenchange=null;
 };layoutCrop();
 $('#keepPlayback').onchange=e=>d.keepPlayback=e.target.checked;
 $('#auto-title').onchange=e=>{d.autoTitle=e.target.checked;syncTeachLearning(d);};
 $('#auto-prompt').onchange=e=>{d.autoPrompt=e.target.checked;syncTeachLearning(d);};
 $('#study-title').oninput=e=>{d.autoTitle=false;d.title=e.target.value;syncTeachLearning(d);};
 $('#prompt').oninput=e=>{d.autoPrompt=false;d.prompt=e.target.value;syncTeachLearning(d);};
 $('#vgood').onchange=()=>{d.verdict='good';syncTeachLearning(d);};
 $('#vbad').onchange=()=>{d.verdict='bad';syncTeachLearning(d);};
 $('#topics').onclick=e=>{
  const button=e.target.closest('[data-topic]');if(!button)return;
  const id=button.dataset.topic;d.topics.has(id)?d.topics.delete(id):d.topics.add(id);
  if(id==='audio'){
   d.sound=d.audio&&d.topics.has('audio');
   if(!d.sound)d.speech=false;
   $('#sound').checked=d.sound;$('#speech').checked=d.speech;$('#speech').disabled=!d.sound;
  }
  syncTeachLearning(d);
 };
 $('#sound').onchange=e=>{
  d.sound=e.target.checked;
  if(d.sound)d.topics.add('audio');else{d.topics.delete('audio');d.speech=false;$('#speech').checked=false;}
  $('#speech').disabled=!d.sound;syncTeachLearning(d);
 };
 $('#speech').onchange=e=>{d.speech=e.target.checked;};
 $('#cancel').onclick=async()=>{if(await ask('Remove this reference?','The uploaded copy and this study setup will be removed.','Remove video',true))removeDraft(d.id);};
 $('#send').onclick=async()=>{
  if(d.sending||d.cropping||d.cropOn)return;
  syncTeachLearning(d);
  if(!d.title.trim())return toast('Give the video a name.',true);
  if(!d.topics.size)return toast('Choose at least one learning focus.',true);
  const whole=d.start<=.01&&d.end>=d.seconds-.01,c=d.appliedCrop??null;
  const body={keepPlayback:d.keepPlayback,title:d.title.trim(),verdict:d.verdict,prompt:d.prompt.trim(),topics:[...d.topics],marks:d.marks.filter(m=>whole||m.t>=d.start&&m.t<=d.end).map(m=>({t:m.t,note:m.note.trim()})),
   segment:whole?null:{start:Math.round(d.start*1000)/1000,end:Math.round(d.end*1000)/1000},crop:c?{x:c.x,y:c.y,w:c.w,h:c.h}:null,sound:d.audio&&d.sound,speech:d.audio&&d.sound&&d.speech};
  const editor=Teach.ed;
  d.sending=true;$('#send').disabled=true;
  try{
   v.pause();await api('/api/videos/'+d.id+'/teach',{method:'POST',body:JSON.stringify(body)});
   store.set('teach-topics',[...d.topics]);delete Teach.D[d.id];
   editor?.dispose?.();
   if(Teach.ed===editor)Teach.ed=null;
   if(Teach.cur===d.id)Teach.cur=null;
   toast('Sent. It is being measured.');await App.refresh(true);
   if(App.route==='teach/add'&&!Teach.S.videos.some(x=>x.status==='draft'))App.go('teach/library');
  }catch(e){
   d.sending=false;
   syncTeachLearning(d);
   toast(e.message,true);
  }
 };
 marks();paint();
}
window.addEventListener('hashchange',()=>{
 if(!location.hash.startsWith('#/teach/add')){
  $('#view').classList.remove('teach-editor-view');
  if(Teach.ed){Teach.ed.video.pause();Teach.ed.dispose?.();Teach.ed=null;}
 }
});
document.addEventListener('keydown',e=>{
 if(App.route!=='teach/add'||!Teach.ed||Teach.ed.video.controls||$('#modal').innerHTML||/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName))return;
 const b={' ':'#play',arrowleft:'#back',arrowright:'#fwd',i:'#setin',o:'#setout',m:'#mark'}[e.key.toLowerCase()];
 if(b&&$(b)){e.preventDefault();$(b).click();}
});

// ---------- lessons (shared pieces) ----------
function lessonHtml(l,ctx=''){
 const gone=l.status==='rejected'||l.status==='retired';
 const st=l.status==='trial'?'<span class="badge wait">on trial</span>':gone?'<span class="badge st">removed</span>':`<span class="badge good">${l.status==='proven'?'proven':'kept'}</span>`;
 const id=esc(l.id),key=ctx+l.id;
 if(Teach.editing===key)return `<div class="lesson" id="edit-${esc(key)}"><textarea id="et" dir="auto" maxlength="1500">${esc(l.body)}</textarea><div class="row" style="margin-top:8px"><button class="btn small primary" onclick="saveLesson('${id}')">Save and keep</button><button class="btn small ghost" onclick="Teach.editing=null;App.show(false)">Cancel</button></div></div>`;
 return `<div class="lesson ${gone?'removed':''} ${l.conflictWith&&l.status==='trial'?'conflict':''}">
  <div class="row">${st}${l.kind==='avoid'?'<span class="badge bad">avoid</span>':''}${l.mine?'<span class="chip">written by you</span>':''}${l.topics.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}
   <span class="muted small" style="margin-left:auto">${l.videos>1?`seen in ${l.videos} videos, `:''}${l.uses?`used ${l.uses}×, `:''}${l.wins||l.losses?`${l.wins} good ${l.losses} bad, `:''}confidence ${l.confidence}%</span></div>
  <div class="body" dir="auto">${esc(l.body)}</div>
  <div class="row">${l.status==='trial'?`<button class="btn small" onclick="lessonDo('${id}','${l.conflictWith?'both':'keep'}','Kept')">Keep</button>`:''}
   ${gone?`<button class="btn small" onclick="lessonDo('${id}','both','Brought back')">Bring back</button>`:`<button class="btn small ghost" onclick="Teach.editing='${esc(key)}';App.show(false)">Reword</button><button class="btn small ghost" onclick="lessonDo('${id}','remove','Removed')">Remove</button>`}</div></div>`;
}
window.lessonDo=(id,action,done)=>act(()=>api('/api/lessons/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({action})}),done);
window.saveLesson=id=>act(async()=>{const body=$('#et').value;await api('/api/lessons/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({action:'edit',body,title:body.split(/(?<=[.!?])\s/)[0].slice(0,100)})});Teach.editing=null;},'Saved');

// ---------- library ----------
function chips(m,speech){
 if(!m)return '';const c=[];
 c.push(`<b>${fmtS(m.media.seconds)}</b> ${m.media.shape}`);
 c.push(m.pacing.cuts>=2?`shots <b>${m.pacing.shotMedian} s</b>`:'<b>one continuous piece</b>');
 c.push(`motion <b>${word(m.motion.energy,[[1,'calm'],[2.5,'gentle'],[5,'lively'],[1e9,'very busy']])}</b>`);
 c.push(`<b>${word(m.color.brightness,[[.3,'dark'],[.7,'mid'],[9,'light']])}</b>, ${word(m.color.saturation,[[.2,'muted'],[.5,'coloured'],[9,'vivid']])}`);
 if(m.sound&&m.sound.tempoConfidence>=.25)c.push(`<b>${m.sound.bpm} BPM</b>`);
 if(speech)c.push(`<b>${speech.wordsPerSecond}</b> words/s`);
 return `<div class="chips">${c.map(x=>`<span class="chip">${x}</span>`).join('')}</div>`;
}
const cutStrip=m=>m&&m.pacing.cutTimes.length?`<div class="cuts" role="img" aria-label="${m.pacing.cuts} cuts across ${fmtS(m.media.seconds)}">${m.pacing.cutTimes.map(t=>`<i style="left:${t/m.media.seconds*100}%"></i>`).join('')}</div>`:'';
const palette=m=>m?`<div class="pal" role="img" aria-label="The main colours">${m.color.palette.map(p=>`<i style="width:${Math.max(4,p.share*100)}%;background:${esc(p.hex)}" title="${esc(p.hex)}"></i>`).join('')}</div>`:'';
const statusBadge=v=>v.status==='measuring'?`<span class="badge st"><span class="spin"></span> ${esc(v.step||'Measuring')}</span>`:v.status==='waiting'?'<span class="badge wait">waiting for the agent</span>':v.status==='failed'?'<span class="badge bad">failed</span>':'<span class="badge st">learned</span>';
App.register('teach/library',{
 head:a=>a?{title:Teach.S?.videos.find(v=>v.id===a)?.title||'Video',text:'What this reference measured, what it taught, and the videos most like it.'}:{title:'Everything you have taught',text:'Search, filter and compare your references, or open one to see what it measured and taught.'},
 title:a=>a?(Teach.S?.videos.find(v=>v.id===a)?.title||'Video'):'Library',sub:a=>a?'':'Every video you taught',load:Teach.load,
 actions:a=>a?`<a class="btn small ghost" href="#/teach/library">All videos</a>`:`${Teach.picked.size===2?'<button class="btn small primary" onclick="compareVideos()">Compare the 2</button>':Teach.picked.size?`<span class="muted small">${Teach.picked.size} picked, pick 2 to compare</span>`:''}<a class="btn small primary" href="#/teach/add">Teach a video</a>`,
 render(el,arg){
  const S=this.data,all=S.videos.filter(v=>v.status!=='draft');
  if(arg){const v=all.find(x=>x.id===arg);el.innerHTML=v?videoDetail(v):`<div class="empty"><h2>This video is not in the library</h2><a class="btn" href="#/teach/library">Back to the library</a></div>`;return;}
  if(!all.length){el.innerHTML=`<div class="empty"><h2>No videos taught yet</h2><p>Teach the first one and it appears here with what it measured and taught.</p><a class="btn primary" href="#/teach/add">Teach a video</a></div>`;return;}
  const f=Teach.lib,q=f.q.trim().toLowerCase();
  let list=all.filter(v=>(f.verdict==='all'||v.verdict===f.verdict)&&(f.status==='all'||(f.status==='waiting'?v.status!=='learned':v.status==='learned'))&&(f.topic==='all'||v.topics.includes(f.topic))
   &&(!q||v.title.toLowerCase().includes(q)||v.prompt.toLowerCase().includes(q)||v.lessons.some(l=>l.body.toLowerCase().includes(q))));
  const key={new:v=>-new Date(v.created),lessons:v=>-v.lessons.length,long:v=>-(v.media?.seconds||0),name:v=>v.title.toLowerCase()}[f.sort];
  list=list.slice().sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0);
  const opt=(id,pairs)=>`<select data-f="${id}" aria-label="${id}">${pairs.map(([v,l])=>`<option value="${v}"${f[id]===v?' selected':''}>${l}</option>`).join('')}</select>`;
  el.innerHTML=`<div class="toolbar"><div class="search">${I.search}<input type="text" id="libq" placeholder="Search titles, prompts and lessons" value="${esc(f.q)}" aria-label="Search the library"></div>
   ${opt('verdict',[['all','Good and bad'],['good','Good examples'],['bad','Bad examples']])}${opt('status',[['all','Any state'],['learned','Learned'],['waiting','Waiting']])}
   ${opt('topic',[['all','Any topic'],...S.topics.map(t=>[t.id,esc(t.label)])])}${opt('sort',[['new','Newest first'],['lessons','Most lessons'],['long','Longest'],['name','By name']])}</div>
  <div class="muted small" style="margin-bottom:10px">${list.length} of ${all.length} videos</div>
  ${list.length?`<div class="grid">${list.map(v=>{const id=esc(v.id);return `<div class="card vid">
   <a href="#/teach/library/${id}">${v.hasThumb?`<img class="thumb" alt="" src="${withKey('/media/'+id+'/thumb.jpg')}">`:'<div class="thumb"></div>'}</a>
   <div><div class="row"><h3 dir="auto"><a href="#/teach/library/${id}" style="color:inherit;text-decoration:none">${esc(v.title)}</a></h3><span class="badge ${v.verdict}">${v.verdict==='good'?'good example':'bad example'}</span>${statusBadge(v)}
     ${v.measured?`<label class="muted small" style="margin-left:auto;display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" class="pickbox" ${Teach.picked.has(v.id)?'checked':''} onchange="pickVideo('${id}',this.checked)"> Compare</label>`:''}</div>
    <div class="muted small" style="margin-top:4px">${ago(v.created)}, learning ${v.topics.length} topic${v.topics.length===1?'':'s'}, ${v.lessons.length} lesson${v.lessons.length===1?'':'s'}</div>
    ${v.error?`<div class="err">${esc(v.error)}</div>`:''}${chips(v.measured,v.speech)}${cutStrip(v.measured)}
    ${v.status==='waiting'?`<div class="say"><b>Your agent has not looked at it yet.</b> Tell it “study the videos I taught”.</div>`:''}
    <div class="row" style="margin-top:12px"><a class="btn small" href="#/teach/library/${id}">Details</a>
     ${v.status==='waiting'?`<button class="btn small" onclick="finishVideo('${id}')">Finish now</button>`:''}
     ${v.status!=='measuring'?`<button class="btn small ghost" onclick="forgetVideo('${id}','${v.status}')">${v.status==='learned'?'Forget':'Remove'}</button>`:''}</div></div></div>`;}).join('')}</div>`
   :`<div class="empty"><h2>Nothing matches</h2><button class="btn" onclick="Teach.lib={q:'',verdict:'all',status:'all',topic:'all',sort:'new'};App.show(false)">Clear the filters</button></div>`}`;
  const qi=$('#libq');qi.oninput=()=>{f.q=qi.value;store.set('teach-lib',f);clearTimeout(Teach.qt);Teach.qt=setTimeout(()=>{App.show(false);const n=$('#libq');n.focus();n.setSelectionRange(n.value.length,n.value.length);},250);};
  el.querySelectorAll('[data-f]').forEach(s=>s.onchange=()=>{f[s.dataset.f]=s.value;store.set('teach-lib',f);App.show(false);});
 }});
window.pickVideo=(id,on)=>{on?Teach.picked.add(id):Teach.picked.delete(id);if(Teach.picked.size>2){const first=[...Teach.picked][0];Teach.picked.delete(first);}App.show(false);};
window.finishVideo=async id=>{if(await ask('Finish without the agent?','This saves the measurements and finishes the study without writing lessons.','Finish study'))act(()=>api('/api/videos/'+id+'/finish',{method:'POST'}),'Study finished.');};
window.forgetVideo=async(id,status)=>{if(status==='learned'&&!await ask('Forget this video?','Its measurements go, and the lessons that came only from it and were never used.','Forget it',true))return;
 act(async()=>{await api('/api/videos/'+id,{method:'DELETE'});Teach.picked.delete(id);if(App.arg===id)App.go('teach/library');},status==='learned'?'Forgotten':'Removed');};
window.renameTaught=id=>{
 const v=Teach.S.videos.find(item=>item.id===id);
 dialog(`<form id="rename-form"><h2>Rename video</h2><label class="f" for="new-name">Library title</label><input id="new-name" type="text" maxlength="120" required dir="auto" value="${esc(v.title)}"><div class="dialog-actions"><button type="button" class="btn ghost" onclick="closeDialog()">Cancel</button><button class="btn primary">Save title</button></div></form>`);
 $('#new-name').select();
 $('#rename-form').onsubmit=async e=>{
  e.preventDefault();
  try{await api('/api/videos/'+id,{method:'PATCH',body:JSON.stringify({title:$('#new-name').value})});closeDialog();await App.refresh(true);toast('Title saved');}catch(err){toast(err.message,true);}
 };
};
window.watchExample=id=>{
 const v=Teach.S.videos.find(item=>item.id===id);
 let localUrl;
 dialog(`<h2 dir="auto">${esc(v.title)}</h2>${v.hasPlayback?'':'<p class="muted">This study has no saved clip. Choose the original video to watch it on this device.</p><input type="file" accept="video/*" id="local-example" aria-label="Choose the original video">'}<video class="library-player" controls playsinline preload="metadata" ${v.hasPlayback?'src="'+withKey('/media/'+id+'/playback.mp4')+'"':'hidden'}></video><div class="dialog-actions"><button class="btn" onclick="closeDialog()">Close</button></div>`,{wide:true,onclose:()=>{if(localUrl)URL.revokeObjectURL(localUrl);}});
 const player=$('.library-player');
 player.onerror=()=>toast('This clip could not be played in your browser.',true);
 const picker=$('#local-example');
 if(picker)picker.onchange=()=>{const file=picker.files[0];if(!file)return;if(localUrl)URL.revokeObjectURL(localUrl);localUrl=URL.createObjectURL(file);player.src=localUrl;player.hidden=false;};
};
function videoDetail(v){
 const m=v.measured,id=esc(v.id),bar=(n,max)=>`<div class="meter"><i style="width:${Math.max(2,Math.min(100,n/max*100))}%"></i></div>`;
 return `<div class="vid library-detail">
  <div>${v.hasThumb?`<img class="thumb" style="width:200px" alt="" src="${withKey('/media/'+id+'/thumb.jpg')}">`:'<div class="thumb" style="width:200px"></div>'}</div>
  <div><div class="row"><span class="badge ${v.verdict}">${v.verdict==='good'?'good example':'bad example'}</span>${statusBadge(v)}<span class="muted small">taught ${ago(v.created)}</span></div>
   <div style="margin-top:8px">Learning: ${v.topics.map(t=>`<span class="chip">${esc(topicLabel(t))}</span>`).join(' ')}</div>
   ${v.prompt?`<p dir="auto" style="max-width:70ch">“${esc(v.prompt)}”</p>`:''}
   ${v.marks.length?`<div class="muted small">Marked moments: ${v.marks.map(k=>`${fmtS(k.t)}${k.note?' ('+esc(k.note)+')':''}`).join(', ')}</div>`:''}
   <div class="row" style="margin-top:12px"><button class="btn primary small" onclick="watchExample('${id}')">${v.hasPlayback?'Watch clip':'Watch original file'}</button>${v.status==='learned'?`<button class="btn small" onclick="renameTaught('${id}')">Rename</button>`:''}${v.status==='waiting'?`<button class="btn small" onclick="finishVideo('${id}')">Finish now</button>`:''}${v.status!=='measuring'?`<button class="btn small ghost" onclick="forgetVideo('${id}','${v.status}')">${v.status==='learned'?'Forget this video':'Remove'}</button>`:''}</div></div></div>
 ${m?`<div class="cols"><div class="card"><h3>Pacing</h3>${cutStrip(m)||'<div class="muted small" style="margin-top:8px">No hard cuts: one continuous piece.</div>'}
   <dl class="kv" style="margin-top:12px"><dt>Length</dt><dd>${fmtS(m.media.seconds)}, ${m.media.shape}, ${m.media.width}×${m.media.height}</dd><dt>Cuts</dt><dd>${m.pacing.cuts} (${m.pacing.cutsPerMinute} a minute)</dd>
    <dt>Typical shot</dt><dd>${m.pacing.shotMedian} s (shortest ${m.pacing.shotShortest}, longest ${m.pacing.shotLongest})</dd><dt>First cut</dt><dd>${m.pacing.firstCut==null?'none':m.pacing.firstCut+' s'}</dd></dl>
   <h3 style="margin-top:18px">Motion</h3><dl class="kv" style="margin-top:8px"><dt>Energy</dt><dd>${bar(m.motion.energy,8)}<span class="muted small">${m.motion.energy} (${word(m.motion.energy,[[1,'calm'],[2.5,'gentle'],[5,'lively'],[1e9,'very busy']])})</span></dd>
    <dt>Still</dt><dd>${bar(m.motion.stillShare,1)}<span class="muted small">${Math.round(m.motion.stillShare*100)}% of the time</span></dd><dt>Busiest at</dt><dd>${m.motion.peakAt==null?'none':fmtS(m.motion.peakAt)}</dd></dl></div>
  <div class="card"><h3>Colour</h3>${palette(m)}
   <dl class="kv" style="margin-top:12px"><dt>Brightness</dt><dd>${bar(m.color.brightness,1)}<span class="muted small">${Math.round(m.color.brightness*100)}%</span></dd><dt>Colour strength</dt><dd>${bar(m.color.saturation,1)}<span class="muted small">${Math.round(m.color.saturation*100)}%</span></dd>
    <dt>Background</dt><dd><span class="swatch" style="background:${esc(m.color.background)}"></span> ${esc(m.color.background)}</dd>${m.color.accent?`<dt>Accent</dt><dd><span class="swatch" style="background:${esc(m.color.accent)}"></span> ${esc(m.color.accent)}</dd>`:''}</dl>
   <h3 style="margin-top:18px">Sound</h3>${m.sound?`<dl class="kv" style="margin-top:8px">${m.sound.tempoConfidence>=.25?`<dt>Tempo</dt><dd>${m.sound.bpm} BPM</dd>`:'<dt>Tempo</dt><dd>no steady beat</dd>'}
    ${m.sound.cutsOnBeat!=null?`<dt>Cuts on the beat</dt><dd>${Math.round(m.sound.cutsOnBeat*100)}% (chance would be ${Math.round(m.sound.cutsOnBeatByChance*100)}%)</dd>`:''}<dt>Sound events</dt><dd>${m.sound.eventsPerSecond} a second</dd>${m.sound.lufs!=null?`<dt>Loudness</dt><dd>${m.sound.lufs} LUFS</dd>`:''}
    ${v.speech?`<dt>Speech</dt><dd>${v.speech.wordsPerSecond} words a second, ${v.speech.hookWords} in the first 3 s</dd>`:''}</dl>`:'<div class="muted small" style="margin-top:8px">Not studied, or the video has no sound.</div>'}</div></div>`:''}
 <h2 style="margin:24px 0 4px">Lessons from this video</h2>
 ${v.lessons.length?v.lessons.map(l=>lessonHtml(l,v.id+'|')).join(''):`<div class="muted">${v.status==='learned'?'No written lessons. Its measurements still count towards the patterns.':'None yet.'}</div>`}
 ${v.dropped.length?`<details><summary>${v.dropped.length} lesson${v.dropped.length>1?'s':''} filtered out as noise</summary>${v.dropped.map(x=>`<div class="lesson removed"><div class="body" dir="auto">${esc(x.text)}</div><div class="muted small">${esc(x.reason)}</div></div>`).join('')}</details>`:''}
 ${v.similar.length?`<h2 style="margin:24px 0 8px">Most like it</h2><div class="grid">${v.similar.map(s=>`<a class="card" style="text-decoration:none;color:inherit" href="#/teach/library/${esc(s.id)}"><div class="row"><b dir="auto">${esc(s.title)}</b><span class="muted small" style="margin-left:auto">${s.alike}% alike, mostly in ${s.mostAlikeIn.map(esc).join(' and ')}</span></div><div class="meter" style="margin-top:8px"><i style="width:${s.alike}%"></i></div></a>`).join('')}</div>`:''}`;
}
window.compareVideos=()=>{
 const [a,b]=[...Teach.picked].map(id=>Teach.S.videos.find(v=>v.id===id)).filter(v=>v&&v.measured);if(!a||!b)return toast('Pick two measured videos to compare.',true);
 const rows=[['Example',v=>v.verdict],['Length',v=>fmtS(v.measured.media.seconds)+', '+v.measured.media.shape],['Cuts a minute',v=>v.measured.pacing.cutsPerMinute],['Typical shot',v=>v.measured.pacing.shotMedian+' s'],['First cut',v=>v.measured.pacing.firstCut==null?'none':v.measured.pacing.firstCut+' s'],
  ['Motion energy',v=>v.measured.motion.energy],['Still',v=>Math.round(v.measured.motion.stillShare*100)+'%'],['Brightness',v=>Math.round(v.measured.color.brightness*100)+'%'],['Colour strength',v=>Math.round(v.measured.color.saturation*100)+'%'],
  ['Tempo',v=>v.measured.sound&&v.measured.sound.tempoConfidence>=.25?v.measured.sound.bpm+' BPM':'none'],['Loudness',v=>v.measured.sound?.lufs!=null?v.measured.sound.lufs+' LUFS':'none'],['Lessons',v=>v.lessons.length]];
 const alike=a.similar.find(s=>s.id===b.id);
 dialog(`<h2>Compare</h2>${alike?`<p class="muted">${alike.alike}% alike, mostly in ${alike.mostAlikeIn.map(esc).join(' and ')}.</p>`:''}
  <div class="cmp"><span></span><span class="h" dir="auto">${esc(a.title)}</span><span class="h" dir="auto">${esc(b.title)}</span>
   <span class="k">Cuts</span><span>${cutStrip(a.measured)||'none'}</span><span>${cutStrip(b.measured)||'none'}</span><span class="k">Colours</span><span>${palette(a.measured)}</span><span>${palette(b.measured)}</span>
   ${rows.map(([k,f])=>{const x=f(a),y=f(b);return `<span class="k">${k}</span><span>${esc(x)}</span><span style="${String(x)!==String(y)?'font-weight:600':''}">${esc(y)}</span>`;}).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" onclick="closeDialog()">Close</button></div>`,{wide:true});
};

// ---------- lessons ----------
App.register('teach/lessons',{
 head:()=>({title:'What your studio has learned',text:'Lessons from your videos and the ones you wrote. New ones start on trial; keep, reword or remove each.'}),
 title:()=>'Lessons',sub:()=>'What your videos taught, and what you wrote yourself',load:Teach.load,
 actions:()=>`<button class="btn small" onclick="exportLessons()">${I.down} Export</button><button class="btn small primary" onclick="writeLesson()">Write a lesson</button>`,
 render(el){
  const S=this.data,all=S.lessons,f=Teach.les,q=f.q.trim().toLowerCase();
  if(!all.length){el.innerHTML=`<div class="empty"><h2>No lessons yet</h2><p>They appear after your agent studies a taught video. You can also write one yourself.</p><button class="btn primary" onclick="writeLesson()">Write a lesson</button></div>`;return;}
  const group=l=>l.status==='trial'?'trial':['approved','proven'].includes(l.status)?'kept':'removed';
  const show=all.filter(l=>(f.status==='all'||group(l)===f.status)&&(f.topic==='all'||l.topics.includes(f.topic))&&(!q||l.body.toLowerCase().includes(q)));
  const conflictIds=new Set(S.conflicts.map(c=>c.lesson.id)),trial=show.filter(l=>l.status==='trial'&&!conflictIds.has(l.id));
  const sec=(title,note,list,extra='')=>list.length?`<div class="row" style="margin:22px 0 2px"><h2>${title} <span class="muted small">${list.length}</span></h2>${extra}</div><div class="muted small">${note}</div>${list.map(l=>lessonHtml(l,'L|')).join('')}`:'';
  const opt=(id,pairs)=>`<select data-f="${id}" aria-label="${id}">${pairs.map(([v,l])=>`<option value="${v}"${f[id]===v?' selected':''}>${l}</option>`).join('')}</select>`;
  const used=S.topics.filter(t=>all.some(l=>l.topics.includes(t.id)));
  el.innerHTML=`<div class="toolbar"><div class="search">${I.search}<input type="text" id="lesq" placeholder="Search the lessons" value="${esc(f.q)}" aria-label="Search the lessons"></div>
   ${opt('status',[['all','All'],['trial','On trial'],['kept','Kept'],['removed','Removed']])}${opt('topic',[['all','Any topic'],...used.map(t=>[t.id,esc(t.label)])])}<span class="muted small">${show.length} of ${all.length}</span></div>
  ${S.conflicts.length&&f.status!=='kept'&&f.status!=='removed'?`<h2 style="margin:6px 0 4px">To decide <span class="muted small">${S.conflicts.length}</span></h2><div class="muted small">A new lesson says the opposite of something already known. Choose which one stays.</div>
   ${S.conflicts.map(c=>`<div class="card" style="margin-top:10px;border-color:var(--warn)"><div class="muted small">New, from a taught video</div><div dir="auto" style="margin:4px 0 10px">${esc(c.lesson.body)}</div><div class="muted small">Already known</div><div dir="auto" style="margin:4px 0 12px">${esc(c.against.body)}</div>
    <div class="row"><button class="btn small" onclick="lessonDo('${esc(c.lesson.id)}','keep','Kept the new one')">Keep the new one</button><button class="btn small" onclick="lessonDo('${esc(c.lesson.id)}','remove','Kept what was known')">Keep what was known</button><button class="btn small ghost" onclick="lessonDo('${esc(c.lesson.id)}','both','Kept both')">Keep both</button></div></div>`).join('')}`:''}
  ${sec('On trial','The agent tries these when they fit; two good results make one proven. Keep the ones you agree with now.',trial,trial.length>1?`<button class="btn small" style="margin-left:auto" onclick="keepAll()">Keep all ${trial.length}</button>`:'')}
  ${sec('Kept','Applied to new videos whenever they fit.',show.filter(l=>group(l)==='kept'))}
  ${sec('Removed','Never applied, and never learned again from another video.',show.filter(l=>group(l)==='removed'))}
  ${show.length?'':`<div class="empty"><h2>Nothing matches</h2><button class="btn" onclick="Teach.les={q:'',status:'all',topic:'all'};App.show(false)">Clear the filters</button></div>`}`;
  Teach.trialShown=trial.map(l=>l.id);
  const qi=$('#lesq');qi.oninput=()=>{f.q=qi.value;store.set('teach-les',f);clearTimeout(Teach.qt);Teach.qt=setTimeout(()=>{App.show(false);const n=$('#lesq');n.focus();n.setSelectionRange(n.value.length,n.value.length);},250);};
  el.querySelectorAll('[data-f]').forEach(s=>s.onchange=()=>{f[s.dataset.f]=s.value;store.set('teach-les',f);App.show(false);});
 }});
window.keepAll=async()=>{const ids=Teach.trialShown||[];if(!ids.length||!await ask(`Keep all ${ids.length} lessons?`,'They are applied to new videos whenever they fit. You can still reword or remove each one.','Keep them'))return;
 act(async()=>{for(const id of ids)await api('/api/lessons/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({action:'both'})});},`Kept ${ids.length} lessons`);};
window.exportLessons=()=>{
 const S=Teach.S,live=S.lessons.filter(l=>!['rejected','retired'].includes(l.status)),by=t=>live.filter(l=>l.topics.includes(t.id));
 const md=`# Tempoloom lessons\n\nExported ${new Date().toISOString().slice(0,10)}: ${live.length} lessons and ${S.patterns.found.length} patterns.\n\n`+
  (S.patterns.found.length?`## Patterns your good examples share\n\n${S.patterns.found.map(p=>`- ${p.body}`).join('\n')}\n\n`:'')+
  S.topics.filter(t=>by(t).length).map(t=>`## ${t.label}\n\n${by(t).map(l=>`- ${l.kind==='avoid'?'Avoid: ':''}${l.body} (${l.status==='trial'?'on trial':l.status}, confidence ${l.confidence}%)`).join('\n')}\n`).join('\n');
 download('tempoloom-lessons.md',md);toast('Exported tempoloom-lessons.md');
};
window.writeLesson=()=>{
 const S=Teach.S;
 dialog(`<h2>Write a lesson</h2><p class="muted">Something you already know should always be done, or never. It is kept at once.</p>
  <label class="f" for="wl">The lesson</label><textarea id="wl" dir="auto" maxlength="1500" placeholder="For example: end every ad on the logo for at least 2 seconds, with the website address under it."></textarea>
  <div class="seg" style="margin-top:10px"><button class="btn good on" id="wdo">Do this</button><button class="btn badb" id="wavoid">Avoid this</button></div>
  <label class="f">About</label><div class="topics" id="wt">${S.topics.map(t=>`<label><input type="checkbox" value="${t.id}"> ${esc(t.label)}</label>`).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" onclick="closeDialog()">Cancel</button><button class="btn primary" id="wsave">Save the lesson</button></div>`);
 let avoid=false;$('#wdo').onclick=()=>{avoid=false;$('#wdo').classList.add('on');$('#wavoid').classList.remove('on');};$('#wavoid').onclick=()=>{avoid=true;$('#wavoid').classList.add('on');$('#wdo').classList.remove('on');};
 $('#wl').focus();
 $('#wsave').onclick=async()=>{const text=$('#wl').value.trim(),topics=[...document.querySelectorAll('#wt input:checked')].map(i=>i.value);
  try{await api('/api/lessons',{method:'POST',body:JSON.stringify({text,topics,avoid})});closeDialog(true);toast('Lesson saved');await App.refresh(true);}catch(e){toast(e.message,true);}};
};

// ---------- patterns ----------
App.register('teach/patterns',{
 head(){const p=this.data.patterns;return {title:'What your good examples share',text:`From the measurements of your videos. A pattern needs at least three good examples that agree; one far from the rest is left out. So far: ${p.from.good} good and ${p.from.bad} bad examples.`};},
 title:()=>'Patterns',sub:()=>'What your good examples have in common',load:Teach.load,
 render(el){
  const p=this.data.patterns;
  el.innerHTML=`  ${p.found.length?`<div class="grid">${p.found.map(x=>`<div class="card"><div class="row"><h3>${esc(x.title)}</h3><span class="chip">${esc(topicLabel(x.topic))}</span><span class="muted small" style="margin-left:auto">from ${x.videos.length} videos${x.leftOut?`, ${x.leftOut} left out`:''}</span></div><div style="margin-top:6px;max-width:80ch">${esc(x.body)}</div></div>`).join('')}</div>`
   :`<div class="empty"><h2>No patterns yet</h2><p>${p.from.good<3?`Teach ${3-p.from.good} more good example${3-p.from.good>1?'s':''} on the same topic to see the first pattern.`:'Your good examples do not agree closely enough yet.'}</p><a class="btn primary" href="#/teach/add">Teach a video</a></div>`}
  ${p.unclear.length?`<details><summary>${p.unclear.length} measurement${p.unclear.length>1?'s':''} your examples disagree on</summary>${p.unclear.map(u=>`<div class="lesson removed"><b>${esc(u.metric)}</b><div class="muted small">${esc(u.why)}</div></div>`).join('')}</details>`:''}`;
 }});
