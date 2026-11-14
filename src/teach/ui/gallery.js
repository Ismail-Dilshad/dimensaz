'use strict';
// Gallery: every video the agent made or edited. Play it, see how it was rated and checked,
// star the best, compare two side by side, download, or teach from it as an example.
const Gallery={f:{cat:'all',rating:'all',...store.get('gallery-filter',{q:'',kind:'all',mode:'all',sort:'new',starred:false})},picked:new Set(),showHidden:false};
const kindLabel=k=>k==='final'?'Final':k==='preview'?'Preview':'Export';
App.register('studio/gallery',{
 title:a=>{const i=a&&App.screens['studio/gallery'].data?.items.find(x=>x.id===a);return i?i.title:'Gallery';},sub:a=>a?'':'Everything your studio has made',
 head(a){const d=this.data,i=a&&d.items.find(x=>x.id===a);
  return i?{title:i.title,text:`${kindLabel(i.kind)} ${i.mode==='edit'?'edit':i.mode==='motion'?'motion video':'video'}, made ${ago(i.made)}.`}
   :{title:'Everything your studio has made',text:`${d.totals.all} video${d.totals.all===1?'':'s'}: ${d.totals.finals} final, ${d.totals.previews} preview${d.totals.previews===1?'':'s'}, ${d.totals.exports} export${d.totals.exports===1?'':'s'}. The files stay in your project${d.folder?` (${d.folder})`:''}; a file is deleted only when you choose Delete.`};},
 load(){return api('/api/gallery'+(Gallery.showHidden?'?hidden=1':''));},
 actions(a){const d=App.screens['studio/gallery'].data;if(!d)return '';
  if(a)return `<a class="btn" href="#/studio/gallery">All videos</a>`;
  return `${Gallery.picked.size===2?`<button class="btn primary" onclick="galleryCompare()">Compare the 2</button>`:Gallery.picked.size?`<span class="muted small">Pick 2 to compare</span>`:''}<a class="btn" href="#/studio/new">${I.add} New video</a>`;},
 render(el,arg){
  const d=this.data,f=Gallery.f;
  if(arg){const i=d.items.find(x=>x.id===arg);el.innerHTML=i?galleryDetail(i):`<div class="empty"><h2>This video is not in the gallery</h2><a class="btn" href="#/studio/gallery">Open the gallery</a></div>`;return;}
  if(!d.items.length&&!d.hidden){el.innerHTML=`<div class="empty"><h2>No videos made yet</h2><p>When your studio finishes a preview or a final video, it appears here to play, compare and download.</p><a class="btn primary" href="#/studio/new">New video</a></div>`;return;}
  const q=f.q.trim().toLowerCase();
  if(f.cat!=='all'&&!d.categories.some(c=>c.id===f.cat))f.cat='all';
  const match=i=>(f.kind==='all'||i.kind===f.kind)&&(f.mode==='all'||i.mode===f.mode)&&(!f.starred||i.starred)&&(f.rating==='all'||(f.rating==='none'?!i.rating:i.rating===f.rating))&&(!q||i.title.toLowerCase().includes(q)||i.name.toLowerCase().includes(q)||i.tags.some(t=>t.toLowerCase().includes(q)));
  const key={new:i=>-new Date(i.made),old:i=>+new Date(i.made),long:i=>-(i.seconds||0),big:i=>-i.bytes,name:i=>i.title.toLowerCase()}[f.sort];
  const order=l=>l.slice().sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0);
  const base=d.items.filter(match),list=order(base.filter(i=>f.cat==='all'||i.category===f.cat));
  const opt=(id,label,pairs)=>`<select data-f="${id}" aria-label="${label}">${pairs.map(([v,l])=>`<option value="${v}"${f[id]===v?' selected':''}>${l}</option>`).join('')}</select>`;
  const card=i=>`<div class="gallery-card"><div class="gallery-media"><a href="#/studio/gallery/${i.id}" aria-label="Play ${esc(i.title)}"><span class="gallery-thumb"><img loading="lazy" alt="" src="${withKey('/gallery/thumb/'+i.id)}"><span class="gallery-play">${I.play}</span>
     <span class="gallery-tags"><span class="badge ${i.kind==='final'?'good':'st'}">${kindLabel(i.kind)}</span></span></span></a>
    <button class="gallery-star" aria-pressed="${i.starred}" aria-label="${i.starred?'Remove the star from':'Star'} ${esc(i.title)}" onclick="galleryStar('${i.id}',${!i.starred})">${I.star}</button>
    <label class="gallery-pick" title="Pick to compare"><input type="checkbox" aria-label="Pick ${esc(i.title)} to compare" ${Gallery.picked.has(i.id)?'checked':''} onchange="galleryPick('${i.id}',this.checked)"></label></div>
    <b dir="auto">${esc(i.title)}</b><span class="muted small">${i.seconds?fmtS(i.seconds)+', ':''}${i.tags.slice(0,2).map(esc).join(', ')||'video'}, ${ago(i.made)}</span>${rateButtons(i,false)}</div>`;
  const sections=f.cat==='all'&&f.sort==='new'&&!q?d.categories.map(c=>({c,items:list.filter(i=>i.category===c.id)})).filter(x=>x.items.length):null;
  el.innerHTML=`<div class="focus-chips" role="group" aria-label="Kind of video, sorted automatically" style="margin:0 0 16px">${[{id:'all',label:'Everything',count:base.length},...d.categories.map(c=>({...c,count:base.filter(i=>i.category===c.id).length}))].map(c=>`<button type="button" aria-pressed="${f.cat===c.id}" onclick="galleryCat('${c.id}')">${esc(c.label)} <span class="muted">${c.count}</span></button>`).join('')}</div>
  <div class="toolbar"><div class="search">${I.search}<input type="text" id="galq" placeholder="Search your videos" value="${esc(f.q)}" aria-label="Search the gallery"></div>
   ${opt('kind','Kind',[['all','Finals and previews'],['final','Finals'],['preview','Previews'],['export','Exports']])}${opt('rating','Rating',[['all','Any rating'],['good','Rated good'],['ok','Rated not bad'],['bad','Rated bad'],['none','Not rated yet']])}
   ${opt('sort','Order',[['new','Newest first'],['old','Oldest first'],['long','Longest'],['big','Largest file'],['name','By name']])}
   <button class="btn ${f.starred?'on':''}" id="galstar" aria-pressed="${f.starred}">${I.star} Starred${d.totals.starred?` ${d.totals.starred}`:''}</button></div>
  <div class="muted small" style="margin-bottom:12px">${list.length} of ${d.items.length} videos, ${d.totals.megabytes} MB in all${d.totals.rated?`, ${d.totals.good} rated good and ${d.totals.bad} bad`:''}</div>
  ${!list.length?`<div class="card" style="text-align:center"><p class="muted">Nothing matches.</p><button class="btn" onclick="Gallery.f={cat:'all',rating:'all',q:'',kind:'all',mode:'all',sort:'new',starred:false};store.set('gallery-filter',Gallery.f);App.show(false)">Clear the filters</button></div>`
   :sections?sections.map(({c,items})=>`<section class="gallery-section"><div class="teach-section-head"><h3>${esc(c.label)}</h3><span class="muted small">${items.length} video${items.length===1?'':'s'}</span></div><div class="gallery-grid">${items.map(card).join('')}</div></section>`).join('')
   :`<div class="gallery-grid">${list.map(card).join('')}</div>`}
  ${d.hidden||Gallery.showHidden?`<button class="btn" style="margin-top:22px" onclick="Gallery.showHidden=!Gallery.showHidden;App.screens['studio/gallery'].data=null;App.refresh(true)">${Gallery.showHidden?'Stop showing hidden videos':`Show ${d.hidden} hidden`}</button>`:''}`;
  const qi=$('#galq');if(qi)qi.oninput=()=>{f.q=qi.value;store.set('gallery-filter',f);clearTimeout(Gallery.qt);Gallery.qt=setTimeout(()=>{App.show(false);const n=$('#galq');n.focus();n.setSelectionRange(n.value.length,n.value.length);},250);};
  el.querySelectorAll('[data-f]').forEach(s=>s.onchange=()=>{f[s.dataset.f]=s.value;store.set('gallery-filter',f);App.show(false);});
  if($('#galstar'))$('#galstar').onclick=()=>{f.starred=!f.starred;store.set('gallery-filter',f);App.show(false);};
 }});
function galleryDetail(i){
 const src=withKey('/gallery/file/'+i.id);
 return `<div class="gallery-player"><div class="card">${safeVideo(`<video controls playsinline preload="metadata" poster="${withKey('/gallery/thumb/'+i.id)}" src="${src}"></video>`)}</div>
  <div class="card teach-settings"><div class="teach-section-head"><h3>About this video</h3><span class="badge ${i.kind==='final'?'good':'st'}">${kindLabel(i.kind)}</span></div>
   <dl class="kv"><dt>Length</dt><dd>${i.seconds?fmtS(i.seconds):'unknown'}</dd><dt>Size</dt><dd>${i.width?`${i.width}×${i.height}, `:''}${mb(i.bytes)}</dd><dt>Made</dt><dd>${new Date(i.made).toLocaleString()}</dd>
    <dt>Sorted as</dt><dd>${esc((App.screens['studio/gallery'].data.categories.find(c=>c.id===i.category)||{}).label||'Other videos')}${i.tags.length?` <span class="muted">(${i.tags.map(esc).join(', ')})</span>`:''}</dd>
    ${i.check?`<dt>Its own check</dt><dd>${i.check.passed} match${i.check.near?`, ${i.check.near} close`:''}${i.check.off?`, ${i.check.off} off`:''} your taste</dd>`:''}
    <dt>File</dt><dd style="overflow-wrap:anywhere">${esc(i.file)} <button class="iconbtn" style="vertical-align:middle" aria-label="Copy the file path" onclick="copyText(${esc(JSON.stringify(i.file))})">${I.copy}</button></dd></dl>
   <div style="margin-top:16px"><div class="teach-section-head" style="margin-bottom:8px"><h3>Your rating</h3><span class="muted small">${i.rating?(i.ratedHere?'rated here':'from its step in the studio'):'not rated yet'}</span></div>
    ${rateButtons(i,true)}${i.note?`<p class="muted small" dir="auto" style="margin:8px 0 0">“${esc(i.note)}”</p>`:''}
    <p class="muted small" style="margin:8px 0 0">Your rating also scores the lessons the video used, when its step was not rated yet.</p></div>
   <label class="teach-setting" style="margin-top:8px"><span><b>Starred</b><small>Keep your best work one click away.</small></span><input type="checkbox" role="switch" aria-label="Starred" ${i.starred?'checked':''} onchange="galleryStar('${i.id}',this.checked)"></label>
   <div class="teach-submit"><p class="muted">Teach from it as a good or a bad example, and the studio learns from its own work.</p>
    <div><span class="row"><a class="btn" href="${src}&dl=1" download>${I.down} Download</a>${i.job?`<a class="btn" href="#/studio/videos/${encodeURIComponent(i.job)}">Open its steps</a>`:''}<button class="btn" onclick="galleryPublish('${i.id}')">Publish it</button></span>
     <button class="btn primary" onclick="galleryTeach('${i.id}')">Teach from this</button></div>
    <div class="row" style="margin-top:12px;justify-content:flex-start"><button class="btn" onclick="galleryHide('${i.id}')">Hide from the gallery</button><button class="btn danger-text" onclick="galleryDelete('${i.id}')">Delete the file</button></div></div></div></div>`;
}
/** Good, not bad or bad: one click on a card, with a note asked for when it is bad. */
function rateButtons(i,large){return `<div class="gallery-rate ${large?'large':''}" role="group" aria-label="Rate ${esc(i.title)}">${[['good','Good'],['ok','Not bad'],['bad','Bad']].map(([r,l])=>`<button type="button" data-r="${r}" aria-pressed="${i.rating===r}" onclick="galleryRate('${i.id}','${r}',${i.rating===r&&i.ratedHere})">${l}</button>`).join('')}</div>`;}
window.galleryCat=c=>{Gallery.f.cat=c;store.set('gallery-filter',Gallery.f);App.show(false);};
window.galleryRate=(id,rating,clear)=>{
 const send=note=>act(()=>api(`/api/gallery/${id}/rate`,{method:'POST',body:JSON.stringify(clear?{rating:null}:{rating,note})}),clear?'Rating removed':rating==='bad'?'Rated bad. The reason is remembered.':rating==='good'?'Rated good':'Rated not bad');
 if(clear||rating!=='bad')return send('');
 dialog(`<h2>What is wrong with it?</h2><p class="muted">Your reason is remembered, so the next video avoids it.</p><textarea id="gr-note" dir="auto" maxlength="600" placeholder="For example: the cuts are too slow and the text is hard to read."></textarea>
  <div class="dialog-actions"><button class="btn" onclick="closeDialog()">Cancel</button><button class="btn primary" id="gr-go">Rate it bad</button></div>`);
 $('#gr-note').focus();$('#gr-go').onclick=()=>{const note=$('#gr-note').value.trim();if(note.length<4)return toast('Say what is wrong with it.',true);closeDialog(true);send(note);};
};
window.galleryDelete=async id=>{const i=App.screens['studio/gallery'].data.items.find(x=>x.id===id);if(!i)return;
 if(!i.canDelete)return toast('This file is outside your project\'s export folder, so it is not deleted from here. You can hide it instead.',true);
 if(!await ask('Delete this video for good?',`${i.name} (${mb(i.bytes)}) is removed from your computer. This cannot be undone.`,'Delete the file',true))return;
 act(async()=>{await api('/api/gallery/'+id,{method:'DELETE'});Gallery.picked.delete(id);App.go('studio/gallery');},'Deleted');};
window.galleryStar=(id,on)=>act(()=>api(`/api/gallery/${id}/star`,{method:'POST',body:JSON.stringify({on})}),on?'Starred':'Star removed');
window.galleryPick=(id,on)=>{on?Gallery.picked.add(id):Gallery.picked.delete(id);if(Gallery.picked.size>2)Gallery.picked.delete([...Gallery.picked][0]);App.show(false);};
window.galleryHide=async id=>{if(!await ask('Hide this video?','It leaves the gallery. The file stays where it is, and you can show hidden videos again.','Hide it'))return;
 act(async()=>{await api(`/api/gallery/${id}/hide`,{method:'POST',body:JSON.stringify({on:true})});App.go('studio/gallery');},'Hidden. The file was not deleted.');};
window.galleryTeach=async id=>{try{const v=await api(`/api/gallery/${id}/teach`,{method:'POST',body:'{}'});Teach.cur=v.id;App.go('teach/add');}catch(e){toast(e.message,true);}};
window.galleryCompare=()=>{
 const [a,b]=[...Gallery.picked].map(id=>App.screens['studio/gallery'].data.items.find(i=>i.id===id)).filter(Boolean);if(!a||!b)return toast('Pick two videos to compare.',true);
 const cell=i=>`<div><video playsinline preload="metadata" src="${withKey('/gallery/file/'+i.id)}"></video><b dir="auto" style="display:block;margin-top:8px;font-size:13px">${esc(i.title)}</b><span class="muted small">${kindLabel(i.kind)}${i.seconds?', '+fmtS(i.seconds):''}${i.rating?', rated '+(i.rating==='ok'?'not bad':i.rating):''}</span></div>`;
 dialog(`<h2>Compare</h2><div class="gallery-compare" style="margin-top:14px">${cell(a)}${cell(b)}</div>
  <div class="dialog-actions"><button class="btn" id="gc-restart">From the start</button><button class="btn primary" id="gc-play">Play both</button><button class="btn" onclick="closeDialog()">Close</button></div>`,{wide:true});
 const vs=[...document.querySelectorAll('.gallery-compare video')];vs[1].muted=true;
 $('#gc-play').onclick=()=>{const playing=!vs[0].paused;vs.forEach(v=>playing?v.pause():v.play());$('#gc-play').textContent=playing?'Play both':'Pause both';};
 $('#gc-restart').onclick=()=>vs.forEach(v=>{v.currentTime=0;});
};

/** The publish kit: covers to choose from (each frame with each title), then a post package for the
 *  platforms you post on, its words checked against their limits as you type. Nothing is posted. */
const PLAT=[['tiktok','TikTok'],['reels','Instagram Reels'],['shorts','YouTube Shorts'],['youtube','YouTube']];
window.galleryPublish=id=>{const i=App.screens['studio/gallery'].data.items.find(x=>x.id===id);if(!i)return;
 const pf=(key,name,dl)=>withKey(`/publish-file/${key}/${encodeURIComponent(name)}`)+(dl?'&dl=1':'');
 dialog(`<h2>Publish ${esc(i.title)}</h2><p class="muted">Covers to choose from, and everything to post it: the video in each platform's shape, its cover, and your words, checked. Nothing is posted for you.</p>
  <div class="pub-step"><h3>Covers</h3><label class="f" for="pb-titles">Titles to try, one a line (up to 4)</label><textarea id="pb-titles" dir="auto" rows="3" maxlength="400" placeholder="Five mistakes with a new camera"></textarea>
   <div class="row" style="margin-top:10px"><button class="btn" id="pb-covers">Make covers</button><span class="muted small" id="pb-cstate"></span></div><div id="pb-cout"></div></div>
  <div class="pub-step"><h3>Post package</h3><div class="row">${PLAT.map(([k,l])=>`<label class="check"><input type="checkbox" data-pl="${k}" ${k!=='youtube'?'checked':''}> ${l}</label>`).join('')}</div>
   <label class="f" for="pb-title">Title</label><input id="pb-title" type="text" dir="auto" maxlength="200">
   <label class="f" for="pb-cap">Caption or description</label><textarea id="pb-cap" dir="auto" rows="3" maxlength="6000"></textarea>
   <label class="f" for="pb-tags">Hashtags</label><input id="pb-tags" type="text" dir="auto" placeholder="camera, filmmaking" maxlength="600">
   <ul class="pub-checks" id="pb-checks" aria-live="polite"></ul>
   <div class="row" style="margin-top:10px"><button class="btn primary" id="pb-pack">Make the post package</button><span class="muted small" id="pb-pstate"></span></div><div id="pb-pout"></div></div>
  <div class="dialog-actions"><button class="btn" onclick="closeDialog()">Close</button></div>`,{wide:true});
 const words=()=>({platforms:[...document.querySelectorAll('[data-pl]')].filter(x=>x.checked).map(x=>x.dataset.pl),title:$('#pb-title').value,caption:$('#pb-cap').value,tags:$('#pb-tags').value.split(/[,\s]+/).filter(Boolean)});
 const showChecks=list=>{$('#pb-checks').innerHTML=list.map(c=>`<li class="${c.ok?(c.warnings.length?'warn':'ok'):'bad'}"><b>${esc(c.name)}</b> ${c.ok&&!c.warnings.length?'ready':esc([...c.errors,...c.warnings].join(' '))}</li>`).join('');};
 let t;const check=()=>{clearTimeout(t);t=setTimeout(async()=>{try{showChecks(await api(`/api/gallery/${id}/check`,{method:'POST',body:JSON.stringify({...words(),seconds:i.seconds})}));}catch{}},250);};
 ['#pb-title','#pb-cap','#pb-tags'].forEach(s=>$(s).oninput=check);document.querySelectorAll('[data-pl]').forEach(x=>x.onchange=check);check();
 $('#pb-covers').onclick=async()=>{const b=$('#pb-covers');b.disabled=true;$('#pb-cstate').innerHTML='<span class="spin"></span> Choosing frames and drawing the covers';
  try{const r=await api(`/api/gallery/${id}/covers`,{method:'POST',body:JSON.stringify({titles:$('#pb-titles').value.split('\n'),count:3})});
   $('#pb-cout').innerHTML=`<div class="pub-covers">${r.covers.map(c=>`<figure><img src="${pf(r.key,c.file)}" alt="${esc(c.title||'Cover')}" loading="lazy"><figcaption class="small"><span dir="auto">${esc(c.title||'No title')}</span><a class="btn small ghost" href="${pf(r.key,c.file,true)}" download>${I.down}</a></figcaption></figure>`).join('')}</div><p class="muted small">Saved in ${esc(r.folder)}</p>`;
   $('#pb-cstate').textContent='';}catch(e){$('#pb-cstate').textContent='';toast(e.message,true);}b.disabled=false;};
 $('#pb-pack').onclick=async()=>{const w=words();if(!w.platforms.length)return toast('Choose where you will post it',true);const b=$('#pb-pack');b.disabled=true;$('#pb-pstate').innerHTML='<span class="spin"></span> Making each shape and its cover';
  try{const r=await api(`/api/gallery/${id}/package`,{method:'POST',body:JSON.stringify(w)});showChecks(r.checks);
   $('#pb-pout').innerHTML=`<div class="tx-made">${r.files.map(f=>`<div class="row"><span class="small">${esc(f)}</span><a class="btn small ghost" style="margin-left:auto" href="${pf(r.key,f,true)}" download>${I.down} Download</a></div>`).join('')}</div><p class="muted small">${r.ready?'Ready to post.':'Fix what is marked before posting.'} Saved in ${esc(r.folder)}</p>`;
   $('#pb-pstate').textContent='';}catch(e){$('#pb-pstate').textContent='';toast(e.message,true);}b.disabled=false;};
};
