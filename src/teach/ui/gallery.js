'use strict';
// Gallery: every video the agent made or edited. Play it, see how it was rated and checked,
// star the best, compare two side by side, download, or teach from it as an example.
const Gallery={f:store.get('gallery-filter',{q:'',kind:'all',mode:'all',sort:'new',starred:false}),picked:new Set(),showHidden:false};
const kindLabel=k=>k==='final'?'Final':k==='preview'?'Preview':'Export';
App.register('studio/gallery',{
 title:a=>{const i=a&&App.screens['studio/gallery'].data?.items.find(x=>x.id===a);return i?i.title:'Gallery';},sub:a=>a?'':'Everything your studio has made',
 head(a){const d=this.data,i=a&&d.items.find(x=>x.id===a);
  return i?{title:i.title,text:`${kindLabel(i.kind)} ${i.mode==='edit'?'edit':i.mode==='motion'?'motion video':'video'}, made ${ago(i.made)}.`}
   :{title:'Everything your studio has made',text:`${d.totals.all} video${d.totals.all===1?'':'s'}: ${d.totals.finals} final, ${d.totals.previews} preview${d.totals.previews===1?'':'s'}, ${d.totals.exports} export${d.totals.exports===1?'':'s'}. The files stay in your project${d.folder?` (${d.folder})`:''}; nothing here deletes them.`};},
 load(){return api('/api/gallery'+(Gallery.showHidden?'?hidden=1':''));},
 actions(a){const d=App.screens['studio/gallery'].data;if(!d)return '';
  if(a)return `<a class="btn" href="#/studio/gallery">All videos</a>`;
  return `${Gallery.picked.size===2?`<button class="btn primary" onclick="galleryCompare()">Compare the 2</button>`:Gallery.picked.size?`<span class="muted small">Pick 2 to compare</span>`:''}<a class="btn" href="#/studio/new">${I.add} New video</a>`;},
 render(el,arg){
  const d=this.data,f=Gallery.f;
  if(arg){const i=d.items.find(x=>x.id===arg);el.innerHTML=i?galleryDetail(i):`<div class="empty"><h2>This video is not in the gallery</h2><a class="btn" href="#/studio/gallery">Open the gallery</a></div>`;return;}
  if(!d.items.length&&!d.hidden){el.innerHTML=`<div class="empty"><h2>No videos made yet</h2><p>When your studio finishes a preview or a final video, it appears here to play, compare and download.</p><a class="btn primary" href="#/studio/new">New video</a></div>`;return;}
  const q=f.q.trim().toLowerCase();
  let list=d.items.filter(i=>(f.kind==='all'||i.kind===f.kind)&&(f.mode==='all'||i.mode===f.mode)&&(!f.starred||i.starred)&&(!q||i.title.toLowerCase().includes(q)||i.name.toLowerCase().includes(q)));
  const key={new:i=>-new Date(i.made),old:i=>+new Date(i.made),long:i=>-(i.seconds||0),big:i=>-i.bytes,name:i=>i.title.toLowerCase()}[f.sort];
  list=list.slice().sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0);
  const opt=(id,label,pairs)=>`<select data-f="${id}" aria-label="${label}">${pairs.map(([v,l])=>`<option value="${v}"${f[id]===v?' selected':''}>${l}</option>`).join('')}</select>`;
  el.innerHTML=`<div class="toolbar"><div class="search">${I.search}<input type="text" id="galq" placeholder="Search your videos" value="${esc(f.q)}" aria-label="Search the gallery"></div>
   ${opt('kind','Kind',[['all','Finals and previews'],['final','Finals'],['preview','Previews'],['export','Exports']])}${opt('mode','Made as',[['all','Motion and edits'],['motion','Motion videos'],['edit','Edits']])}
   ${opt('sort','Order',[['new','Newest first'],['old','Oldest first'],['long','Longest'],['big','Largest file'],['name','By name']])}
   <button class="btn ${f.starred?'on':''}" id="galstar" aria-pressed="${f.starred}">${I.star} Starred${d.totals.starred?` ${d.totals.starred}`:''}</button></div>
  <div class="muted small" style="margin-bottom:12px">${list.length} of ${d.items.length} videos, ${d.totals.megabytes} MB in all</div>
  ${list.length?`<div class="gallery-grid">${list.map(i=>`<div class="gallery-card"><div class="gallery-media"><a href="#/studio/gallery/${i.id}" aria-label="Play ${esc(i.title)}"><span class="gallery-thumb"><img loading="lazy" alt="" src="${withKey('/gallery/thumb/'+i.id)}"><span class="gallery-play">${I.play}</span>
     <span class="gallery-tags"><span class="badge ${i.kind==='final'?'good':'st'}">${kindLabel(i.kind)}</span>${i.rating?`<span class="badge ${i.rating==='bad'?'bad':i.rating==='good'?'good':'st'}">${i.rating==='ok'?'not bad':i.rating}</span>`:''}</span></span></a>
    <button class="gallery-star" aria-pressed="${i.starred}" aria-label="${i.starred?'Remove the star from':'Star'} ${esc(i.title)}" onclick="galleryStar('${i.id}',${!i.starred})">${I.star}</button>
    <label class="gallery-pick" title="Pick to compare"><input type="checkbox" aria-label="Pick ${esc(i.title)} to compare" ${Gallery.picked.has(i.id)?'checked':''} onchange="galleryPick('${i.id}',this.checked)"></label></div>
    <b dir="auto">${esc(i.title)}</b><span class="muted small">${i.seconds?fmtS(i.seconds)+', ':''}${i.mode==='edit'?'edit':i.mode==='motion'?'motion':'video'}, ${ago(i.made)}</span></div>`).join('')}</div>`
   :`<div class="empty"><h2>Nothing matches</h2><button class="btn" onclick="Gallery.f={q:'',kind:'all',mode:'all',sort:'new',starred:false};store.set('gallery-filter',Gallery.f);App.show(false)">Clear the filters</button></div>`}
  ${d.hidden||Gallery.showHidden?`<button class="btn small ghost" style="margin-top:18px" onclick="Gallery.showHidden=!Gallery.showHidden;App.screens['studio/gallery'].data=null;App.refresh(true)">${Gallery.showHidden?'Stop showing hidden videos':`Show ${d.hidden} hidden`}</button>`:''}`;
  const qi=$('#galq');if(qi)qi.oninput=()=>{f.q=qi.value;store.set('gallery-filter',f);clearTimeout(Gallery.qt);Gallery.qt=setTimeout(()=>{App.show(false);const n=$('#galq');n.focus();n.setSelectionRange(n.value.length,n.value.length);},250);};
  el.querySelectorAll('[data-f]').forEach(s=>s.onchange=()=>{f[s.dataset.f]=s.value;store.set('gallery-filter',f);App.show(false);});
  if($('#galstar'))$('#galstar').onclick=()=>{f.starred=!f.starred;store.set('gallery-filter',f);App.show(false);};
 }});
function galleryDetail(i){
 const src=withKey('/gallery/file/'+i.id);
 return `<div class="gallery-player"><div class="card"><video controls playsinline preload="metadata" poster="${withKey('/gallery/thumb/'+i.id)}" src="${src}"></video></div>
  <div class="card teach-settings"><div class="teach-section-head"><h3>About this video</h3><span class="badge ${i.kind==='final'?'good':'st'}">${kindLabel(i.kind)}</span></div>
   <dl class="kv"><dt>Length</dt><dd>${i.seconds?fmtS(i.seconds):'unknown'}</dd><dt>Size</dt><dd>${i.width?`${i.width}×${i.height}, `:''}${mb(i.bytes)}</dd><dt>Made</dt><dd>${new Date(i.made).toLocaleString()}</dd>
    <dt>Your rating</dt><dd>${i.rating?(i.rating==='ok'?'not bad':i.rating):'not rated yet'}</dd>
    ${i.check?`<dt>Its own check</dt><dd>${i.check.passed} match${i.check.near?`, ${i.check.near} close`:''}${i.check.off?`, ${i.check.off} off`:''} your taste</dd>`:''}
    <dt>File</dt><dd style="overflow-wrap:anywhere">${esc(i.file)} <button class="iconbtn" style="vertical-align:middle" aria-label="Copy the file path" onclick="copyText(${esc(JSON.stringify(i.file))})">${I.copy}</button></dd></dl>
   <label class="teach-setting" style="margin-top:8px"><span><b>Starred</b><small>Keep your best work one click away.</small></span><input type="checkbox" role="switch" aria-label="Starred" ${i.starred?'checked':''} onchange="galleryStar('${i.id}',this.checked)"></label>
   <div class="teach-submit"><p class="muted">Teach from it as a good or a bad example, and the studio learns from its own work.</p>
    <div><span class="row"><a class="btn" href="${src}&dl=1" download>${I.down} Download</a>${i.job?`<a class="btn" href="#/studio/videos/${encodeURIComponent(i.job)}">Open its steps</a>`:''}</span>
     <button class="btn primary" onclick="galleryTeach('${i.id}')">Teach from this</button></div>
    <button class="btn small ghost danger-text" style="margin-top:12px" onclick="galleryHide('${i.id}')">Hide from the gallery</button></div></div></div>`;
}
window.galleryStar=(id,on)=>act(()=>api(`/api/gallery/${id}/star`,{method:'POST',body:JSON.stringify({on})}),on?'Starred':'Star removed');
window.galleryPick=(id,on)=>{on?Gallery.picked.add(id):Gallery.picked.delete(id);if(Gallery.picked.size>2)Gallery.picked.delete([...Gallery.picked][0]);App.show(false);};
window.galleryHide=async id=>{if(!await ask('Hide this video?','It leaves the gallery. The file stays where it is, and you can show hidden videos again.','Hide it'))return;
 act(async()=>{await api(`/api/gallery/${id}/hide`,{method:'POST',body:JSON.stringify({on:true})});App.go('studio/gallery');},'Hidden. The file was not deleted.');};
window.galleryTeach=async id=>{try{toast('Preparing it for the Teach page');const v=await api(`/api/gallery/${id}/teach`,{method:'POST',body:'{}'});Teach.cur=v.id;App.go('teach/add');}catch(e){toast(e.message,true);}};
window.galleryCompare=()=>{
 const [a,b]=[...Gallery.picked].map(id=>App.screens['studio/gallery'].data.items.find(i=>i.id===id)).filter(Boolean);if(!a||!b)return toast('Pick two videos to compare.',true);
 const cell=i=>`<div><video playsinline preload="metadata" src="${withKey('/gallery/file/'+i.id)}"></video><b dir="auto" style="display:block;margin-top:8px;font-size:13px">${esc(i.title)}</b><span class="muted small">${kindLabel(i.kind)}${i.seconds?', '+fmtS(i.seconds):''}${i.rating?', rated '+(i.rating==='ok'?'not bad':i.rating):''}</span></div>`;
 dialog(`<h2>Compare</h2><div class="gallery-compare" style="margin-top:14px">${cell(a)}${cell(b)}</div>
  <div class="dialog-actions"><button class="btn" id="gc-restart">From the start</button><button class="btn primary" id="gc-play">Play both</button><button class="btn" onclick="closeDialog()">Close</button></div>`,{wide:true});
 const vs=[...document.querySelectorAll('.gallery-compare video')];vs[1].muted=true;
 $('#gc-play').onclick=()=>{const playing=!vs[0].paused;vs.forEach(v=>playing?v.pause():v.play());$('#gc-play').textContent=playing?'Play both':'Pause both';};
 $('#gc-restart').onclick=()=>vs.forEach(v=>{v.currentTime=0;});
};
