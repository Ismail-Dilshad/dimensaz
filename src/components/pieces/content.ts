// Content pieces: dashboard, tasks, chart, counter, progress, notifications, checklist, chat,
// avatars and image. Each builds its DOM once and animates from time alone.
import type {PieceContent} from '../../engine/scene-pieces-schema.js';
import {h,s,seg,ease,enter,alpha,mix,on,card,avatar,avatarColor,formatNumber,tick,R,surf,displayFont,numberFont,titleCase,skin,trendColor,type Built,type Ctx,ink} from './kit.js';
import {composePiece} from './compose.js';
import * as V from './layout-variants.js';
import {pricingPiece,quotePiece,logosPiece,calendarPiece,mapPiece,comparePiece,formPiece,downloadPiece} from './content-more.js';

type Of<K extends PieceContent['kind']>=Extract<PieceContent,{kind:K}>;
/** Numbers (with %, $, k) stay one left-to-right run inside right-to-left text. */
export const NUM='direction:ltr;unicode-bidi:isolate';
export const unit=(c:Ctx)=>c.unit??Math.min(c.box.w,c.box.h*1.1)/100;
export function titleBar(c:Ctx,title:string|undefined,u:number){
 if(!title)return null;
 return h('div',`font-size:${u*4.6}px;font-weight:${skin().type.titleWeight};color:${c.theme.text};margin-bottom:${u*3}px;${displayFont()}${titleCase()}`,title);
}

export function counterPiece(p:Of<'counter'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u*2}px`);
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const num=h('div',`font-size:${u*22}px;font-weight:800;line-height:1;color:${ink(t.primary,t)};font-variant-numeric:tabular-nums;letter-spacing:-.03em;${NUM};${numberFont()}`);
 const bar=h('div',`height:${u*1.6}px;border-radius:${R(99)}px;background:${t.accent};width:0`);
 const cap=p.caption?h('div',`font-size:${u*5}px;color:${t.muted};font-weight:600`,p.caption):null;
 el.append(num,bar);if(cap)el.append(cap);
 return {el,length:1.8,render:(x)=>{
  const k=ease.cubic(seg(x,.1,1.3)),v=p.from+(p.to-p.from)*k;
  num.textContent=(p.prefix??'')+formatNumber(v,p.decimals)+(p.suffix??'');
  enter(num,seg(x,0,.45));
  bar.style.width=(ease.cubic(seg(x,.3,1.1))*u*48)+'px';
  if(cap)enter(cap,seg(x,.55,.4),{y:16});
  const pulse=seg(x,1.4,.35);num.style.transform+=` scale(${1+Math.sin(pulse*Math.PI)*.06})`;
 }};
}

export function progressPiece(p:Of<'progress'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*6}px;display:flex;flex-direction:column;justify-content:center;gap:${u*4.5}px`));
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const rows=p.items.map((it,i)=>{
  const row=h('div',`display:flex;flex-direction:column;gap:${u*1.6}px`);
  const top=h('div',`display:flex;justify-content:space-between;font-size:${u*4.2}px;font-weight:600;color:${t.text}`);
  const name=h('span','',it.label),pct=h('span',`color:${ink(i===0?t.accent:t.primary,t)};font-variant-numeric:tabular-nums;${NUM}`);top.append(name,pct);
  const track=h('div',`height:${u*3}px;border-radius:${R(99)}px;background:${alpha(t.primary,.1)};overflow:hidden`);
  const fill=h('div',`height:100%;width:0;border-radius:${R(99)}px;background:linear-gradient(${c.dir==='rtl'?270:90}deg,${t.primary},${mix(t.primary,t.accent,.6)})`);track.append(fill);
  row.append(top,track);el.append(row);return {row,fill,pct,it,i};
 });
 return {el,length:.5+rows.length*.25+1.2,render:(x)=>{
  enter(el,seg(x,0,.5),{y:40});
  for(const r of rows){const st=.35+r.i*.22;enter(r.row,seg(x,st,.4),{y:14,scale:1});const k=ease.cubic(seg(x,st+.15,1.1));r.fill.style.width=(r.it.value*k)+'%';r.pct.textContent=Math.round(r.it.value*k)+'%';}
 }};
}

export function chartPiece(p:Pick<Of<'chart'>,'type'|'values'|'labels'|'highlight'|'unit'|'title'>,c:Ctx,inner=false):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',inner?'width:100%;height:100%;display:flex;flex-direction:column':card(t,`width:100%;height:100%;padding:${u*6}px;display:flex;flex-direction:column`));
 const tl=inner?null:titleBar(c,p.title,u);if(tl)el.append(tl);
 const area=h('div','position:relative;flex:1;min-height:0');el.append(area);
 const max=Math.max(...p.values.map(Math.abs),1),n=p.values.length,hi=p.highlight??p.values.indexOf(Math.max(...p.values));
 if(p.type==='bar'){
  area.style.cssText+=`display:flex;align-items:flex-end;gap:${u*2.4}px;border-bottom:2px solid ${alpha(t.text,.12)}`;
  const bars=p.values.map((v,i)=>{
   const col=h('div','flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;position:relative');
   const val=h('div',`font-size:${u*3.6}px;font-weight:700;color:${i===hi?ink(t.accent,t):t.text};margin-bottom:${u}px;font-variant-numeric:tabular-nums;${NUM};${numberFont()}`,formatNumber(v,0)+(p.unit??''));
   const bar=h('div',`width:100%;border-radius:${R(u*1.6)}px ${u*1.6}px 0 0;background:${i===hi?t.accent:alpha(t.primary,.85)};height:0;transform-origin:bottom`);
   col.append(val,bar);
   if(p.labels?.[i]){const lb=h('div',`position:absolute;bottom:-${u*6}px;font-size:${u*3.2}px;color:${t.muted}`,p.labels[i]);col.append(lb);}
   area.append(col);return {val,bar,v,i};
  });
  if(p.labels)area.style.marginBottom=u*6+'px';
  return {el,length:.6+n*.12+.9,render:(x)=>{
   if(!inner)enter(el,seg(x,0,.5),{y:40});
   for(const b of bars){const k=ease.back(seg(x,.3+b.i*.1,.8));b.bar.style.height=Math.max(0,(Math.abs(b.v)/max)*82*k)+'%';enter(b.val,seg(x,.75+b.i*.1,.35),{y:10,scale:.8});}
  }};
 }
 if(p.type==='line'){
  const W=1000,H=500,pad=30;
  const svg=s('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none',style:'position:absolute;inset:0;width:100%;height:100%;overflow:visible'});
  const min=Math.min(...p.values,0),range=Math.max(...p.values)-min||1;
  // Right to left: the first value sits on the right, like the bars and the reading order.
 const pts=p.values.map((v,i)=>{const x=pad+(W-2*pad)*i/(n-1);return [c.dir==='rtl'?W-x:x,H-pad-(H-2*pad)*(v-min)/range] as const;});
  const d=pts.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
  for(let g=0;g<4;g++)svg.append(s('line',{x1:pad,x2:W-pad,y1:pad+(H-2*pad)*g/3,y2:pad+(H-2*pad)*g/3,stroke:alpha(t.text,.08),'stroke-width':2}));
  const fill=s('path',{d:d+` L ${pts[n-1]![0]} ${H-pad} L ${pts[0]![0]} ${H-pad} Z`,fill:alpha(t.primary,.12),opacity:0});
  const line=s('path',{d,fill:'none',stroke:t.primary,'stroke-width':8,'stroke-linecap':'round','stroke-linejoin':'round',pathLength:1,'stroke-dasharray':1,'stroke-dashoffset':1,'vector-effect':'non-scaling-stroke'});
  line.style.strokeWidth=String(u*1.2);
  svg.append(fill,line);area.append(svg);
  const dots=pts.map((q,i)=>{const dot=h('div',`position:absolute;left:${q[0]/W*100}%;top:${q[1]/H*100}%;width:${u*3.4}px;height:${u*3.4}px;margin:-${u*1.7}px;border-radius:50%;background:${i===hi?t.accent:t.surface};border:${u*.8}px solid ${i===hi?t.accent:t.primary};box-sizing:border-box;opacity:0`);area.append(dot);return dot;});
  const tag=h('div',`position:absolute;left:${pts[hi]![0]/W*100}%;top:${pts[hi]![1]/H*100}%;transform:translate(-50%,-160%);background:${t.accent};color:${on(t.accent)};font-weight:700;font-size:${u*3.6}px;padding:${u}px ${u*2}px;border-radius:${R(u*1.5)}px;white-space:nowrap;opacity:0;${NUM}`,formatNumber(p.values[hi]!,0)+(p.unit??''));area.append(tag);
  return {el,length:2.2,render:(x)=>{
   if(!inner)enter(el,seg(x,0,.5),{y:40});
   const k=ease.smooth(seg(x,.3,1.4));line.setAttribute('stroke-dashoffset',String(1-k));fill.setAttribute('opacity',String(ease.cubic(seg(x,1.2,.6))));
   dots.forEach((dot,i)=>{const at=.3+1.4*i/(n-1);const q=seg(x,at,.25);dot.style.opacity=String(q);dot.style.transform=`scale(${ease.back(q)})`;});
   const tq=seg(x,1.6,.4);tag.style.opacity=String(tq);tag.style.transform=`translate(-50%,${-160+(1-ease.back(tq))*30}%)`;
  }};
 }
 // donut
 const total=p.values.reduce((a,b)=>a+Math.max(0,b),0)||1;
 const svg=s('svg',{viewBox:'0 0 100 100',style:`position:absolute;inset:0;margin:auto;height:100%;width:100%${c.dir==='rtl'?';transform:scaleX(-1)':''}`});
 svg.append(s('circle',{cx:50,cy:50,r:38,fill:'none',stroke:alpha(t.text,.08),'stroke-width':14}));
 let acc=0;const arcs=p.values.map((v,i)=>{const share=Math.max(0,v)/total;const a=s('circle',{cx:50,cy:50,r:38,fill:'none',stroke:i===hi?t.accent:mix(t.primary,t.surface,i*.22),'stroke-width':14,pathLength:1,'stroke-dasharray':`0 1`,transform:`rotate(${-90+acc*360} 50 50)`});acc+=share;svg.append(a);return {a,share,i};});
 const mid=h('div',`position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${u*11}px;font-weight:800;color:${t.text};font-variant-numeric:tabular-nums;${NUM};${numberFont()}`);
 area.append(svg,mid);
 return {el,length:2,render:(x)=>{
  if(!inner)enter(el,seg(x,0,.5),{y:40});
  const k=ease.cubic(seg(x,.3,1.3));let shown=0;
  for(const r of arcs){const len=Math.max(0,Math.min(r.share,k-shown));r.a.setAttribute('stroke-dasharray',`${len} 1`);shown+=r.share;}
  mid.textContent=Math.round((arcs[hi]?.share??0)*100*ease.cubic(seg(x,.5,1.1)))+'%';
 }};
}

export function dashboardPiece(p:Of<'dashboard'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*5}px;display:flex;flex-direction:column;gap:${u*3.5}px;background:${mix(t.surface,t.background,.35)}`));
 const head=h('div',`display:flex;align-items:center;gap:${u*2}px`);
 const dot=h('div',`width:${u*4}px;height:${u*4}px;border-radius:${R(u)}px;background:${t.primary}`);
 head.append(dot,h('div',`font-size:${u*4.6}px;font-weight:700;color:${t.text}`,p.title??'Overview'));el.append(head);
 const cols=Math.min(2,p.stats.length);const grid=h('div',`display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${u*3}px`);
 // Values shrink to fit narrow screens (a dashboard inside a phone).
 const valueSize=Math.min(u*8.5,(c.box.w-u*13)/cols/4.6);el.append(grid);
 const tiles=p.stats.map((st,i)=>{
  const tile=h('div',card(t,`padding:${u*3.4}px;display:flex;flex-direction:column;gap:${u}px;min-width:0;border-radius:${R(Math.max(8,t.radius*.8))}px`));
  const lb=h('div',`font-size:${u*3.3}px;color:${t.muted};font-weight:600`,st.label);
  const row=h('div',`display:flex;align-items:baseline;gap:${u*1.5}px`);
  const val=h('div',`font-size:${valueSize}px;font-weight:800;white-space:nowrap;color:${t.text};font-variant-numeric:tabular-nums;letter-spacing:-.02em;${NUM};${numberFont()}`);
  const tr=st.trend==='none'?null:h('div',`font-size:${u*3.6}px;font-weight:700;color:${trendColor(st.trend==='up',t.surface)}`,st.trend==='up'?'▲':'▼');
  row.append(val);if(tr)row.append(tr);tile.append(lb,row);grid.append(tile);return {tile,val,tr,st,i};
 });
 const ch=p.chart?chartPiece({...p.chart,title:undefined},{...c,box:{w:c.box.w*.85,h:c.box.h*.4},unit:u},true):null; // same text size as the tiles
 let chartBox:HTMLElement|null=null;
 if(ch){chartBox=h('div',card(t,`flex:1;min-height:0;padding:${u*4}px;border-radius:${R(Math.max(8,t.radius*.8))}px`));chartBox.append(ch.el);el.append(chartBox);}
 return {el,length:2.6,render:(x)=>{
  enter(el,seg(x,0,.55),{y:50});
  for(const tl of tiles){const st=.35+tl.i*.15;enter(tl.tile,seg(x,st,.45),{y:20});const k=ease.cubic(seg(x,st+.2,1.1));tl.val.textContent=(tl.st.prefix??'')+formatNumber(tl.st.value*k,tl.st.decimals)+(tl.st.suffix??'');if(tl.tr)enter(tl.tr,seg(x,st+1,.3),{y:8,scale:.5});}
 if(ch&&chartBox){enter(chartBox,seg(x,.8,.45),{y:20});ch.render(x-.9);}
 }};
}

export function tasksPiece(p:Of<'tasks'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div','width:100%;height:100%;position:relative;display:flex;flex-direction:column');
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const list=h('div',`display:flex;flex-direction:column;gap:${u*2.6}px;flex:1`);el.append(list);
 const people=p.people.length?p.people:[...new Set(p.tasks.map(x=>x.assignee).filter((x):x is string=>!!x))].map(name=>({name,color:undefined}));
 const row=h('div',`display:flex;justify-content:center;gap:${u*5}px;padding-top:${u*4}px`);
 const av=people.map((pe,i)=>{const wrap=h('div',`position:relative;display:flex;flex-direction:column;align-items:center;gap:${u}px`);const a=avatar(pe.name,u*13,avatarColor(i,pe.color));
  const badge=h('div',`position:absolute;top:-${u}px;inset-inline-end:-${u}px;min-width:${u*5}px;height:${u*5}px;border-radius:${R(99)}px;background:${t.accent};color:${on(t.accent)};font-size:${u*3}px;font-weight:800;display:flex;align-items:center;justify-content:center;opacity:0`);
  wrap.append(a,badge,h('div',`font-size:${u*3.2}px;color:${t.muted};font-weight:600`,pe.name.split(' ')[0]));row.append(wrap);return {wrap,a,badge,name:pe.name};});
 // Layouts: people below the cards (bottom), above them (top), or in a column beside them (side).
 if(p.flow==='assign'&&av.length){
  if(p.layout==='top'){el.insertBefore(row,list);row.style.padding=`${u*2}px 0 ${u*4}px`;}
  else if(p.layout==='side'){const pair=h('div',`display:flex;gap:${u*4}px;flex:1;min-height:0;align-items:center`);el.insertBefore(pair,list);pair.append(list,row);list.style.flex='1';
   row.style.cssText=`display:flex;flex-direction:column;justify-content:center;gap:${u*3}px;padding:${u*2}px;padding-inline-end:${u*2.5}px`;}
  else el.append(row);
 }
 const cards=p.tasks.map((task,i)=>{
  const cd=h('div',card(t,`display:flex;align-items:center;gap:${u*3}px;padding:${u*3.2}px ${u*4}px;border-radius:${R(Math.max(10,t.radius*.8))}px;will-change:transform`));
  const box=h('div',`width:${u*5.4}px;height:${u*5.4}px;border-radius:${R(u*1.4)}px;border:${u*.6}px solid ${alpha(t.primary,.35)};display:flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box`);
  const tk=tick(u*4.2,on(t.primary));box.append(tk.el);
  const name=h('div',`flex:1;font-size:${u*4.4}px;font-weight:600;color:${t.text}`,task.title);
  cd.append(box,name);
  if(task.tag)cd.append(h('div',`font-size:${u*3}px;font-weight:700;color:${ink(t.primary,t)};background:${alpha(t.primary,.1)};padding:${u*.8}px ${u*2}px;border-radius:${R(99)}px`,task.tag));
  list.append(cd);const who=av.findIndex(a=>a.name===task.assignee);return {cd,box,tk,name,i,who:who>=0?who:i%Math.max(1,av.length)};
 });
 const startFly=.6+cards.length*.18;
 return {el,length:startFly+cards.length*.45+.6,render:(x)=>{
  if(tl)enter(tl,seg(x,0,.35),{y:12});
  av.forEach((a,i)=>{enter(a.wrap,seg(x,.15+i*.08,.4),{y:20,scale:.6});});
  const counts=av.map(()=>0);
  for(const cd of cards){
   enter(cd.cd,seg(x,.2+cd.i*.18,.45),{x:-40*(c.dir==='rtl'?-1:1),y:0,scale:.97});
   if(p.flow==='complete'){const q=seg(x,startFly+cd.i*.4,.35);cd.box.style.background=q>0?t.primary:'transparent';cd.box.style.borderColor=q>0?t.primary:alpha(t.primary,.35);cd.tk.render(q);cd.name.style.color=mix(t.text,t.muted,q);cd.name.style.textDecoration=q>.6?'line-through':'none';}
   if(p.flow==='assign'&&av.length){
    const q=ease.cubic(seg(x,startFly+cd.i*.45,.55));
    if(q>0){const w=av[cd.who]!.wrap,tx=w.offsetLeft+w.offsetWidth/2,ty=w.offsetTop+av[cd.who]!.a.offsetHeight/2;
     const dx=tx-(cd.cd.offsetLeft+cd.cd.offsetWidth/2),dy=ty-(cd.cd.offsetTop+cd.cd.offsetHeight/2),arc=Math.sin(q*Math.PI)*-u*10;
     cd.cd.style.transform=`translate(${dx*q}px,${dy*q+arc}px) scale(${1-.85*q})`;cd.cd.style.opacity=String(1-seg(x,startFly+cd.i*.45+.42,.13));
    }
    if(x>=startFly+cd.i*.45+.5)counts[cd.who]!++;
   }
  }
  av.forEach((a,i)=>{const n=counts[i]!;a.badge.style.opacity=n?'1':'0';a.badge.textContent=String(n);
   const last=cards.filter(cd=>cd.who===i).map(cd=>startFly+cd.i*.45+.5).filter(at=>at<=x).pop();
   const bump=last!==undefined?seg(x,last,.3):1;a.a.style.transform=`scale(${1+Math.sin(bump*Math.PI)*.14})`;});
 }};
}

/** "now" in the notification's own language (by its letters). */
export function nowLabel(text:string){
 if(/[ڕڵۆێەڤ]/u.test(text))return 'ئێستا';
 if(/[پچژگیک]/u.test(text))return 'اکنون';
 if(/\p{Script=Arabic}/u.test(text))return 'الآن';
 if(/\p{Script=Hebrew}/u.test(text))return 'עכשיו';
 return 'now';
}
export function notificationsPiece(p:Of<'notifications'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;gap:${u*2.6}px;justify-content:flex-start;padding-top:${u*2}px`);
 const items=p.items.map((n,i)=>{
  const it=h('div',`display:flex;gap:${u*3}px;align-items:flex-start;padding:${u*3.4}px;border-radius:${R(u*4.5)}px;${surf(t,1)}`);
  const icon=h('div',`width:${u*9}px;height:${u*9}px;border-radius:${R(u*2.4)}px;background:${i%2?t.accent:t.primary};color:${on(i%2?t.accent:t.primary)};font-weight:800;font-size:${u*4.4}px;display:flex;align-items:center;justify-content:center;flex:none`,[...n.app.replace(/^ال(?=\p{L}{2})/u,'')][0]!.toUpperCase());
  const txt=h('div',`display:flex;flex-direction:column;gap:${u*.6}px;min-width:0`);
  const top=h('div',`display:flex;justify-content:space-between;gap:${u*2}px;font-size:${u*3}px;color:${t.muted};font-weight:600`);top.append(h('span','',n.app.toUpperCase()),h('span','',nowLabel(n.title+' '+n.app)));
  txt.append(top,h('div',`font-size:${u*4.2}px;font-weight:700;color:${t.text}`,n.title));if(n.body)txt.append(h('div',`font-size:${u*3.6}px;color:${t.muted};line-height:1.3`,n.body));
  it.append(icon,txt);el.append(it);return {it,i};
 });
 return {el,length:.3+items.length*.55+.4,render:(x)=>{for(const n of items)enter(n.it,seg(x,.2+n.i*.55,.5),{y:-60,scale:.9,curve:ease.back});}};
}

export function checklistPiece(p:Of<'checklist'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*6}px;display:flex;flex-direction:column;justify-content:center;gap:${u*4}px`));
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const rows=p.items.map((label,i)=>{
  const row=h('div',`display:flex;align-items:center;gap:${u*3.4}px`);
  const circle=h('div',`width:${u*7}px;height:${u*7}px;border-radius:50%;border:${u*.7}px solid ${alpha(t.primary,.3)};display:flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box`);
  const tk=tick(u*4.6,on(t.accent));circle.append(tk.el);
  const txt=h('div',`font-size:${u*4.8}px;font-weight:600;color:${t.text}`,label);
  row.append(circle,txt);el.append(row);return {row,circle,tk,i};
 });
 return {el,length:.6+rows.length*.45+.3,render:(x)=>{
  enter(el,seg(x,0,.5),{y:40});
  for(const r of rows){const st=.35+r.i*.45;enter(r.row,seg(x,st,.35),{x:c.dir==='rtl'?24:-24,y:0,scale:1});const q=seg(x,st+.2,.3);
   r.circle.style.background=q>0?t.accent:'transparent';r.circle.style.borderColor=q>0?t.accent:alpha(t.primary,.3);r.circle.style.transform=`scale(${1+Math.sin(q*Math.PI)*.2})`;r.tk.render(q);}
 }};
}

export function chatPiece(p:Of<'chat'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:${u*2.4}px;padding:${u*3}px;box-sizing:border-box`);
 let at=.2;
 const msgs=p.messages.map((m,i)=>{
  const me=m.from==='me';
  const wrap=h('div',`display:flex;flex-direction:column;align-items:${me?'flex-end':'flex-start'};gap:${u*.6}px`);
  if(m.name)wrap.append(h('div',`font-size:${u*2.8}px;color:${t.muted};font-weight:600;padding:0 ${u*2}px`,m.name));
  const bubble=h('div',`max-width:78%;padding:${u*2.6}px ${u*3.6}px;font-size:${u*4.2}px;line-height:1.35;border-radius:${R(u*5)}px;${me?`border-end-end-radius:${u}px;background:${t.primary};color:${on(t.primary)}`:`${surf(t,.5)};border-end-start-radius:${u}px;color:${t.text}`}`,m.text);
  const typing=h('div',`display:${me?'none':'flex'};gap:${u}px;padding:${u*2.6}px ${u*3.4}px;border-radius:${R(u*5)}px;${surf(t,.5)}`);
  const dots=[0,1,2].map(()=>{const d=h('div',`width:${u*1.8}px;height:${u*1.8}px;border-radius:50%;background:${t.muted}`);typing.append(d);return d;});
  wrap.append(typing,bubble);el.append(wrap);
  const typeAt=me?at:at,showAt=me?at:at+.7;at=showAt+.75;
  return {wrap,bubble,typing,dots,typeAt,showAt,me,i};
 });
 return {el,length:at,render:(x)=>{
  for(const m of msgs){
   const visible=x>=m.typeAt;m.wrap.style.display=visible?'flex':'none';
   if(!m.me){const typingOn=x>=m.typeAt&&x<m.showAt;m.typing.style.display=typingOn?'flex':'none';m.dots.forEach((d,i)=>d.style.transform=`translateY(${-Math.abs(Math.sin((x*6+i*.6)))*u*1.2}px)`);m.bubble.style.display=x>=m.showAt?'block':'none';}
   enter(m.bubble,seg(x,m.showAt,.35),{y:18,scale:.85});
  }
 }};
}

export function avatarsPiece(p:Of<'avatars'>,c:Ctx):Built{
 const u=unit(c),t=c.theme;
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u*5}px`);
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const row=h('div',`display:flex;justify-content:center;flex-wrap:wrap;gap:${u*3}px;max-width:100%`);el.append(row);
 const size=u*Math.min(20,90/Math.max(3,p.people.length));
 const people=p.people.map((pe,i)=>{const w=h('div',`display:flex;flex-direction:column;align-items:center;gap:${u*1.4}px`);w.append(avatar(pe.name,size,avatarColor(i,pe.color)),h('div',`font-size:${u*3.4}px;font-weight:600;color:${t.text}`,pe.name.split(' ')[0]));row.append(w);return {w,i};});
 const cap=p.caption?h('div',`font-size:${u*4.6}px;font-weight:700;color:${ink(t.primary,t)};background:${alpha(t.primary,.08)};padding:${u*1.6}px ${u*4}px;border-radius:${R(99)}px`,p.caption):null;if(cap)el.append(cap);
 return {el,length:.4+people.length*.12+.8,render:(x)=>{for(const pe of people)enter(pe.w,seg(x,.2+pe.i*.12,.45),{y:30,scale:.4});if(cap)enter(cap,seg(x,.5+people.length*.12,.4),{y:14});}};
}

export function imagePiece(p:Of<'image'>,c:Ctx):Built{
 const t=c.theme;
 const el=h('div',`width:100%;height:100%;border-radius:${R(t.radius)}px;overflow:hidden;${surf(t,2)}`);
 const img=document.createElement('img');img.src=c.assets[p.asset]??'';img.style.cssText=`width:100%;height:100%;object-fit:${p.fit};transform-origin:50% 50%`;el.append(img);
 if(!c.assets[p.asset])throw new Error('Scene piece image: unknown asset '+p.asset);
 return {el,length:1,render:(x)=>{enter(el,seg(x,0,.55),{y:40});img.style.transform=`scale(${1.12-.12*ease.smooth(seg(x,0,6))})`;}};
}

export function buildContent(p:PieceContent,c:Ctx):Built{
 // Alternative layouts (layouts.ts); each keeps its piece's timetable.
 const L=(p as {layout?:string}).layout;
 if(L)switch(p.kind){
  case 'dashboard':if(L==='hero')return V.dashboardHero(p,c);if(L==='list')return V.dashboardList(p,c);break;
  case 'checklist':if(L==='grid')return V.checklistGrid(p,c);if(L==='stack')return V.checklistStack(p,c);break;
  case 'notifications':if(L==='cascade')return V.notificationsCascade(p,c);if(L==='banner')return V.notificationsBanner(p,c);break;
  case 'progress':if(L==='rings')return V.progressRings(p,c);if(L==='columns')return V.progressColumns(p,c);break;
  case 'counter':if(L==='ring')return V.counterRing(p,c);if(L==='split')return V.counterSplit(p,c);break;
  case 'chat':if(L==='thread')return V.chatThread(p,c);break;
  case 'avatars':if(L==='grid')return V.avatarsGrid(p,c);if(L==='stack')return V.avatarsStack(p,c);break;
  case 'chart':if(L==='horizontal'&&p.type==='bar')return V.chartHorizontal(p,c);break;
 }
 switch(p.kind){
  case 'counter':return counterPiece(p,c);case 'progress':return progressPiece(p,c);case 'chart':return chartPiece(p,c);
  case 'dashboard':return dashboardPiece(p,c);case 'tasks':return tasksPiece(p,c);case 'notifications':return notificationsPiece(p,c);
  case 'checklist':return checklistPiece(p,c);case 'chat':return chatPiece(p,c);case 'avatars':return avatarsPiece(p,c);case 'image':return imagePiece(p,c);
  case 'pricing':return pricingPiece(p,c);case 'quote':return quotePiece(p,c);case 'logos':return logosPiece(p,c);case 'calendar':return calendarPiece(p,c);
  case 'map':return mapPiece(p,c);case 'compare':return comparePiece(p,c);case 'form':return formPiece(p,c);case 'download':return downloadPiece(p,c);
  case 'compose':return composePiece(p,c);
 }
}
