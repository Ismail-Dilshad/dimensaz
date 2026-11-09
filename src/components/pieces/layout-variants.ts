// Alternative layouts for content pieces (layouts.ts lists them). Each keeps the timetable of
// its piece in content.ts / timing.ts: the same entrances, counts and checks at the same times,
// so sounds stay in step; only where things sit and what they look like changes.
import type {PieceContent} from '../../engine/scene-pieces-schema.js';
import {h,s,seg,ease,enter,alpha,mix,on,card,avatar,avatarColor,formatNumber,tick,R,surf,numberFont,trendColor,ink,type Built,type Ctx} from './kit.js';
import {unit,titleBar,NUM,nowLabel,chartPiece} from './content.js';

type Of<K extends PieceContent['kind']>=Extract<PieceContent,{kind:K}>;
const startSide=(c:Ctx,d=24)=>c.dir==='rtl'?d:-d;

// ---------- dashboard ----------
export function dashboardHero(p:Of<'dashboard'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,[first,...rest]=p.stats;
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*5}px;display:flex;flex-direction:column;gap:${u*2.5}px`));
 el.append(titleBar(c,p.title??'Overview',u)!);
 const big=h('div',`display:flex;align-items:baseline;gap:${u*2}px`);
 const val=h('div',`font-size:${Math.min(u*16,(c.box.w-u*14)/5)}px;font-weight:800;line-height:1;color:${ink(t.primary,t)};letter-spacing:-.03em;font-variant-numeric:tabular-nums;${NUM};${numberFont()}`);
 const tr=first!.trend==='none'?null:h('div',`font-size:${u*5}px;font-weight:800;color:${trendColor(first!.trend==='up',t.surface)}`,first!.trend==='up'?'▲':'▼');
 big.append(val);if(tr)big.append(tr);
 const label=h('div',`font-size:${u*3.6}px;color:${t.muted};font-weight:600`,first!.label);
 el.append(label,big);
 const ch=p.chart?chartPiece({...p.chart,title:undefined},{...c,box:{w:c.box.w*.85,h:c.box.h*.3},unit:u},true):null;
 const chartBox=ch?h('div',`flex:1;min-height:${u*14}px`):null;if(ch&&chartBox){chartBox.append(ch.el);el.append(chartBox);}
 const strip=h('div',`display:flex;gap:${u*4}px;border-top:1px solid ${alpha(t.text,.1)};padding-top:${u*2.5}px`);
 const small=rest.map((st,i)=>{const w=h('div','display:flex;flex-direction:column;min-width:0');
  const v=h('div',`font-size:${u*5.4}px;font-weight:800;color:${t.text};${NUM};${numberFont()}`);w.append(v,h('div',`font-size:${u*3}px;color:${t.muted};font-weight:600`,st.label));strip.append(w);return {w,v,st,i:i+1};});
 if(small.length)el.append(strip);
 const show=(st:typeof first,k:number)=>(st!.prefix??'')+formatNumber(st!.value*k,st!.decimals)+(st!.suffix??'');
 return {el,length:2.6,render:(x)=>{
  enter(el,seg(x,0,.55),{y:50});enter(label,seg(x,.35,.45),{y:12,scale:1});enter(big,seg(x,.35,.45),{y:20});
  val.textContent=show(first,ease.cubic(seg(x,.55,1.1)));if(tr)enter(tr,seg(x,1.35,.3),{y:8,scale:.5});
  for(const s2 of small){const st=.35+s2.i*.15;enter(s2.w,seg(x,st,.45),{y:16,scale:1});s2.v.textContent=show(s2.st,ease.cubic(seg(x,st+.2,1.1)));}
  if(ch&&chartBox){enter(chartBox,seg(x,.8,.45),{y:20,scale:1});ch.render(x-.9);}
 }};
}
export function dashboardList(p:Of<'dashboard'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*5}px;display:flex;flex-direction:column;gap:${u*1.5}px`));
 el.append(titleBar(c,p.title??'Overview',u)!);
 const rows=p.stats.map((st,i)=>{const r=h('div',`display:flex;align-items:center;gap:${u*2}px;padding:${u*2.4}px 0;border-bottom:1px solid ${alpha(t.text,.08)}`);
  const dot=h('div',`width:${u*2.4}px;height:${u*2.4}px;border-radius:50%;background:${i%2?t.accent:t.primary};flex:none`);
  const lb=h('div',`flex:1;font-size:${u*4}px;color:${t.text};font-weight:600;min-width:0`,st.label);
  const v=h('div',`font-size:${u*5.6}px;font-weight:800;color:${t.text};${NUM};${numberFont()}`);
  const tr=st.trend==='none'?null:h('div',`font-size:${u*3.4}px;font-weight:800;color:${trendColor(st.trend==='up',t.surface)}`,st.trend==='up'?'▲':'▼');
  r.append(dot,lb,v);if(tr)r.append(tr);el.append(r);return {r,v,tr,st,i};});
 const ch=p.chart?chartPiece({...p.chart,title:undefined},{...c,box:{w:c.box.w*.85,h:c.box.h*.35},unit:u},true):null;
 const chartBox=ch?h('div',`flex:1;min-height:${u*12}px;margin-top:${u*2}px`):null;if(ch&&chartBox){chartBox.append(ch.el);el.append(chartBox);}
 return {el,length:2.6,render:(x)=>{
  enter(el,seg(x,0,.55),{y:50});
  for(const r of rows){const st=.35+r.i*.15;enter(r.r,seg(x,st,.45),{x:startSide(c),y:0,scale:1});r.v.textContent=(r.st.prefix??'')+formatNumber(r.st.value*ease.cubic(seg(x,st+.2,1.1)),r.st.decimals)+(r.st.suffix??'');if(r.tr)enter(r.tr,seg(x,st+1,.3),{y:8,scale:.5});}
  if(ch&&chartBox){enter(chartBox,seg(x,.8,.45),{y:20,scale:1});ch.render(x-.9);}
 }};
}

// ---------- checklist ----------
function checkMark(c:Ctx,u:number,size:number){const t=c.theme;
 const circle=h('div',`width:${size}px;height:${size}px;border-radius:50%;border:${u*.7}px solid ${alpha(t.primary,.3)};display:flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box`);
 const tk=tick(size*.66,on(t.accent));circle.append(tk.el);
 return {circle,render:(q:number)=>{circle.style.background=q>0?t.accent:'transparent';circle.style.borderColor=q>0?t.accent:alpha(t.primary,.3);circle.style.transform=`scale(${1+Math.sin(q*Math.PI)*.2})`;tk.render(q);}};}
export function checklistGrid(p:Of<'checklist'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,cols=p.items.length<=2?p.items.length:2;
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*5}px;display:flex;flex-direction:column;justify-content:center;gap:${u*3}px`));
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const grid=h('div',`display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${u*3}px`);el.append(grid);
 const tiles=p.items.map((label,i)=>{const tile=h('div',`display:flex;flex-direction:column;align-items:flex-start;gap:${u*2.4}px;padding:${u*3.6}px;border-radius:${R(t.radius*.7)}px;background:${alpha(t.primary,.06)}`);
  const m=checkMark(c,u,u*8);tile.append(m.circle,h('div',`font-size:${u*4.4}px;font-weight:700;color:${t.text};line-height:1.2`,label));grid.append(tile);return {tile,m,i};});
 return {el,length:.6+tiles.length*.45+.3,render:(x)=>{enter(el,seg(x,0,.5),{y:40});
  for(const r of tiles){const st=.35+r.i*.45;enter(r.tile,seg(x,st,.35),{y:20,scale:.9});r.m.render(seg(x,st+.2,.3));}}};
}
export function checklistStack(p:Of<'checklist'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,n=p.items.length;
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:${u*2.6}px`);
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const rows=p.items.map((label,i)=>{const row=h('div',card(t,`display:flex;align-items:center;gap:${u*3.4}px;padding:${u*4}px ${u*4.4}px;margin-inline-start:${(i%2)*u*6}px;margin-inline-end:${((i+1)%2)*u*6}px`));
  const m=checkMark(c,u,u*7.4);row.append(m.circle,h('div',`font-size:${u*4.8}px;font-weight:700;color:${t.text}`,label));el.append(row);return {row,m,i};});
 return {el,length:.6+n*.45+.3,render:(x)=>{if(tl)enter(tl,seg(x,0,.35),{y:12});
  for(const r of rows){const st=.35+r.i*.45;enter(r.row,seg(x,st,.4),{x:startSide(c,60)*(r.i%2?-1:1),y:0,scale:.96});r.m.render(seg(x,st+.2,.3));}}};
}

// ---------- notifications ----------
function notifIcon(n:{app:string},i:number,c:Ctx,size:number,round:boolean){const t=c.theme,col=i%2?t.accent:t.primary;
 return h('div',`width:${size}px;height:${size}px;border-radius:${round?'50%':R(size*.26)+'px'};background:${col};color:${on(col)};font-weight:800;font-size:${size*.48}px;display:flex;align-items:center;justify-content:center;flex:none`,[...n.app.replace(/^ال(?=\p{L}{2})/u,'')][0]!.toUpperCase());}
export function notificationsCascade(p:Of<'notifications'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,n=p.items.length;
 const el=h('div','width:100%;height:100%;position:relative');
 const items=p.items.map((it,i)=>{const card2=h('div',`position:absolute;left:${u*3+(i%2?u*5:0)}px;right:${u*3+(i%2?0:u*5)}px;top:${u*4+i*u*15}px;transform-origin:50% 0;rotate:${i%2?1.5:-1.5}deg;display:flex;gap:${u*3}px;align-items:center;padding:${u*3.6}px;border-radius:${R(u*4.5)}px;${surf(t,1)};z-index:${i+1}`);
  const txt=h('div',`display:flex;flex-direction:column;gap:${u*.5}px;min-width:0`);
  txt.append(h('div',`font-size:${u*3}px;color:${t.muted};font-weight:700`,it.app.toUpperCase()+' · '+nowLabel(it.title+' '+it.app)),h('div',`font-size:${u*4.4}px;font-weight:700;color:${t.text}`,it.title));
  // Titles only: in a pile, a second line would end up under the next card.
  card2.append(notifIcon(it,i,c,u*9,false),txt);el.append(card2);return {card2,i};});
 return {el,length:.3+n*.55+.4,render:(x)=>{for(const it of items){const q=seg(x,.2+it.i*.55,.5);enter(it.card2,q,{y:-80,scale:.9,curve:ease.back});
  // Each new card pushes the earlier ones back a little.
  const later=items.filter(o=>o.i>it.i&&x>=.2+o.i*.55).length;if(q>=1){it.card2.style.transform=`translateY(${-later*u*.8}px) scale(${1-later*.025})`;}}}};
}
export function notificationsBanner(p:Of<'notifications'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:${u*3}px`);
 const items=p.items.map((it,i)=>{const pill=h('div',`display:flex;align-items:center;gap:${u*3}px;padding:${u*2.4}px ${u*5}px ${u*2.4}px ${u*2.4}px;border-radius:${R(99)}px;${surf(t,1)};max-width:96%`);
  pill.append(notifIcon(it,i,c,u*10,true),h('div',`font-size:${u*5}px;font-weight:800;color:${t.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0`,it.title));el.append(pill);return {pill,i};});
 return {el,length:.3+items.length*.55+.4,render:(x)=>{for(const it of items)enter(it.pill,seg(x,.2+it.i*.55,.5),{y:30,scale:.7,curve:ease.back});}};
}

// ---------- progress ----------
export function progressRings(p:Of<'progress'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,n=p.items.length,size=Math.min(u*30,(c.box.w-u*8)/Math.min(3,n)-u*4);
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*5}px;display:flex;flex-direction:column;justify-content:center;gap:${u*4}px`));
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const row=h('div',`display:flex;flex-wrap:wrap;justify-content:center;gap:${u*4}px`);el.append(row);
 const rings=p.items.map((it,i)=>{const w=h('div',`display:flex;flex-direction:column;align-items:center;gap:${u*1.6}px`);
  const box=h('div',`position:relative;width:${size}px;height:${size}px`);const svg=s('svg',{viewBox:'0 0 100 100',width:size,height:size,style:`transform:rotate(-90deg)${c.dir==='rtl'?' scaleY(-1)':''}`});
  svg.append(s('circle',{cx:50,cy:50,r:42,fill:'none',stroke:alpha(t.primary,.12),'stroke-width':10}));
  const arc=s('circle',{cx:50,cy:50,r:42,fill:'none',stroke:i===0?t.accent:t.primary,'stroke-width':10,'stroke-linecap':'round',pathLength:100,'stroke-dasharray':'0 100'});svg.append(arc);
  const pct=h('div',`position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${size*.24}px;font-weight:800;color:${t.text};${NUM};${numberFont()}`);
  box.append(svg,pct);w.append(box,h('div',`font-size:${u*3.6}px;font-weight:600;color:${t.text};text-align:center`,it.label));row.append(w);return {w,arc,pct,it,i};});
 return {el,length:.5+n*.25+1.2,render:(x)=>{enter(el,seg(x,0,.5),{y:40});
  for(const r of rings){const st=.35+r.i*.22;enter(r.w,seg(x,st,.4),{y:14,scale:.85});const k=ease.cubic(seg(x,st+.15,1.1));r.arc.setAttribute('stroke-dasharray',`${r.it.value*k} 100`);r.pct.textContent=Math.round(r.it.value*k)+'%';}}};
}
export function progressColumns(p:Of<'progress'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,n=p.items.length;
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*5}px;display:flex;flex-direction:column;gap:${u*3}px`));
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const row=h('div',`flex:1;min-height:0;display:flex;align-items:flex-end;gap:${u*4}px;padding:0 ${u*2}px`);el.append(row);
 const cols=p.items.map((it,i)=>{const col=h('div','flex:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:0');
  const pct=h('div',`font-size:${u*4.6}px;font-weight:800;color:${ink(i===0?t.accent:t.primary,t)};margin-bottom:${u}px;${NUM};${numberFont()}`);
  const track=h('div',`width:70%;flex:1;max-height:72%;border-radius:${R(u*2)}px;background:${alpha(t.primary,.08)};display:flex;align-items:flex-end;overflow:hidden`);
  const fill=h('div',`width:100%;height:0;border-radius:${R(u*2)}px;background:linear-gradient(0deg,${t.primary},${mix(t.primary,t.accent,.6)})`);track.append(fill);
  col.append(pct,track,h('div',`font-size:${u*3.4}px;font-weight:600;color:${t.text};margin-top:${u*1.4}px;text-align:center`,it.label));row.append(col);return {col,fill,pct,it,i};});
 return {el,length:.5+n*.25+1.2,render:(x)=>{enter(el,seg(x,0,.5),{y:40});
  for(const r of cols){const st=.35+r.i*.22;enter(r.col,seg(x,st,.4),{y:14,scale:1});const k=ease.cubic(seg(x,st+.15,1.1));r.fill.style.height=(r.it.value*k)+'%';r.pct.textContent=Math.round(r.it.value*k)+'%';}}};
}

// ---------- counter ----------
export function counterRing(p:Of<'counter'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,size=Math.min(c.box.w,c.box.h)*.7;
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u*2}px`);
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const box=h('div',`position:relative;width:${size}px;height:${size}px`);
 const svg=s('svg',{viewBox:'0 0 100 100',width:size,height:size,style:`transform:rotate(-90deg)${c.dir==='rtl'?' scaleY(-1)':''}`});
 svg.append(s('circle',{cx:50,cy:50,r:44,fill:'none',stroke:alpha(t.primary,.12),'stroke-width':6}));
 const arc=s('circle',{cx:50,cy:50,r:44,fill:'none',stroke:t.accent,'stroke-width':6,'stroke-linecap':'round',pathLength:100,'stroke-dasharray':'0 100'});svg.append(arc);
 const chars=((p.prefix??'')+formatNumber(p.to,p.decimals)+(p.suffix??'')).length;
 const num=h('div',`position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${size*Math.min(.26,1.25/chars)}px;font-weight:800;color:${ink(t.primary,t)};letter-spacing:-.03em;${NUM};${numberFont()}`);
 box.append(svg,num);el.append(box);
 const cap=p.caption?h('div',`font-size:${u*5}px;color:${t.muted};font-weight:600;text-align:center`,p.caption):null;if(cap)el.append(cap);
 const share=p.suffix==='%'?Math.min(1,Math.max(0,p.to/100)):1;
 return {el,length:1.8,render:(x)=>{const k=ease.cubic(seg(x,.1,1.3));num.textContent=(p.prefix??'')+formatNumber(p.from+(p.to-p.from)*k,p.decimals)+(p.suffix??'');
  enter(box,seg(x,0,.45),{y:0,scale:.8});arc.setAttribute('stroke-dasharray',`${share*100*ease.cubic(seg(x,.3,1.1))} 100`);if(cap)enter(cap,seg(x,.55,.4),{y:16});
  const pulse=seg(x,1.4,.35);box.style.transform+=` scale(${1+Math.sin(pulse*Math.PI)*.05})`;}};
}
export function counterSplit(p:Of<'counter'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:${u*3}px;padding:0 ${u*4}px;box-sizing:border-box`);
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const row=h('div',`display:flex;align-items:center;gap:${u*5}px`);
 const num=h('div',`font-size:${Math.min(u*20,c.box.w*.15)}px;font-weight:800;line-height:.9;color:${ink(t.primary,t)};letter-spacing:-.04em;white-space:nowrap;${NUM};${numberFont()}`);
 const line=h('div',`width:${u*1.2}px;height:0;background:${t.accent};border-radius:${R(99)}px;flex:none`);
 const cap=h('div',`font-size:${u*5.6}px;color:${t.text};font-weight:700;line-height:1.2;min-width:${u*24}px;flex:1`,p.caption??'');
 row.append(num,line,cap);el.append(row);
 return {el,length:1.8,render:(x)=>{const k=ease.cubic(seg(x,.1,1.3));num.textContent=(p.prefix??'')+formatNumber(p.from+(p.to-p.from)*k,p.decimals)+(p.suffix??'');
  enter(num,seg(x,0,.45),{x:startSide(c,30),y:0,scale:1});line.style.height=ease.cubic(seg(x,.3,1.1))*u*20+'px';enter(cap,seg(x,.55,.4),{x:startSide(c,-20),y:0,scale:1});
  const pulse=seg(x,1.4,.35);num.style.transform+=` scale(${1+Math.sin(pulse*Math.PI)*.06})`;}};
}

// ---------- chat ----------
export function chatThread(p:Of<'chat'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*4}px;display:flex;flex-direction:column;justify-content:flex-end;gap:${u*3}px`));
 let at=.2;
 const msgs=p.messages.map((m,i)=>{const me=m.from==='me',name=m.name??(me?'You':'Client');
  const row=h('div',`display:flex;gap:${u*2.6}px;align-items:flex-start`);
  const body=h('div','display:flex;flex-direction:column;min-width:0;flex:1');
  body.append(h('div',`font-size:${u*3.4}px;font-weight:800;color:${me?ink(t.primary,t):t.text}`,name));
  const typing=h('div',`font-size:${u*3.6}px;color:${t.muted};font-style:italic`,'…');
  const text=h('div',`font-size:${u*4.2}px;color:${t.text};line-height:1.35`,m.text);body.append(typing,text);
  row.append(avatar(name,u*9,avatarColor(me?0:2)),body);el.append(row);
  const typeAt=at,showAt=me?at:at+.7;at=showAt+.75;return {row,typing,text,typeAt,showAt,me,i};});
 return {el,length:at,render:(x)=>{enter(el,seg(x,0,.4),{y:30});
  for(const m of msgs){m.row.style.display=x>=m.typeAt?'flex':'none';m.typing.style.display=!m.me&&x<m.showAt?'block':'none';m.text.style.display=x>=m.showAt?'block':'none';
   enter(m.row,seg(x,m.typeAt,.3),{x:startSide(c,20),y:0,scale:1});enter(m.text,seg(x,m.showAt,.35),{y:10,scale:1});}}};
}

// ---------- avatars ----------
export function avatarsGrid(p:Of<'avatars'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,n=p.people.length,cols=n<=4?2:3,size=Math.min(u*20,(c.box.w/cols)*.5);
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u*4}px`);
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const grid=h('div',`display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${u*3}px ${u*5}px`);el.append(grid);
 const people=p.people.map((pe,i)=>{const w=h('div',card(t,`display:flex;flex-direction:column;align-items:center;gap:${u*1.4}px;padding:${u*3}px ${u*4}px`));
  w.append(avatar(pe.name,size,avatarColor(i,pe.color)),h('div',`font-size:${u*3.6}px;font-weight:700;color:${t.text}`,pe.name.split(' ')[0]!));grid.append(w);return {w,i};});
 const cap=p.caption?h('div',`font-size:${u*5}px;font-weight:800;color:${t.text}`,p.caption):null;if(cap)el.append(cap);
 return {el,length:.4+n*.12+.8,render:(x)=>{for(const pe of people)enter(pe.w,seg(x,.2+pe.i*.12,.45),{y:30,scale:.6});if(cap)enter(cap,seg(x,.5+n*.12,.4),{y:14});}};
}
export function avatarsStack(p:Of<'avatars'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,n=p.people.length,size=Math.min(u*24,c.box.w/(n*.62+.6));
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u*5}px`);
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const row=h('div',`display:flex;justify-content:center;padding-inline-start:${size*.38}px`);el.append(row);
 const people=p.people.map((pe,i)=>{const w=h('div',`margin-inline-start:${-size*.38}px;position:relative;z-index:${n-i}`);w.append(avatar(pe.name,size,avatarColor(i,pe.color)));row.append(w);return {w,i};});
 const names=h('div',`font-size:${u*4}px;font-weight:600;color:${t.muted};text-align:center`,p.people.map(x=>x.name.split(' ')[0]).join(' · '));el.append(names);
 const cap=p.caption?h('div',`font-size:${u*6}px;font-weight:800;color:${t.text};text-align:center`,p.caption):null;if(cap)el.append(cap);
 return {el,length:.4+n*.12+.8,render:(x)=>{for(const pe of people)enter(pe.w,seg(x,.2+pe.i*.12,.45),{x:startSide(c,-30),y:0,scale:.5});enter(names,seg(x,.3+n*.12,.4),{y:10,scale:1});if(cap)enter(cap,seg(x,.5+n*.12,.4),{y:14});}};
}

// ---------- chart: horizontal bars ----------
export function chartHorizontal(p:Pick<Of<'chart'>,'values'|'labels'|'highlight'|'unit'|'title'>,c:Ctx,inner=false):Built{
 const u=unit(c),t=c.theme,max=Math.max(...p.values.map(Math.abs),1),hi=p.highlight??p.values.indexOf(Math.max(...p.values));
 const el=h('div',inner?'width:100%;height:100%;display:flex;flex-direction:column;justify-content:center':card(t,`width:100%;height:100%;padding:${u*6}px;display:flex;flex-direction:column;justify-content:center;gap:${u*2.4}px`));
 const tl=inner?null:titleBar(c,p.title,u);if(tl)el.append(tl);
 const rows=p.values.map((v,i)=>{const r=h('div',`display:flex;align-items:center;gap:${u*2.4}px;margin:${u*.8}px 0`);
  if(p.labels?.[i])r.append(h('div',`width:${u*12}px;flex:none;font-size:${u*3.4}px;color:${t.muted};font-weight:600`,p.labels[i]));
  const track=h('div',`flex:1;height:${u*5.4}px;display:flex;align-items:center`);
  const bar=h('div',`height:100%;width:0;border-radius:${R(u*1.6)}px;background:${i===hi?t.accent:alpha(t.primary,.85)}`);track.append(bar);
  const val=h('div',`font-size:${u*3.8}px;font-weight:800;color:${i===hi?ink(t.accent,t):t.text};margin-inline-start:${u*1.6}px;white-space:nowrap;${NUM}`,formatNumber(v,0)+(p.unit??''));track.append(val);
  r.append(track);el.append(r);return {bar,val,v,i};});
 return {el,length:.6+p.values.length*.12+.9,render:(x)=>{if(!inner)enter(el,seg(x,0,.5),{y:40});
  for(const b of rows){const k=ease.back(seg(x,.3+b.i*.1,.8));b.bar.style.width=Math.max(0,(Math.abs(b.v)/max)*78*k)+'%';enter(b.val,seg(x,.75+b.i*.1,.35),{x:startSide(c,-10),y:0,scale:.8});}}};
}
