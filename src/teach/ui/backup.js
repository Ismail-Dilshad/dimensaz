'use strict';
// Backup and move: everything the studio learned in one file, to keep it safe or to carry it to
// another computer. Restoring saves a backup of what is here first, then merges.
I.box=ICON('<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>');
const Bk={file:null,preview:null,mode:'merge',busy:false};
const WHAT=['Lessons and their scores','Taught videos (their measurements and lessons, not the videos)','Your taste profiles and feedback rules','Studio jobs and your ratings','Thumbnails, gallery stars and your settings (never your keys)'];
App.register('backup',{
 title:()=>'Backup and move',sub:()=>'Everything the studio learned, in one file',load:()=>api('/api/backups'),hold:()=>Bk.busy,
 head:()=>({title:'Backup and move',text:'Everything the studio learned in one file. Keep it somewhere safe, or open it on another computer to carry on where you stopped. Your keys and your videos are never in it.'}),
 render(el){
  const d=this.data,p=Bk.preview,rows=p?p.changes.filter(c=>c.add+c.update+c.same+c.keep):[],nothing=!!p&&rows.every(c=>!c.add&&!c.update);
  const kind=k=>({manual:'made by you',auto:'weekly, automatic','before restore':'saved before a restore'}[k]||k);
  el.innerHTML=`<section class="card"><div class="teach-section-head"><h3>Make a backup</h3></div>
   <ul class="backup-what">${WHAT.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>
   <div class="row" style="margin-top:14px"><a class="btn primary" href="${withKey('/api/backups/download')}" download>${I.down} Download a backup</a><button class="btn" onclick="bkSave()">Save one in the backups folder</button></div></section>
  <section class="card"><div class="teach-section-head"><h3>Restore, or move from another computer</h3></div>
   <div class="pickfile"><button class="btn" onclick="$('#bkfile').click()">${I.box} Choose a backup file</button>${Bk.file?`<span class="muted small" dir="auto">${esc(Bk.file.name)}</span>`:''}${Bk.busy?'<span class="spin"></span>':''}<input id="bkfile" type="file" accept=".zip,application/zip" hidden></div>
   ${p?`<p class="small" style="margin:14px 0 4px">Made ${esc(new Date(p.manifest.created).toLocaleString())} by Tempoloom ${esc(p.manifest.app)}: ${p.manifest.counts.lessons} lessons, ${p.manifest.counts.taught} taught videos, ${p.manifest.counts.profiles} taste profile${p.manifest.counts.profiles===1?'':'s'}, ${p.manifest.counts.studioJobs} studio job${p.manifest.counts.studioJobs===1?'':'s'}.</p>
    <fieldset class="teach-example" style="margin-top:12px"><legend>How to restore</legend><div class="example-choices">
     <label><input type="radio" name="bkmode" value="merge" ${Bk.mode==='merge'?'checked':''}><span><b>Merge (recommended)</b><small>Newer wins item by item. Nothing is removed, and your own settings and taste profiles stay.</small></span></label>
     <label><input type="radio" name="bkmode" value="replace" ${Bk.mode==='replace'?'checked':''}><span><b>Replace</b><small>The backup wins everywhere it has something. Use it to make this computer match the other one.</small></span></label></div></fieldset>
    <div class="table-wrap"><table class="bk-table"><thead><tr><th>What</th><th>New</th><th>Updated</th><th>Same</th><th>Yours kept</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${esc(c.what)}</td><td>${c.add}</td><td>${c.update}</td><td>${c.same}</td><td>${c.keep}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted small">Before anything changes, a backup of what is here now is saved in the backups folder, so a restore can always be undone.</p>
    ${nothing?`<div class="banner">Everything in this backup is already here${Bk.mode==='merge'?', or newer here':''}. Nothing would change.</div>`:''}
    <div class="row"><button class="btn primary" onclick="bkRestore()" ${Bk.busy||nothing?'disabled':''}>Restore</button><button class="btn ghost" onclick="Bk.file=null;Bk.preview=null;App.show(false)">Cancel</button></div>`
   :`<p class="muted small" style="margin-top:10px">Choose a backup made here or on another computer. Nothing changes until you see what it holds and press Restore.</p>`}</section>
  <section class="card"><div class="teach-section-head"><h3>Your backups</h3><span class="muted small">${d.backups.length}</span></div><p class="muted small bk-folder" dir="ltr">${esc(d.folder)}</p>
   ${d.backups.length?d.backups.map(b=>`<div class="service"><div class="service-main"><b dir="auto">${esc(b.name)}</b><p class="muted small">${esc(kind(b.kind))}, ${mb(b.bytes)}, ${ago(b.at)}</p></div><div class="row service-actions"><a class="btn small" href="${withKey('/api/backups/file/'+encodeURIComponent(b.name))}" download>${I.down} Download</a></div></div>`).join('')
   :'<p class="muted small">None yet.</p>'}
   <p class="muted small" style="margin-top:12px">A backup is also made by itself once a week when the app opens; the four newest are kept.</p></section>`;
  $('#bkfile').onchange=e=>{const f=e.target.files[0];if(f){Bk.file=f;bkCheck();}};
  el.querySelectorAll('[name=bkmode]').forEach(x=>x.onchange=()=>{Bk.mode=x.value;bkCheck();});
 }
});
async function bkCheck(){Bk.busy=true;App.show(false);
 try{const r=await fetch(withKey('/api/backups/check?mode='+Bk.mode),{method:'POST',headers:{'x-teach-key':KEY},body:Bk.file});const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not read it');Bk.preview=j;}
 catch(e){toast(e.message,true);Bk.file=null;Bk.preview=null;}
 Bk.busy=false;App.show(false);}
window.bkSave=()=>act(async()=>{const r=await api('/api/backups',{method:'POST',body:'{}'});toast('Saved '+r.file.split(/[\\/]/).pop());});
window.bkRestore=async()=>{if(!Bk.preview)return;
 if(!await ask(Bk.mode==='replace'?'Replace with this backup?':'Merge this backup?',Bk.mode==='replace'?'Where the backup has something, it wins. A backup of what is here now is saved first.':'Newer wins item by item and nothing is removed. A backup of what is here now is saved first.','Restore',Bk.mode==='replace'))return;
 Bk.busy=true;App.show(false);
 try{const r=await api('/api/backups/restore',{method:'POST',body:JSON.stringify({token:Bk.preview.token,mode:Bk.mode})});const n=r.changes.reduce((a,c)=>a+c.add+c.update,0);
  toast(`Restored: ${n} thing${n===1?'':'s'} added or updated. What was here before is saved as ${r.savedFirst.split(/[\\/]/).pop()}.`);Bk.file=null;Bk.preview=null;}
 catch(e){toast(e.message,true);}
 Bk.busy=false;App.refresh(true);};
