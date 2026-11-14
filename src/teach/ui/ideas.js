'use strict';
// Trend watch: formats getting popular for the topics you watch, each with the links it was seen
// in, to accept (the scriptwriter uses it, on trial) or ignore. Reach only reads; nothing is posted.
I.trend=ICON('<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>');
App.nav.splice(App.nav.findIndex(n=>n[0]==='studio/videos'),0,['studio/ideas','Trend watch','trend','Studio',h=>[h.trends||0,h.trends||0]]);
const TW={checking:false};
App.register('studio/ideas',{
 title:()=>'Trend watch',sub:()=>'Formats getting popular for your topics',load:()=>api('/api/trends'),hold:()=>TW.checking,
 head:()=>({title:'Trend watch',text:'Name a few topics. Each check reads the newest top videos for them and brings back the formats several of them share, with the links, for you to accept or ignore. An accepted format becomes a lesson on trial for the scriptwriter.'}),
 actions:()=>`<button class="btn primary" onclick="twCheck()" ${TW.checking||!App.screens['studio/ideas'].data?.topics.length?'disabled':''}>${TW.checking?'<span class="spin"></span> Checking':`${I.trend} Check now`}</button>`,
 render(el){
  const d=this.data,problems=d.topics.flatMap(t=>Object.entries(t.problems).map(([ch,why])=>`${t.topic}, ${ch}: ${why}`));
  el.innerHTML=`<section class="card"><div class="teach-section-head"><h3>Your topics</h3><span class="muted small">${d.topics.length} of 12</span></div>
   <div class="focus-chips tw-topics">${d.topics.map(t=>`<span class="tw-topic"><span dir="auto">${esc(t.topic)}</span><small class="muted">${t.checked?`${t.results} results, ${ago(t.checked)}`:'not checked yet'}</small><button class="iconbtn" aria-label="Stop watching ${esc(t.topic)}" onclick="twRemove(${esc(JSON.stringify(t.topic))})">${I.x}</button></span>`).join('')||'<span class="muted small">No topics yet.</span>'}</div>
   <form class="row tw-add" onsubmit="event.preventDefault();twAdd()"><input type="text" id="tw-topic" dir="auto" maxlength="80" placeholder="A topic, for example: coffee shop marketing"><button class="btn">Watch it</button></form>
   ${problems.length?`<details class="teach-focus"><summary>Some channels did not answer<span class="muted">${problems.length}</span></summary><p>${problems.map(esc).join('<br>')}</p><p>See what is set up with <code>pnpm tempoloom reach channels</code>.</p></details>`:''}</section>
  ${d.suggestions.length?`<section class="card"><div class="teach-section-head"><h3>New formats</h3><span class="muted small">${d.suggestions.length}</span></div>
   <div class="tw-list">${d.suggestions.map(s=>`<article class="tw-item"><div class="row" style="gap:8px"><b>${esc(s.label)}</b><span class="chip" dir="auto">${esc(s.topic)}</span>${s.rising?'<span class="badge good">rising</span>':''}<span class="muted small">in ${s.seen} of ${s.of} top results</span></div>
    <p class="muted small">${esc(s.about)}</p>
    ${s.examples.length?`<ul class="tw-ex">${s.examples.map(e=>`<li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer" dir="auto">${esc(e.title)}</a> <small class="muted">${esc(e.channel)}</small></li>`).join('')}</ul>`:''}
    <div class="row"><button class="btn small" onclick="twChoose('${esc(s.id)}','accept')">Use this format</button><button class="btn small ghost" onclick="twChoose('${esc(s.id)}','ignore')">Ignore</button></div></article>`).join('')}</div></section>`
   :`<section class="card"><p class="muted small" style="margin:0">${d.topics.length?'No new formats. Check again in a few days: a format several top videos share shows up here, marked "rising" when it grew since the last check.':'Add a topic above, then Check now.'}</p></section>`}
  ${d.accepted.length?`<section class="card"><div class="teach-section-head"><h3>Formats you use</h3><span class="muted small">on trial: your ratings decide if they stay</span></div>
   ${d.accepted.map(s=>`<div class="lesson"><b>${esc(s.label)}</b> <span class="muted small" dir="auto">for ${esc(s.topic)}</span></div>`).join('')}</section>`:''}`;
 }
});
window.twAdd=()=>{const t=$('#tw-topic').value.trim();if(!t)return;act(()=>api('/api/trends',{method:'POST',body:JSON.stringify({action:'add',topic:t})}),'Watching '+t);};
window.twRemove=t=>act(()=>api('/api/trends',{method:'POST',body:JSON.stringify({action:'remove',topic:t})}),'Stopped watching '+t);
window.twChoose=(id,what)=>act(()=>api(`/api/trends/${encodeURIComponent(id)}/${what}`,{method:'POST',body:'{}'}),what==='accept'?'The scriptwriter will use it (on trial)':'Ignored');
window.twCheck=async()=>{TW.checking=true;App.show(false);
 try{const r=await api('/api/trends/check',{method:'POST',body:'{}'});const n=r.topics.reduce((a,t)=>a+t.new,0);toast(n?`${n} new format${n>1?'s':''}`:'Checked: nothing new');}
 catch(e){toast(e.message,true);}TW.checking=false;App.refresh(true);};
