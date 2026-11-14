'use strict';
// The script doctor on the page: every line with its score, what to change, the source of each
// figure and claim, and the better versions the agent suggested, to keep or decline. Used on the
// New video form (your own script, checked as you type) and on each video's page.
const SD={timer:null,last:'',busy:false};
const sdBadge=v=>v==='strong'?'good':v==='ok'?'wait':'bad';
const sdWord=v=>({strong:'strong',ok:'could be stronger',weak:'weak'})[v]||v;
/** The script, line by line. `job` turns on Keep and Decline for the agent's suggestions. */
function scriptDoctorHtml(d,o={}){
 if(!d||!d.lines.length)return '';
 const J=o.job?esc(o.job):'',secs=d.seconds.target?`${d.seconds.spoken} s spoken, ${d.seconds.target} s wanted`:`${d.seconds.spoken} s spoken`;
 const claim=c=>`<span class="sd-claim ${c.status}" title="${esc(c.status==='sourced'?'Source: '+(c.source||''):c.status==='doubtful'?'A claim with no source':'No source for this figure')}">${c.status==='sourced'?(/^https?:/.test(c.source||'')?`<a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">${esc(c.text)}</a>`:esc(c.text)):esc(c.text)}<small>${c.status==='sourced'?'sourced':c.status==='doubtful'?'needs a source':'no source'}</small></span>`;
 return `<div class="sd">
  <div class="sd-sum"><span class="badge ${sdBadge(d.verdict)}">${d.score} of 100, ${sdWord(d.verdict)}</span><span class="muted small">${secs}</span>
   ${d.weak.length?`<span class="muted small">${d.weak.length} weak line${d.weak.length>1?'s':''}</span>`:''}${d.unsourced.length?`<span class="muted small">${d.unsourced.length} without a source</span>`:''}
   ${o.job&&d.open?`<span class="badge wait">${d.open} suggestion${d.open>1?'s':''} to look at</span>`:''}</div>
  ${d.issues.length?`<div class="muted small sd-issues">${d.issues.map(i=>esc(i.detail)).join('. ')}.</div>`:''}
  <ol class="sd-lines">${d.lines.map(l=>`<li class="sd-line ${l.verdict}">
   <div class="sd-head"><span class="sd-score ${sdBadge(l.verdict)}" title="${esc(sdWord(l.verdict))}">${l.score}</span><span class="sd-text" dir="auto">${esc(l.text)}</span>
    <span class="sd-meta">${l.job==='hook'?'<span class="chip">hook</span>':l.job==='cta'?'<span class="chip">call to action</span>':''}<span class="muted small">${l.seconds} s</span></span></div>
   ${l.notes.length?`<ul class="sd-notes">${l.notes.map(n=>`<li><b>${esc(n.what)}.</b> ${esc(n.fix)}.</li>`).join('')}</ul>`:''}
   ${l.claims.length?`<div class="sd-claims">${l.claims.map(claim).join('')}</div>`:''}
   ${o.job?l.suggestions.map(s=>`<div class="sd-suggest"><div><small class="muted">Suggested${s.why?': '+esc(s.why):''}</small><div dir="auto">${esc(s.text)}</div></div>
    ${o.canChange?`<div class="row"><button class="btn small primary" onclick="sdChoose('${J}','${esc(s.id)}',true)">Keep</button><button class="btn small ghost" onclick="sdChoose('${J}','${esc(s.id)}',false)">Decline</button></div>`:''}</div>`).join(''):''}
  </li>`).join('')}</ol></div>`;
}
window.sdChoose=(job,id,keepIt)=>act(()=>api(`/api/studio/jobs/${encodeURIComponent(job)}/script/${keepIt?'keep':'decline'}`,{method:'POST',body:JSON.stringify({id})}),keepIt?'Kept: the line is changed in the script':'Declined');
/** Checks the script on the New video form a moment after typing stops. */
function sdLive(){
 const box=$('#sd-live');if(!box)return;const N=Studio.N;
 if(!(N.mode==='motion'&&N.script&&N.text.trim())){box.innerHTML='';SD.last='';return;}
 const key=JSON.stringify([N.text,N.seconds,N.language]);if(key===SD.last)return;
 clearTimeout(SD.timer);SD.timer=setTimeout(async()=>{SD.last=key;
  try{const d=await api('/api/script/doctor',{method:'POST',body:JSON.stringify({text:N.text,seconds:Number(N.seconds)||undefined,language:N.language||undefined})});
   const el=$('#sd-live');if(el)el.innerHTML=`<details class="teach-focus sd-box" ${store.get('sd-open',true)?'open':''} ontoggle="store.set('sd-open',this.open)"><summary>Script check, line by line<span class="muted">${d.score} of 100</span></summary>
    <p class="muted small" style="margin:8px 0 0">Your words stay yours: this only says what could be stronger. Change what you like before you send it; the studio can also suggest better lines for you to keep or decline.</p>${scriptDoctorHtml(d)}</details>`;}
  catch{/* the check is a help, never in the way */}},500);
}
