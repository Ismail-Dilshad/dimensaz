'use strict';
// What the studio has learned: lessons, sorted automatically into the three ways of teaching and
// by topic; and patterns, each drawn as a range against your examples.
Teach.les={group:'all',status:'all',q:'',...store.get('teach-les',{})};
const lessonState=l=>l.status==='trial'?'trial':['approved','proven'].includes(l.status)?'kept':'removed';

App.register('teach/lessons',{
 head:()=>({title:'What your studio has learned',text:'Lessons from your videos and the ones you wrote, sorted for you. New ones start on trial; keep, reword or remove each.'}),
 title:()=>'Lessons',sub:()=>'What your videos taught, and what you wrote yourself',load:Teach.load,
 actions:()=>`<button class="btn" onclick="exportLessons()">${I.down} Export</button><button class="btn primary" onclick="writeLesson()">${I.add} Write a lesson</button>`,
 render(el){
  const S=this.data,all=S.lessons,f=Teach.les,q=f.q.trim().toLowerCase();
  if(!all.length){el.innerHTML=`<div class="empty"><h2>No lessons yet</h2><p>They appear after your agent studies a taught video. You can also write one yourself.</p><button class="btn primary" onclick="writeLesson()">Write a lesson</button></div>`;return;}
  const inGroup=all.filter(l=>f.group==='all'||l.group===f.group);
  const show=inGroup.filter(l=>(f.status==='all'||lessonState(l)===f.status)&&(!q||l.body.toLowerCase().includes(q)));
  const n=st=>inGroup.filter(l=>lessonState(l)===st).length;
  const conflicts=S.conflicts.filter(c=>f.group==='all'||c.lesson.group===f.group),conflictIds=new Set(S.conflicts.map(c=>c.lesson.id));
  const trial=show.filter(l=>l.status==='trial'&&!conflictIds.has(l.id));Teach.trialShown=trial.map(l=>l.id);
  const row=l=>{const gone=lessonState(l)==='removed',id=esc(l.id),key='L|'+l.id;
   if(Teach.editing===key)return `<div class="lesson-row" id="edit-${esc(key)}"><div style="flex:1"><textarea id="et" dir="auto" maxlength="1500">${esc(l.body)}</textarea><div class="row" style="margin-top:8px"><button class="btn primary" onclick="saveLesson('${id}')">Save and keep</button><button class="btn" onclick="Teach.editing=null;App.show(false)">Cancel</button></div></div></div>`;
   return `<div class="lesson-row ${gone?'gone':''}"><div class="lesson-main"><b dir="auto">${l.kind==='avoid'&&!/^(avoid|never|no |do not|don't)/i.test(l.body)?'<span class="avoid">Avoid</span> ':''}${esc(l.body)}</b>
     <small>${l.status==='trial'?'<span class="badge wait">on trial</span>':gone?'<span class="badge st">removed</span>':`<span class="badge good">${l.status==='proven'?'proven':'kept'}</span>`}
      ${l.mine?'written by you':l.videos>1?`seen in ${l.videos} videos`:'from 1 video'}${l.uses?`, used ${l.uses}×`:''}${l.wins||l.losses?`, ${l.wins} good ${l.losses} bad`:''}
      <span class="conf-wrap"><span class="conf" role="img" aria-label="Confidence ${l.confidence}%"><i style="width:${l.confidence}%"></i></span>${l.confidence}%</span></small></div>
    <div class="lesson-actions">${l.status==='trial'?`<button class="btn primary" onclick="lessonDo('${id}','${l.conflictWith?'both':'keep'}','Kept')">Keep</button>`:''}
     ${gone?`<button class="btn" onclick="lessonDo('${id}','both','Brought back')">Bring back</button>`:`<button class="btn" onclick="Teach.editing='${esc(key)}';App.show(false)">Reword</button><button class="btn danger-text" onclick="lessonDo('${id}','remove','Removed')">Remove</button>`}</div></div>`;};
  const groups=S.groups.filter(g=>f.group==='all'||g.id===f.group);
  el.innerHTML=groupTiles(S.groups,f.group,g=>all.filter(l=>g==='all'||l.group===g).length,'lessons','lessonGroup')+
  `<div class="toolbar"><div class="focus-chips" role="group" aria-label="State">${[['all','All',inGroup.length],['trial','On trial',n('trial')],['kept','Kept',n('kept')],['removed','Removed',n('removed')]].map(([id,l,c])=>`<button type="button" aria-pressed="${f.status===id}" onclick="lessonStatus('${id}')">${l} <span class="muted">${c}</span></button>`).join('')}</div>
   <div class="search" style="margin-inline-start:auto">${I.search}<input type="text" id="lesq" placeholder="Search the lessons" value="${esc(f.q)}" aria-label="Search the lessons"></div>
   ${trial.length>1?`<button class="btn" onclick="keepAll()">Keep all ${trial.length} on trial</button>`:''}</div>
  ${conflicts.length&&f.status!=='kept'&&f.status!=='removed'?`<section class="card decide"><div class="teach-section-head"><h3>To decide</h3><span class="muted small">${conflicts.length} new lesson${conflicts.length>1?'s say':' says'} the opposite of something known</span></div>
   ${conflicts.map(c=>`<div class="decide-pair"><div><small>New, from a taught video</small><b dir="auto">${esc(c.lesson.body)}</b></div><div><small>Already known</small><b dir="auto">${esc(c.against.body)}</b></div>
    <div class="row"><button class="btn primary" onclick="lessonDo('${esc(c.lesson.id)}','keep','Kept the new one')">Keep the new one</button><button class="btn" onclick="lessonDo('${esc(c.lesson.id)}','remove','Kept what was known')">Keep what was known</button><button class="btn" onclick="lessonDo('${esc(c.lesson.id)}','both','Kept both')">Keep both</button></div></div>`).join('')}</section>`:''}
  ${groups.map(g=>{const topics=S.topics.filter(t=>g.topics.includes(t.id)).map(t=>({t,list:show.filter(l=>l.group===g.id&&(l.topics[0]||g.topics[0])===t.id&&!(conflictIds.has(l.id)&&l.status==='trial'))})).filter(x=>x.list.length);
   return topics.length?`${f.group==='all'?`<h3 class="group-title">${esc(g.label)} <span class="muted">${topics.reduce((a,x)=>a+x.list.length,0)}</span></h3>`:''}<div class="lesson-cards">${topics.map(({t,list})=>`<section class="card"><div class="teach-section-head"><h3>${esc(t.label)}</h3><span class="muted small">${list.length} lesson${list.length===1?'':'s'}</span></div>${list.map(row).join('')}</section>`).join('')}</div>`:'';}).join('')}
  ${show.length?'':`<div class="card" style="text-align:center"><p class="muted">Nothing matches.</p><button class="btn" onclick="Teach.les={group:'all',status:'all',q:''};store.set('teach-les',Teach.les);App.show(false)">Clear the filters</button></div>`}`;
  const qi=$('#lesq');qi.oninput=()=>{f.q=qi.value;store.set('teach-les',f);clearTimeout(Teach.qt);Teach.qt=setTimeout(()=>{App.show(false);const x=$('#lesq');x.focus();x.setSelectionRange(x.value.length,x.value.length);},250);};
 }});
window.lessonGroup=g=>{Teach.les.group=g;store.set('teach-les',Teach.les);App.show(false);};
window.lessonStatus=s=>{Teach.les.status=s;store.set('teach-les',Teach.les);App.show(false);};
window.keepAll=async()=>{const ids=Teach.trialShown||[];if(!ids.length||!await ask(`Keep all ${ids.length} lessons?`,'They are applied to new videos whenever they fit. You can still reword or remove each one.','Keep them'))return;
 act(async()=>{for(const id of ids)await api('/api/lessons/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({action:'both'})});},`Kept ${ids.length} lessons`);};
window.exportLessons=()=>{
 const S=Teach.S,live=S.lessons.filter(l=>lessonState(l)!=='removed');
 const md=`# Tempoloom lessons\n\nExported ${new Date().toISOString().slice(0,10)}: ${live.length} lessons and ${S.patterns.found.length} patterns.\n\n`+
  (S.patterns.found.length?`## Patterns your good examples share\n\n${S.patterns.found.map(p=>`- ${p.body}`).join('\n')}\n\n`:'')+
  S.groups.map(g=>{const mine=live.filter(l=>l.group===g.id);return mine.length?`## ${g.label}\n\n`+S.topics.filter(t=>g.topics.includes(t.id)).map(t=>{const list=mine.filter(l=>(l.topics[0]||g.topics[0])===t.id);
   return list.length?`### ${t.label}\n\n${list.map(l=>`- ${l.kind==='avoid'?'Avoid: ':''}${l.body} (${l.status==='trial'?'on trial':l.status}, confidence ${l.confidence}%)`).join('\n')}\n`:'';}).filter(Boolean).join('\n'):'';}).filter(Boolean).join('\n');
 download('tempoloom-lessons.md',md);
};
window.writeLesson=()=>{
 const S=Teach.S;
 dialog(`<h2>Write a lesson</h2><p class="muted">Something you already know should always be done, or never. It is kept at once and sorted by its topic.</p>
  <label class="f" for="wl">The lesson</label><textarea id="wl" dir="auto" maxlength="1500" placeholder="For example: end every ad on the logo for at least 2 seconds, with the website address under it."></textarea>
  <fieldset class="teach-example" style="margin-top:14px"><legend>How should the studio use it?</legend><div class="example-choices"><label><input type="radio" name="wk" value="do" checked><span><b>Do this</b><small>Apply it whenever it fits.</small></span></label><label><input type="radio" name="wk" value="avoid"><span><b>Avoid this</b><small>Never do it.</small></span></label></div></fieldset>
  <label class="f">About</label><div class="focus-chips" id="wt">${S.topics.map(t=>`<button type="button" aria-pressed="false" data-t="${t.id}">${esc(t.label)}</button>`).join('')}</div>
  <div class="dialog-actions"><button class="btn" onclick="closeDialog()">Cancel</button><button class="btn primary" id="wsave">Save the lesson</button></div>`);
 $('#wt').onclick=e=>{const b=e.target.closest('button');if(b)b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')!=='true');};
 $('#wl').focus();
 $('#wsave').onclick=async()=>{const text=$('#wl').value.trim(),topics=[...document.querySelectorAll('#wt [aria-pressed=true]')].map(b=>b.dataset.t),avoid=document.querySelector('[name=wk]:checked').value==='avoid';
  try{await api('/api/lessons',{method:'POST',body:JSON.stringify({text,topics,avoid})});closeDialog(true);toast('Lesson saved');await App.refresh(true);}catch(e){toast(e.message,true);}};
};

// ---------- patterns ----------
Teach.pat={group:'all'};
/** A pattern as a picture: the range your good examples share on a scale, each example as a dot, and where the bad ones sit. */
function rangeBar(p){
 const [a,b]=p.scale,pos=x=>Math.max(0,Math.min(100,(x-a)/(b-a)*100));
 return `<div class="range" role="img" aria-label="${esc(p.label)}: ${p.lo} to ${p.hi}${esc(p.unit)}, typically ${p.mid}">
  <span class="range-band" style="left:${pos(p.lo)}%;width:${Math.max(1.5,pos(p.hi)-pos(p.lo))}%"></span>
  ${p.values.map(v=>`<span class="range-dot" style="left:${pos(v)}%"></span>`).join('')}
  <span class="range-mid" style="left:${pos(p.mid)}%"></span>${p.bad!==null?`<span class="range-bad" style="left:${pos(p.bad)}%" title="Your bad examples: ${p.bad}${esc(p.unit)}"></span>`:''}</div>
  <div class="range-scale"><span>${a}${esc(p.unit)}</span>${p.bad!==null?`<span class="bad-key">bad examples at ${p.bad}${esc(p.unit)}</span>`:''}<span>${b}${esc(p.unit)}</span></div>`;
}
App.register('teach/patterns',{
 head(){const p=this.data.patterns;return {title:'What your good examples share',text:`Measured on every video you taught and sorted for you. A pattern needs at least three good examples that agree; one far from the rest is left out. So far: ${p.from.good} good and ${p.from.bad} bad examples.`};},
 title:()=>'Patterns',sub:()=>'What your good examples have in common',load:Teach.load,
 actions:()=>`<a class="btn" href="#/taste">Open your taste</a><a class="btn primary" href="#/teach/add">${I.add} Teach a video</a>`,
 render(el){
  const S=this.data,p=S.patterns,f=Teach.pat;
  if(!p.found.length&&!p.unclear.length){el.innerHTML=`<div class="empty"><h2>No patterns yet</h2><p>${p.from.good<3?`Teach ${3-p.from.good} more good example${3-p.from.good>1?'s':''} on the same topic to see the first pattern.`:'Your good examples do not agree closely enough yet.'}</p><a class="btn primary" href="#/teach/add">Teach a video</a></div>`;return;}
  const show=p.found.filter(x=>f.group==='all'||x.group===f.group);
  el.innerHTML=groupTiles(S.groups,f.group,g=>p.found.filter(x=>g==='all'||x.group===g).length,'patterns','patternGroup')+
  (show.length?`<div class="pattern-grid">${show.map(x=>`<section class="card"><div class="teach-section-head"><h3>${esc(x.label)}</h3><span class="chip">${esc(topicLabel(x.topic))}</span></div>
    <div class="pattern-value">${x.lo===x.hi?x.lo:`${x.lo} <span>to</span> ${x.hi}`}<small>${esc(x.unit.trim())}</small></div>${rangeBar(x)}
    <p class="muted small">This is ${esc(x.about)}. Typically ${x.mid}${esc(x.unit)} across ${x.videos.length} good examples${x.leftOut?`; ${x.leftOut} far from the rest ${x.leftOut>1?'were':'was'} left out`:''}.</p></section>`).join('')}</div>`
   :`<div class="card" style="text-align:center"><p class="muted">No patterns in this category yet. Teach three good examples that agree on it.</p></div>`)+
  (p.unclear.length?`<details class="teach-options" style="margin-top:18px"><summary>${p.unclear.length} measurement${p.unclear.length>1?'s':''} your examples disagree on</summary>${p.unclear.map(u=>`<div class="lesson-row gone"><div class="lesson-main"><b>${esc(u.metric)}</b><small>${esc(u.why)}</small></div></div>`).join('')}</details>`:'');
 }});
window.patternGroup=g=>{Teach.pat.group=g;App.show(false);};
