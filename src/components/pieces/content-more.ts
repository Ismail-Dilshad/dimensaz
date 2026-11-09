// More content pieces: pricing, quote, logos, calendar, map, compare (before/after), form and
// download buttons. Timetables come from timing.ts so motion and sound always agree. All
// layouts use logical sides, so right-to-left scenes mirror themselves.
import type {PieceContent} from '../../engine/scene-pieces-schema.js';
import {h,s,seg,ease,enter,alpha,mix,on,card,avatar,avatarColor,formatNumber,tick,R,surf,numberFont,type Built,type Ctx,ink} from './kit.js';
import {unit,titleBar,NUM} from './content.js';
import {pricingTimes,quoteTimes,calendarTimes,mapTimes,COMPARE,formTimes,downloadTimes} from './timing.js';

type Of<K extends PieceContent['kind']>=Extract<PieceContent,{kind:K}>;
const arabic=(t:string)=>/\p{Script=Arabic}/u.test(t);
/** Text in its own direction (an English phrase stays left to right inside a right-to-left piece). */
const auto=<E extends HTMLElement>(e:E)=>{e.dir='auto';return e;};
const STAR='M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z';
function star(size:number,color:string,empty:string){
 const svg=s('svg',{width:size,height:size,viewBox:'0 0 24 24'});const p=s('path',{d:STAR,fill:empty});svg.append(p);
 return {el:svg,set:(on:boolean)=>p.setAttribute('fill',on?color:empty)};
}

export function pricingPiece(p:Of<'pricing'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,T=pricingTimes(p);
 const el=h('div','width:100%;height:100%;display:flex;flex-direction:column');
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const row=h('div',`flex:1;min-height:0;display:flex;gap:${u*3}px;align-items:stretch`);el.append(row);
 const cards=p.plans.map((pl,i)=>{
  const hi=pl.highlight,fg=hi?on(t.primary):t.text,mu=hi?alpha(on(t.primary),.72):t.muted;
  const cd=h('div',card(t,`flex:1;min-width:0;display:flex;flex-direction:column;gap:${u*2.2}px;padding:${u*4}px ${u*3.4}px;${hi?`background:${t.primary};border-color:${ink(t.primary,t)};`:''}`));
  const top=h('div',`display:flex;align-items:center;justify-content:space-between;gap:${u}px`);
  top.append(h('div',`font-size:${u*4}px;font-weight:700;color:${fg}`,pl.name));
  if(pl.badge)top.append(h('div',`font-size:${u*2.6}px;font-weight:800;padding:${u*.6}px ${u*1.8}px;border-radius:${R(99)}px;background:${t.accent};color:${on(t.accent)};white-space:nowrap`,pl.badge));
  const priceRow=h('div',`display:flex;align-items:baseline;gap:${u*.8}px`);
  const price=h('div',`font-size:${u*9}px;font-weight:800;color:${fg};letter-spacing:-.02em;${NUM};${numberFont()}`);
  priceRow.append(price);if(pl.period)priceRow.append(h('div',`font-size:${u*3.2}px;color:${mu};font-weight:600`,pl.period));
  cd.append(top,priceRow);
  const feats=pl.features.map(f=>{const r=h('div',`display:flex;align-items:center;gap:${u*1.6}px;font-size:${u*3.3}px;color:${fg};font-weight:500`);
   const dot=h('div',`width:${u*4}px;height:${u*4}px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:${hi?alpha(on(t.primary),.2):alpha(t.primary,.12)}`);
   const tk=tick(u*3,hi?on(t.primary):t.primary);dot.append(tk.el);r.append(dot,auto(h('span','',f)));cd.append(r);return {r,tk};});
  let btn:HTMLElement|null=null;
  if(p.cta&&hi){btn=h('div',`margin-top:auto;text-align:center;padding:${u*2.2}px;border-radius:${R(u*2.4)}px;background:${t.accent};color:${on(t.accent)};font-weight:800;font-size:${u*3.6}px`,p.cta);cd.append(btn);}
  row.append(cd);return {cd,price,feats,btn,pl,i};
 });
 return {el,length:T.length,render:(x)=>{
  if(tl)enter(tl,seg(x,0,.35),{y:12});
  for(const k of cards){
   enter(k.cd,seg(x,T.card(k.i),.5),{y:50,scale:k.pl.highlight?.9:.94});
   const v=k.pl.price*ease.cubic(seg(x,T.price(k.i),.8));k.price.textContent=k.pl.prefix+formatNumber(v,Number.isInteger(k.pl.price)?0:2);
   k.feats.forEach((f,j)=>{const q=seg(x,T.feature(j),.3);enter(f.r,q,{x:c.dir==='rtl'?16:-16,y:0,scale:1});f.tk.render(seg(x,T.feature(j)+.1,.3));});
   if(k.btn){const q=seg(x,T.press,.3);k.btn.style.transform=`scale(${1-Math.sin(q*Math.PI)*.08})`;k.btn.style.opacity=String(ease.cubic(seg(x,T.feature(0)-.1,.3)));}
  }
 }};
}

export function quotePiece(p:Of<'quote'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,T=quoteTimes(p);
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*6}px;display:flex;flex-direction:column;justify-content:center;gap:${u*3.5}px;position:relative;overflow:hidden`));
 const mark=h('div',`font-size:${u*22}px;line-height:.7;height:${u*10}px;font-weight:900;color:${ink(t.accent,t)};font-family:Georgia,serif`,c.dir==='rtl'?'”':'“');
 const text=h('div',`font-size:${u*5.4}px;line-height:1.38;font-weight:650;color:${t.text}`);text.dir='auto'; // English quotes read left to right even in a right-to-left video
 const words=p.text.split(/\s+/).filter(Boolean).map(w=>{const sp=h('span','display:inline-block;opacity:0',w);text.append(sp,document.createTextNode(' '));return sp;});
 const stars=p.rating?Array.from({length:5},(_,k)=>star(u*5.4,'#F5B301',alpha(t.text,.12))):[];
 const starRow=h('div',`display:flex;gap:${u*.8}px`);stars.forEach(st=>starRow.append(st.el));
 const who=h('div',`display:flex;align-items:center;gap:${u*2.6}px`);
 const av=avatar(p.name,u*10,avatarColor(1));const names=h('div','display:flex;flex-direction:column');
 names.append(h('div',`font-size:${u*4}px;font-weight:700;color:${t.text}`,p.name));if(p.role)names.append(h('div',`font-size:${u*3.2}px;color:${t.muted}`,p.role));
 who.append(av,names);
 el.append(mark,text);if(stars.length)el.append(starRow);el.append(who);
 return {el,length:T.length,render:(x)=>{
  enter(el,seg(x,0,.5),{y:40});enter(mark,seg(x,.25,.4),{y:0,scale:.3});
  words.forEach((w,i)=>enter(w,seg(x,T.wStart+i*T.step,.28),{y:10,scale:1,curve:ease.cubic}));
  stars.forEach((st,k)=>{const q=seg(x,T.star(k),.25);st.set(q>0);st.el.style.transform=`scale(${q>0?1+Math.sin(q*Math.PI)*.35:1})`;});
  enter(who,seg(x,T.name,.4),{x:c.dir==='rtl'?20:-20,y:0,scale:1});
 }};
}

export function logosPiece(p:Of<'logos'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,n=p.items.length,cols=n<=4?n:Math.ceil(n/2);
 const el=h('div','width:100%;height:100%;display:flex;flex-direction:column;justify-content:center');
 const tl=titleBar(c,p.title,u);if(tl){tl.style.textAlign='center';tl.style.color=t.muted;el.append(tl);}
 const grid=h('div',`display:grid;grid-template-columns:repeat(${cols},1fr);gap:${u*2.6}px`);el.append(grid);
 const tiles=p.items.map((it,i)=>{
  const tile=h('div',card(t,`height:${u*15}px;display:flex;align-items:center;justify-content:center;padding:${u*2}px;border-radius:${R(Math.max(8,t.radius*.7))}px`));
  let mark:HTMLElement;
  if(it.asset){const img=document.createElement('img');if(!c.assets[it.asset])throw new Error('Scene piece logos: unknown asset '+it.asset);img.src=c.assets[it.asset]!;img.style.cssText='max-width:100%;max-height:100%;object-fit:contain';mark=img;}
  else mark=h('div',`font-size:${u*Math.min(5,32/Math.max(4,[...it.name].length))*1.4}px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,it.name);
  tile.append(mark);grid.append(tile);return {tile,mark,i};
 });
 return {el,length:.25+n*.1+.8,render:(x)=>{
  if(tl)enter(tl,seg(x,0,.35),{y:10});
  for(const k of tiles){const st=.25+k.i*.1;enter(k.tile,seg(x,st,.4),{y:24,scale:.85});
   // Logos arrive grey and take on colour, one after another.
   const q=ease.cubic(seg(x,st+.3,.5));k.mark.style.color=mix(t.muted,t.text,q);k.mark.style.filter=`grayscale(${1-q})`;k.mark.style.opacity=String(.55+.45*q);}
 }};
}

export function calendarPiece(p:Of<'calendar'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,T=calendarTimes(p);
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*4.5}px;display:flex;flex-direction:column;gap:${u*2.2}px`));
 const tl=titleBar(c,p.title,u);if(tl){tl.style.marginBottom='0';el.append(tl);}
 const grid=h('div',`display:grid;grid-template-columns:repeat(7,1fr);gap:${u*1}px;flex:1;min-height:0;grid-auto-rows:1fr`);el.append(grid);
 const wd=p.weekdays??['M','T','W','T','F','S','S'];
 for(const d of wd)grid.append(h('div',`font-size:${u*2.8}px;color:${t.muted};font-weight:700;text-align:center;align-self:end`,d));
 for(let i=0;i<p.firstDay;i++)grid.append(h('div'));
 const cells=Array.from({length:p.days},(_,i)=>{const d=i+1;
  const cell=h('div',`display:flex;align-items:center;justify-content:center;border-radius:${R(u*1.6)}px;font-size:${u*3.2}px;font-weight:600;color:${t.text};position:relative;${NUM}`,String(d));
  grid.append(cell);return cell;});
 const list=h('div',`display:flex;flex-direction:column;gap:${u*1.2}px`);el.append(list);
 const evs=p.events.map((e,k)=>{const r=h('div',`display:flex;align-items:center;gap:${u*1.8}px;font-size:${u*3.2}px;font-weight:600;color:${t.text}`);
  r.append(h('div',`min-width:${u*7}px;text-align:center;padding:${u*.5}px ${u*1.2}px;border-radius:${R(u*1.2)}px;background:${k%2?t.accent:t.primary};color:${on(k%2?t.accent:t.primary)};font-weight:800;${NUM}`,String(e.day)),auto(h('span','',e.label)));
  list.append(r);return {r,e,k};});
 return {el,length:T.length,render:(x)=>{
  enter(el,seg(x,0,.5),{y:40});
  cells.forEach((cell,i)=>{const q=seg(x,T.cells.start+T.cells.spread*i/p.days,.3);cell.style.opacity=String(ease.cubic(q));cell.style.transform=`scale(${.6+.4*ease.back(q)})`;
   const ev=evs.find(v=>v.e.day===i+1);const lit=ev?seg(x,T.event(ev.k),.3):0;const hl=p.highlight===i+1?seg(x,T.highlight,.35):0;
   const col=ev?(ev.k%2?t.accent:t.primary):t.primary;
   cell.style.background=lit>0?col:'transparent';cell.style.color=lit>0?on(col):t.text;
   cell.style.boxShadow=hl>0?`0 0 0 ${u*.6*ease.back(hl)}px ${t.accent}`:'none';
   if(lit>0)cell.style.transform=`scale(${1+Math.sin(lit*Math.PI)*.3})`;});
  for(const v of evs)enter(v.r,seg(x,T.event(v.k)+.1,.35),{x:c.dir==='rtl'?20:-20,y:0,scale:1});
 }};
}

export function mapPiece(p:Of<'map'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,T=mapTimes(p),W=1000,H=700;
 const el=h('div',card(t,`width:100%;height:100%;position:relative;overflow:hidden;background:${mix(t.surface,t.background,.5)}`));
 const svg=s('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none',style:'position:absolute;inset:0;width:100%;height:100%'});
 // A stylised city: blocks, a park, a river and streets; drawn once, the same every time.
 const land=mix(t.surface,t.background,.35),road=t.surface,park=mix('#22C55E',land,.75),water=mix('#3B82F6',land,.7);
 svg.append(s('rect',{x:0,y:0,width:W,height:H,fill:land}));
 svg.append(s('path',{d:'M-20 520 C 180 470 300 600 520 560 S 820 420 1020 470 L1020 720 L-20 720 Z',fill:water}));
 svg.append(s('rect',{x:640,y:90,width:210,height:150,rx:26,fill:park}));
 for(const y of [140,300,420])svg.append(s('line',{x1:0,x2:W,y1:y,y2:y,stroke:road,'stroke-width':y===300?u*2.4:u*1.3,'vector-effect':'non-scaling-stroke'}));
 for(const x of [180,420,600,880])svg.append(s('line',{x1:x,x2:x,y1:0,y2:H,stroke:road,'stroke-width':x===420?u*2.4:u*1.3,'vector-effect':'non-scaling-stroke'}));
 svg.append(s('line',{x1:0,y1:650,x2:W,y2:40,stroke:road,'stroke-width':u*1.7,'vector-effect':'non-scaling-stroke',opacity:.9}));
 const pts=p.pins.map(q=>[q.x*W,q.y*H] as const);
 // The route is drawn in the piece's own pixels so its dashes stay true on any box shape.
 const rsv=s('svg',{viewBox:`0 0 ${c.box.w} ${c.box.h}`,style:'position:absolute;inset:0;width:100%;height:100%;overflow:visible;z-index:1'});
 const route=p.route&&pts.length>1?s('path',{d:p.pins.map((q,i)=>(i?'L':'M')+(q.x*c.box.w).toFixed(1)+' '+(q.y*c.box.h).toFixed(1)).join(' '),fill:'none',stroke:t.accent,'stroke-width':u*1.4,'stroke-linecap':'round','stroke-linejoin':'round',pathLength:1,'stroke-dasharray':1,'stroke-dashoffset':1}):null;
 el.append(svg);if(route){rsv.append(route);el.append(rsv);}
 const size=u*9;
 const pins=p.pins.map((q,i)=>{
  const pin=h('div',`position:absolute;left:${q.x*100}%;top:${q.y*100}%;width:${size}px;height:${size*1.3}px;margin-left:-${size/2}px;margin-top:-${size*1.3}px;opacity:0;z-index:2`);
  const ps=s('svg',{width:size,height:size*1.3,viewBox:'0 0 24 31'});
  ps.append(s('path',{d:'M12 30c-1-4-10-11-10-18a10 10 0 0120 0c0 7-9 14-10 18z',fill:i%2?t.accent:t.primary,stroke:'#fff','stroke-width':1.6}),s('circle',{cx:12,cy:12,r:4,fill:'#fff'}));
  pin.append(ps);
  const shadow=h('div',`position:absolute;left:${q.x*100}%;top:${q.y*100}%;width:${size*.6}px;height:${size*.18}px;margin-left:-${size*.3}px;margin-top:-${size*.09}px;border-radius:50%;background:${alpha('#000000',.25)};opacity:0`);
  const lab=q.label?h('div',`position:absolute;left:${q.x*100}%;top:${q.y*100}%;transform:translate(-50%,${-size*1.3-u*7}px);white-space:nowrap;font-size:${u*3}px;font-weight:700;padding:${u*.8}px ${u*2}px;border-radius:${R(99)}px;${surf(t,.5)};color:${t.text};box-shadow:0 6px 16px ${alpha(t.text,.15)};opacity:0;z-index:3`,q.label):null;
  el.append(shadow,pin);if(lab)el.append(lab);return {pin,shadow,lab,i};
 });
 return {el,length:T.length,render:(x)=>{
  enter(el,seg(x,0,.5),{y:40});
  for(const k of pins){const q=seg(x,T.pin(k.i),.45),b=ease.back(q);k.pin.style.opacity=String(Math.min(1,q*3));k.pin.style.transform=`translateY(${(1-b)*-u*14}px)`;
   k.shadow.style.opacity=String(q);k.shadow.style.transform=`scale(${.4+.6*q})`;
   if(k.lab){const lq=seg(x,T.pin(k.i)+.3,.3);k.lab.style.opacity=String(lq);k.lab.style.marginTop=(1-ease.back(lq))*u*3+'px';}}
  if(route)route.setAttribute('stroke-dashoffset',String(1-ease.smooth(seg(x,T.route,.8))));
 }};
}

export function comparePiece(p:Of<'compare'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,rtl=c.dir==='rtl';
 const el=h('div',card(t,'width:100%;height:100%;position:relative;overflow:hidden'));
 function layer(sd:Of<'compare'>['before'],after:boolean){
  const L=h('div',`position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:${u*3}px;padding:${u*7}px;box-sizing:border-box;background:${after?t.surface:mix(t.muted,t.surface,.82)}`);
  if(sd.asset){const img=document.createElement('img');if(!c.assets[sd.asset])throw new Error('Scene piece compare: unknown asset '+sd.asset);img.src=c.assets[sd.asset]!;
   img.style.cssText=`position:absolute;inset:0;width:100%;height:100%;object-fit:cover;${after?'':'filter:grayscale(1) brightness(.9)'}`;L.append(img);}
  for(const pt of sd.points){const r=h('div',`display:flex;align-items:center;gap:${u*2}px;font-size:${u*4.4}px;font-weight:650;color:${after?t.text:t.muted};position:relative`);
   r.append(h('div',`width:${u*5}px;height:${u*5}px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${u*3.4}px;background:${after?t.primary:alpha(t.muted,.25)};color:${after?on(t.primary):t.muted}`,after?'✓':'✕'),auto(h('span','',pt)));L.append(r);}
  const tag=h('div',`position:absolute;top:${u*3}px;${after?'inset-inline-start':'inset-inline-end'}:${u*3}px;padding:${u*1}px ${u*2.6}px;border-radius:${R(99)}px;font-size:${u*3.2}px;font-weight:800;background:${after?t.accent:alpha(t.text,.75)};color:${after?on(t.accent):'#fff'}`,sd.label);
  L.append(tag);return {L,tag};
 }
 const before=layer(p.before,false),after=layer(p.after,true);
 const line=h('div',`position:absolute;top:0;bottom:0;width:${u*.8}px;margin-inline-start:-${u*.4}px;background:#fff;box-shadow:0 0 12px ${alpha('#000000',.3)};z-index:3`);
 const knob=h('div',`position:absolute;top:50%;width:${u*9}px;height:${u*9}px;margin:-${u*4.5}px 0 0 -${u*4.5}px;border-radius:50%;background:#fff;box-shadow:0 6px 18px ${alpha('#000000',.3)};display:flex;align-items:center;justify-content:center;font-weight:900;color:${ink(t.primary,t)};font-size:${u*3.6}px;z-index:4`,'⇆');
 el.append(before.L,after.L,line,knob);
 return {el,length:COMPARE.length,render:(x)=>{
  enter(el,seg(x,0,.5),{y:40});
  // The after side is revealed from the reading start (left, or right in right-to-left).
  const k=ease.smooth(seg(x,COMPARE.sweep,COMPARE.sweepDur)),pos=rtl?1-k:k;
  after.L.style.clipPath=rtl?`inset(0 0 0 ${(1-k)*100}%)`:`inset(0 ${(1-k)*100}% 0 0)`;
  line.style.left=knob.style.left=pos*100+'%';line.style.opacity=knob.style.opacity=String(k>0&&k<1?1:seg(x,COMPARE.sweep-.2,.2)*(1-seg(x,COMPARE.after,.3)));
  enter(before.tag,seg(x,.3,.35),{y:-10,scale:.8});enter(after.tag,seg(x,COMPARE.after,.35),{y:-10,scale:.8});
 }};
}

export function formPiece(p:Of<'form'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,T=formTimes(p);
 const el=h('div',card(t,`width:100%;height:100%;padding:${u*6}px;display:flex;flex-direction:column;justify-content:center;gap:${u*3}px`));
 const tl=titleBar(c,p.title,u);if(tl)el.append(tl);
 const fields=p.fields.map((f,i)=>{
  const wrap=h('div',`display:flex;flex-direction:column;gap:${u*1}px`);
  wrap.append(h('div',`font-size:${u*3}px;font-weight:700;color:${t.muted}`,f.label));
  const box=h('div',`height:${u*10}px;border-radius:${R(u*2)}px;border:${u*.4}px solid ${alpha(t.text,.14)};display:flex;align-items:center;padding:0 ${u*3}px;font-size:${u*4}px;color:${t.text};font-weight:600;box-sizing:border-box;gap:2px`);
  const val=auto(h('span','white-space:pre')),caret=h('span',`width:${u*.5}px;height:${u*5.4}px;background:${t.primary};opacity:0`);
  box.append(val,caret);wrap.append(box);el.append(wrap);
  // Arabic-script values appear word by word, never letter by letter (letters must stay joined).
  const parts=arabic(f.value)?f.value.split(/(\s+)/):[...f.value];
  return {wrap,box,val,caret,parts,i};
 });
 const btn=h('div',`margin-top:${u*1.5}px;height:${u*11}px;border-radius:${R(u*2.4)}px;background:${t.primary};color:${on(t.primary)};font-weight:800;font-size:${u*4.2}px;display:flex;align-items:center;justify-content:center;gap:${u*1.5}px`);
 const label=auto(h('span','',p.button)),ok=tick(u*5,on(t.accent));ok.el.style.display='none';btn.append(ok.el,label);el.append(btn);
 return {el,length:T.length,render:(x)=>{
  enter(el,seg(x,0,.5),{y:40});
  for(const f of fields){
   enter(f.wrap,seg(x,.2+f.i*.1,.35),{y:14,scale:1});
   const [a,b]=T.field(f.i),q=seg(x,a,b-a);f.val.textContent=f.parts.slice(0,Math.round(f.parts.length*q)).join('');
   const active=x>=a-.05&&(x<b+.2||f.i===fields.length-1&&x<T.press);f.caret.style.opacity=active&&Math.floor(x*3)%2===0?'1':'0';
   f.box.style.borderColor=active?t.primary:alpha(t.text,.14);
  }
  const pq=seg(x,T.press,.3);btn.style.transform=`scale(${1-Math.sin(pq*Math.PI)*.07})`;
  const dq=seg(x,T.done,.3);btn.style.background=dq>0?t.accent:t.primary;btn.style.color=dq>0?on(t.accent):on(t.primary);
  ok.el.style.display=dq>0?'block':'none';ok.render(dq);label.textContent=dq>0&&p.done?p.done:p.button;
 }};
}

export function downloadPiece(p:Of<'download'>,c:Ctx):Built{
 const u=unit(c),t=c.theme,T=downloadTimes(p);
 const el=h('div',`width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u*4.5}px`);
 const row=h('div',`display:flex;flex-wrap:wrap;justify-content:center;gap:${u*2.6}px`);el.append(row);
 const btns=p.buttons.map((b,i)=>{
  const bt=h('div',`display:flex;align-items:center;gap:${u*2}px;padding:${u*2.2}px ${u*4}px;border-radius:${R(u*3)}px;background:#0f1115;color:#fff;box-shadow:0 10px 26px ${alpha('#000000',.25)}`);
  const ic=s('svg',{width:u*6,height:u*6,viewBox:'0 0 24 24'});
  ic.append(s('rect',{x:6,y:2,width:12,height:20,rx:2.6,fill:'none',stroke:'#fff','stroke-width':1.8}),s('path',{d:'M12 7v7m-3-3l3 3 3-3',fill:'none',stroke:'#fff','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round'}));
  const txt=h('div','display:flex;flex-direction:column;line-height:1.1');if(b.sub)txt.append(h('div',`font-size:${u*2.5}px;opacity:.8`,b.sub));txt.append(h('div',`font-size:${u*4.4}px;font-weight:700`,b.label));
  bt.append(ic,txt);row.append(bt);return {bt,i};
 });
 const rate=p.rating!==undefined?h('div',`display:flex;align-items:center;gap:${u*1.6}px`):null;
 const stars=rate?Array.from({length:5},()=>star(u*6,'#F5B301',alpha(t.text,.12))):[];
 const num=rate?h('div',`font-size:${u*5}px;font-weight:800;color:${t.text};${NUM}`):null;
 if(rate){stars.forEach(st=>rate.append(st.el));rate.append(num!);el.append(rate);}
 const cap=p.caption?h('div',`font-size:${u*4}px;font-weight:600;color:${t.muted};text-align:center`,p.caption):null;if(cap)el.append(cap);
 return {el,length:T.length,render:(x)=>{
  for(const b of btns){enter(b.bt,seg(x,.2+b.i*.15,.45),{y:30,scale:.8});}
  const pq=seg(x,T.press,.3);if(pq>0&&btns[0])btns[0].bt.style.transform+=` scale(${1-Math.sin(pq*Math.PI)*.08})`;
  if(rate){enter(rate,seg(x,T.stars-.1,.3),{y:12,scale:1});stars.forEach((st,k)=>{const q=seg(x,T.star(k),.2);st.set(q>0&&k<Math.round(p.rating!));st.el.style.transform=`scale(${q>0?1+Math.sin(q*Math.PI)*.3:1})`;});
   num!.textContent=formatNumber(p.rating!*ease.cubic(seg(x,T.stars,5*.08+.2)),1);}
  if(cap)enter(cap,seg(x,T.length-.6,.4),{y:12,scale:1});
 }};
}
