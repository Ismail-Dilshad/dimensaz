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

// ---------- add ----------
App.register('teach/add',{
 title:()=>'Teach a video',sub:()=>'Choose a clip and tell the studio what to learn',load:Teach.load,
 hold:()=>!!Teach.up,
 render(el,arg,routeChanged){
  const S=this.data,drafts=S.videos.filter(v=>v.status==='draft');
  if(Teach.cur&&!drafts.some(d=>d.id===Teach.cur))Teach.cur=null;
  if(!Teach.cur&&drafts.length&&!Teach.up)Teach.cur=drafts[0].id;
  // The editor is not re-drawn while the user works in it: only the queue beside it.
  if(Teach.cur&&$('#editor')?.dataset.id===Teach.cur&&!routeChanged){$('#queue').innerHTML=queueHtml(drafts);return;}
  if(Teach.ed){Teach.ed.video.pause();Teach.ed=null;}
  el.innerHTML=Teach.cur?`<div id="edwrap"></div><div id="queue">${queueHtml(drafts)}</div>`:dropHtml(S)+`<div id="queue">${queueHtml(drafts)}</div>`;
  if(Teach.cur)openEditor(drafts.find(d=>d.id===Teach.cur));else wireDrop(S);
 }});
function queueHtml(drafts){
 const up=Teach.up;if(!drafts.length&&!up)return '';
 return `<h3 style="margin:22px 0 8px">Waiting to be set up <span class="muted small">${drafts.length}</span></h3><div class="queue">
  ${drafts.map(d=>`<div class="q ${d.id===Teach.cur?'cur':''}"><span dir="auto" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.title)}</span><span class="muted small">${fmtS(d.media.seconds)}</span>
   ${d.id===Teach.cur?'<span class="badge st">open</span>':`<button class="btn small" onclick="Teach.cur='${d.id}';App.show(true)">Set up</button>`}<button class="iconbtn" aria-label="Remove ${esc(d.title)}" onclick="removeDraft('${d.id}')">${I.x}</button></div>`).join('')}
  ${up?`<div class="q"><span class="spin"></span><span style="flex:1" dir="auto">${esc(up.text)}</span><span class="muted small">${up.left?up.left+' more after this':''}</span></div>`:''}
  ${Teach.cur?`<button class="btn small ghost" style="justify-self:start" onclick="Teach.cur=null;Teach.addMore=true;App.show(true)">Add more videos</button>`:''}</div>`;
}
window.removeDraft=id=>act(async()=>{await api('/api/videos/'+id,{method:'DELETE'});delete Teach.D[id];if(Teach.cur===id)Teach.cur=null;},'Removed');
function dropHtml(S){
 return `<section class="teach-upload"><div class="upload-intro"><h2>Teach your studio something new</h2><p class="muted">Add a video and choose what to learn from its style, pacing, or editing.</p></div>
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
 Teach.addMore=false;const drop=$('#drop'),file=$('#file');
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
  try{await new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('POST','/api/upload?name='+encodeURIComponent(f.name));x.setRequestHeader('x-teach-key',KEY);
   x.upload.onprogress=e=>{if(e.lengthComputable&&Teach.up){Teach.up.pct=Math.round(e.loaded/e.total*100);Teach.up.text=(Teach.up.pct>=100?'Preparing the preview of ':'Uploading ')+f.name+(Teach.up.pct<100?' '+Teach.up.pct+'%':'');const q=$('#queue');if(q)q.innerHTML=queueHtml(Teach.S.videos.filter(v=>v.status==='draft'));const b=$('#up .bar i');if(b)b.style.width=Teach.up.pct+'%';}};
   x.onload=()=>{let j={};try{j=JSON.parse(x.responseText);}catch{}x.status===200?res(j):rej(new Error(j.error||'The upload failed'));};x.onerror=()=>rej(new Error('The upload failed. Is the terminal still open?'));x.send(f);});}
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
  else{Teach.linkInfo=null;Teach.cur=r.video.id;await App.refresh(true);}
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

function openEditor(v){
 const S=Teach.S;
 const d=Teach.D[v.id]??={id:v.id,fps:v.media.fps||30,seconds:v.media.seconds,w:v.media.width,h:v.media.height,audio:v.media.audio,title:v.title,verdict:'good',prompt:'',topics:new Set(store.get('teach-topics',[])),marks:[],start:0,end:v.media.seconds,crop:null,cropOn:false,keepPlayback:v.source!=='link',sound:true,speech:false,aspect:'free',sending:false};
 $('#edwrap').innerHTML=`<div class="editor" id="editor" data-id="${d.id}">
 <div>
  <div class="stage" id="stage"><video id="v" src="${withKey('/media/'+d.id+'/preview.mp4')}" playsinline preload="auto"></video>
   <div class="crop" id="crop"><div class="box" id="box"><i class="h nw" data-h="nw"></i><i class="h ne" data-h="ne"></i><i class="h sw" data-h="sw"></i><i class="h se" data-h="se"></i></div></div></div>
  <div class="tools">
   <button class="btn" id="play" title="Play or pause (Space)">Play</button>
   <button class="btn small" id="back" title="One frame back (Left arrow)">◀ frame</button><button class="btn small" id="fwd" title="One frame forward (Right arrow)">frame ▶</button>
   <button class="btn small" id="speed" title="Playback speed">1×</button><button class="btn small" id="loop" title="Repeat the chosen part">Loop</button>
   <span class="time" id="time"></span></div>
  <div class="track" id="track" aria-label="Timeline"><div class="sel" id="sel"></div><div class="grip" id="g0" title="Start"></div><div class="grip" id="g1" title="End"></div><div id="mks"></div><div class="head" id="head"></div></div>
  <div class="tools">
   <button class="btn small" id="setin" title="Start the part to study here (I)">Start here</button><button class="btn small" id="setout" title="End the part to study here (O)">End here</button><button class="btn small" id="whole">Whole video</button>
   <span class="sep"></span><button class="btn small" id="mark" title="Mark this moment (M)">Mark this moment</button>
   <span class="sep"></span><button class="btn small" id="cropbtn">Crop</button>
   <span id="aspects" hidden>${['free','9:16','1:1','16:9','4:5'].map(a=>`<button class="btn small" data-a="${a}">${a==='free'?'Free':a}</button>`).join(' ')}</span></div>
  <div class="muted small" id="partinfo"></div><ul class="marks" id="marks"></ul>
  <p class="muted small">Keys: <kbd>Space</kbd> play, <kbd>←</kbd> <kbd>→</kbd> one frame, <kbd>I</kbd> start, <kbd>O</kbd> end, <kbd>M</kbd> mark</p>
 </div>
 <div class="card">
  <h2>What should it learn?</h2>
  <label class="f" for="study-title">Name</label><input type="text" id="study-title" dir="auto" maxlength="120" value="${esc(d.title)}">
  <label class="f">This video is</label>
  <div class="seg"><button class="btn good" id="vgood">A good example</button><button class="btn badb" id="vbad">A bad example</button></div>
  <label class="f">Learn from its <span class="muted">(only what you tick)</span> <button class="btn small ghost" id="alltopics" style="float:right;margin-top:-4px">All</button></label>
  <div class="topics" id="topics">${S.topics.map(t=>`<label><input type="checkbox" value="${t.id}"${d.topics.has(t.id)?' checked':''}> ${esc(t.label)}</label>`).join('')}</div>
  <label class="f" for="prompt">Your prompt <span class="muted">(what to look at, what to ignore)</span></label>
  <textarea id="prompt" dir="auto" maxlength="2000" placeholder="For example: learn how the text enters and how fast the cuts are. Ignore the colours and the logo.">${esc(d.prompt)}</textarea>
  <label class="check" style="margin-top:10px"${d.audio?'':' hidden'}><input type="checkbox" id="sound" ${d.sound?'checked':''}> Study the sound too (music tempo, cuts on the beat)</label>
  <label class="check" style="margin-top:6px"${d.audio&&S.can.speech?'':' hidden'}><input type="checkbox" id="speech" ${d.speech?'checked':''}> Read the spoken words (uses your ElevenLabs account)</label>
  <label class="check"><input type="checkbox" id="keepPlayback" ${d.keepPlayback?'checked':''}> Save the studied clip for library playback</label>
  <div class="row" style="margin-top:18px"><button class="btn primary" id="send">Teach this video</button><button class="btn ghost" id="cancel">Remove</button></div>
 </div></div>`;
 setupEditor(d);
}
function setupEditor(d){
 const v=$('#v'),track=$('#track'),stage=$('#stage'),box=$('#box'),crop=$('#crop');
 const fps=d.fps;let loop=false;const speeds=[1,.5,.25,2];let sp=0;Teach.ed={video:v};
 const frac=t=>Math.max(0,Math.min(1,t/d.seconds));
 const paint=()=>{
  $('#sel').style.left=frac(d.start)*100+'%';$('#sel').style.width=(frac(d.end)-frac(d.start))*100+'%';
  $('#g0').style.left=frac(d.start)*100+'%';$('#g1').style.left=frac(d.end)*100+'%';$('#head').style.left=frac(v.currentTime)*100+'%';
  $('#time').textContent=fmtT(v.currentTime)+' / '+fmtT(d.seconds);
  $('#mks').innerHTML=d.marks.map(m=>`<i class="mk" style="left:${frac(m.t)*100}%"></i>`).join('');
  const whole=d.start<=.01&&d.end>=d.seconds-.01;
  $('#partinfo').textContent=(whole?'Studying the whole video':'Studying '+fmtT(d.start)+' to '+fmtT(d.end))+' ('+(d.end-d.start).toFixed(1)+' s)'+(d.cropOn&&d.crop?', cropped to '+Math.round(d.crop.w*100)+'% × '+Math.round(d.crop.h*100)+'% of the frame':'');
  $('#vgood').classList.toggle('on',d.verdict==='good');$('#vbad').classList.toggle('on',d.verdict==='bad');
  $('#loop').classList.toggle('on',loop);$('#cropbtn').classList.toggle('on',d.cropOn);$('#aspects').hidden=!d.cropOn;
  document.querySelectorAll('#aspects button').forEach(b=>b.classList.toggle('on',b.dataset.a===d.aspect));
  $('#play').textContent=v.paused?'Play':'Pause';
 };
 const marks=()=>{$('#marks').innerHTML=d.marks.map((m,i)=>`<li><span class="t" data-go="${i}" title="Go to this moment">${fmtT(m.t)}</span><input type="text" dir="auto" maxlength="200" placeholder="What happens here? (for example: this transition)" value="${esc(m.note)}" data-note="${i}" aria-label="Note for the mark at ${fmtT(m.t)}"><button class="iconbtn" data-del="${i}" aria-label="Remove this mark">${I.x}</button></li>`).join('');};
 $('#marks').onclick=e=>{const g=e.target.dataset.go,x=e.target.closest('[data-del]')?.dataset.del;if(g!==undefined){v.currentTime=d.marks[g].t;}if(x!==undefined){d.marks.splice(x,1);marks();paint();}};
 $('#marks').oninput=e=>{const n=e.target.dataset.note;if(n!==undefined)d.marks[n].note=e.target.value;};
 v.ontimeupdate=()=>{if(loop&&!v.paused&&(v.currentTime>=d.end||v.currentTime<d.start-.05))v.currentTime=d.start;paint();};
 v.onplay=v.onpause=v.onseeked=paint;
 v.onloadedmetadata=()=>{if(isFinite(v.duration)&&v.duration>0){d.seconds=v.duration;d.end=Math.min(d.end,v.duration)||v.duration;}paint();layoutCrop();};
 v.onerror=()=>toast('The preview could not be played. Remove it and upload the video again.',true);
 const toggle=()=>{if(v.paused){if(loop&&(v.currentTime>=d.end||v.currentTime<d.start))v.currentTime=d.start;v.play();}else v.pause();};
 $('#play').onclick=toggle;v.onclick=()=>{if(!d.cropOn)toggle();};
 const stepF=n=>{v.pause();v.currentTime=Math.max(0,Math.min(d.seconds,v.currentTime+n/fps));};
 $('#back').onclick=()=>stepF(-1);$('#fwd').onclick=()=>stepF(1);
 $('#speed').onclick=()=>{sp=(sp+1)%speeds.length;v.playbackRate=speeds[sp];$('#speed').textContent=speeds[sp]+'×';};
 $('#loop').onclick=()=>{loop=!loop;paint();};
 $('#setin').onclick=()=>{d.start=Math.max(0,Math.min(v.currentTime,d.end-.5));paint();};
 $('#setout').onclick=()=>{d.end=Math.min(d.seconds,Math.max(v.currentTime,d.start+.5));paint();};
 $('#whole').onclick=()=>{d.start=0;d.end=d.seconds;paint();};
 $('#mark').onclick=()=>{if(d.marks.length>=12)return toast('At most 12 marks.',true);d.marks.push({t:Math.round(v.currentTime*100)/100,note:''});d.marks.sort((a,b)=>a.t-b.t);marks();paint();};
 let drag=null;
 const at=e=>{const r=track.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*d.seconds;};
 const move=e=>{if(!drag)return;const t=at(e);if(drag==='in')d.start=Math.max(0,Math.min(t,d.end-.5));else if(drag==='out')d.end=Math.min(d.seconds,Math.max(t,d.start+.5));v.currentTime=drag==='out'?d.end:drag==='in'?d.start:t;paint();};
 track.onpointerdown=e=>{track.setPointerCapture(e.pointerId);drag=e.target.id==='g0'?'in':e.target.id==='g1'?'out':'seek';move(e);};
 track.onpointermove=move;track.onpointerup=track.onpointercancel=()=>{drag=null;};
 const rect=()=>{const s=stage.getBoundingClientRect(),r=v.getBoundingClientRect();return {l:r.left-s.left,t:r.top-s.top,w:r.width,h:r.height};};
 function layoutCrop(){crop.classList.toggle('on',d.cropOn);if(!d.cropOn||!d.crop)return;const r=rect();
  Object.assign(box.style,{left:r.l+d.crop.x*r.w+'px',top:r.t+d.crop.y*r.h+'px',width:d.crop.w*r.w+'px',height:d.crop.h*r.h+'px'});}
 const ratio=()=>{if(d.aspect==='free')return null;const [a,b]=d.aspect.split(':').map(Number);return (a/b)/(d.w/d.h);};
 const fit=()=>{const k=ratio();if(!k)return;let w=d.crop.w,h=w/k;if(h>1){h=1;w=k;}if(w>1){w=1;h=1/k;}const cx=d.crop.x+d.crop.w/2,cy=d.crop.y+d.crop.h/2;
  d.crop={w,h,x:Math.max(0,Math.min(1-w,cx-w/2)),y:Math.max(0,Math.min(1-h,cy-h/2))};};
 $('#cropbtn').onclick=()=>{d.cropOn=!d.cropOn;if(d.cropOn&&!d.crop){d.crop={x:.1,y:.1,w:.8,h:.8};fit();}v.pause();paint();layoutCrop();};
 $('#aspects').onclick=e=>{const a=e.target.dataset.a;if(!a)return;d.aspect=a;if(a==='free')d.crop={x:.1,y:.1,w:.8,h:.8};else{d.crop={x:0,y:0,w:1,h:1};fit();}paint();layoutCrop();};
 let cd=null;
 box.onpointerdown=e=>{e.preventDefault();box.setPointerCapture(e.pointerId);cd={h:e.target.dataset.h||'move',x:e.clientX,y:e.clientY,c:{...d.crop}};};
 box.onpointermove=e=>{if(!cd)return;const r=rect(),dx=(e.clientX-cd.x)/r.w,dy=(e.clientY-cd.y)/r.h,c=cd.c,k=ratio(),min=.1;let x=c.x,y=c.y,w=c.w,h=c.h;
  if(cd.h==='move'){x=Math.max(0,Math.min(1-w,c.x+dx));y=Math.max(0,Math.min(1-h,c.y+dy));}
  else{const L=cd.h.includes('w'),Tp=cd.h.includes('n');
   let x0=L?Math.max(0,Math.min(c.x+c.w-min,c.x+dx)):c.x,x1=L?c.x+c.w:Math.max(c.x+min,Math.min(1,c.x+c.w+dx));
   let y0=Tp?Math.max(0,Math.min(c.y+c.h-min,c.y+dy)):c.y,y1=Tp?c.y+c.h:Math.max(c.y+min,Math.min(1,c.y+c.h+dy));
   w=x1-x0;h=y1-y0;
   if(k){h=w/k;if(Tp?(y1-h<0):(y0+h>1)){h=Tp?y1:1-y0;w=h*k;}if(Tp)y0=y1-h;else y1=y0+h;if(L)x0=x1-w;}
   x=x0;y=y0;}
  d.crop={x,y,w,h};layoutCrop();paint();};
 box.onpointerup=box.onpointercancel=()=>{cd=null;};
 new ResizeObserver(layoutCrop).observe(stage);
 $('#keepPlayback').onchange=e=>d.keepPlayback=e.target.checked;
 $('#study-title').oninput=e=>d.title=e.target.value;$('#prompt').oninput=e=>d.prompt=e.target.value;
 $('#vgood').onclick=()=>{d.verdict='good';paint();};$('#vbad').onclick=()=>{d.verdict='bad';paint();};
 $('#topics').onchange=e=>{e.target.checked?d.topics.add(e.target.value):d.topics.delete(e.target.value);};
 $('#alltopics').onclick=()=>{const all=d.topics.size<Teach.S.topics.length;d.topics=new Set(all?Teach.S.topics.map(t=>t.id):[]);document.querySelectorAll('#topics input').forEach(i=>i.checked=all);};
 $('#sound').onchange=e=>{d.sound=e.target.checked;};$('#speech').onchange=e=>{d.speech=e.target.checked;};
 $('#cancel').onclick=()=>removeDraft(d.id);
 $('#send').onclick=async()=>{
  if(d.sending)return;
  if(!d.title.trim())return toast('Give the video a name.',true);
  if(!d.topics.size)return toast('Tick at least one thing to learn from this video.',true);
  const whole=d.start<=.01&&d.end>=d.seconds-.01,c=d.cropOn&&d.crop&&(d.crop.w<.995||d.crop.h<.995)?d.crop:null;
  const body={keepPlayback:d.keepPlayback,title:d.title.trim(),verdict:d.verdict,prompt:d.prompt.trim(),topics:[...d.topics],marks:d.marks.filter(m=>whole||m.t>=d.start&&m.t<=d.end).map(m=>({t:m.t,note:m.note.trim()})),
   segment:whole?null:{start:Math.round(d.start*1000)/1000,end:Math.round(d.end*1000)/1000},crop:c?{x:c.x,y:c.y,w:c.w,h:c.h}:null,sound:d.audio&&d.sound,speech:d.audio&&d.sound&&d.speech};
  d.sending=true;$('#send').disabled=true;
  try{v.pause();await api('/api/videos/'+d.id+'/teach',{method:'POST',body:JSON.stringify(body)});store.set('teach-topics',[...d.topics]);delete Teach.D[d.id];Teach.cur=null;Teach.ed=null;
   toast('Sent. It is being measured.');await App.refresh(true);
   if(!Teach.S.videos.some(x=>x.status==='draft'))App.go('teach/library');}
  catch(e){d.sending=false;$('#send').disabled=false;toast(e.message,true);}
 };
 marks();paint();
}
document.addEventListener('keydown',e=>{
 if(App.route!=='teach/add'||!Teach.ed||$('#modal').innerHTML||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
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
 title:()=>'Patterns',sub:()=>'What your good examples have in common',load:Teach.load,
 render(el){
  const p=this.data.patterns;
  el.innerHTML=`<p class="muted" style="max-width:75ch">From the measurements of your videos. A pattern needs at least three good examples that agree; a video far from the rest is left out. So far: <b>${p.from.good}</b> good and <b>${p.from.bad}</b> bad examples.</p>
  ${p.found.length?`<div class="grid">${p.found.map(x=>`<div class="card"><div class="row"><h3>${esc(x.title)}</h3><span class="chip">${esc(topicLabel(x.topic))}</span><span class="muted small" style="margin-left:auto">from ${x.videos.length} videos${x.leftOut?`, ${x.leftOut} left out`:''}</span></div><div style="margin-top:6px;max-width:80ch">${esc(x.body)}</div></div>`).join('')}</div>`
   :`<div class="empty"><h2>No patterns yet</h2><p>${p.from.good<3?`Teach ${3-p.from.good} more good example${3-p.from.good>1?'s':''} on the same topic to see the first pattern.`:'Your good examples do not agree closely enough yet.'}</p><a class="btn primary" href="#/teach/add">Teach a video</a></div>`}
  ${p.unclear.length?`<details><summary>${p.unclear.length} measurement${p.unclear.length>1?'s':''} your examples disagree on</summary>${p.unclear.map(u=>`<div class="lesson removed"><b>${esc(u.metric)}</b><div class="muted small">${esc(u.why)}</div></div>`).join('')}</details>`:''}`;
 }});
