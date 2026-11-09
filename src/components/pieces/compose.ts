// Pieces: a new visual designed for one video from layers (cards, text, numbers,
// shapes, icons, bars, lines, images, avatars), each with its own entrance and an optional
// loop. They draw through the video's own design style and mirror in right-to-left scenes.
import type {ComposeContent,Layer,PieceTheme} from '../../engine/scene-pieces-schema.js';
import {h,s,seg,ease,enter,alpha,on,card,avatar,avatarColor,formatNumber,R,surf,displayFont,numberFont,contrast,readableOn,type Built,type Ctx} from './kit.js';
import {composeLength} from './timing.js';

/** Numbers (with %, $, k) stay one left-to-right run inside right-to-left text. */
const NUM='direction:ltr;unicode-bidi:isolate';
const unit=(c:Ctx)=>c.unit??Math.min(c.box.w,c.box.h*1.1)/100;
const ICON:Record<string,string>={
 check:'M5 12.5l4.2 4.2L19 7',star:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',heart:'M12 20s-7-4.4-9-8.6C1.6 8.3 3.6 5 6.8 5c2 0 3.4 1.1 4.2 2.4C11.8 6.1 13.2 5 15.2 5c3.2 0 5.2 3.3 3.8 6.4C19 15.6 12 20 12 20z',
 bolt:'M13 2L4 14h7l-1 8 9-12h-7z',bell:'M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4',user:'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4.5 4.4-6.5 8-6.5s7 2 8 6.5',
 users:'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.8-3.8 3.4-5.6 6.5-5.6s5.7 1.8 6.5 5.6M16 11a3 3 0 100-6M18 14.6c2 .6 3.2 2.3 3.6 5.4',
 lock:'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 017 0v3',chart:'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8',cart:'M3 4h2l2.4 11h10.2L20 7H6.3M9 20h.01M17 20h.01',
 mail:'M3 6h18v12H3zM3 7l9 6 9-6',clock:'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',pin:'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
 play:'M7 4l13 8-13 8z',plus:'M12 5v14M5 12h14',arrow:'M4 12h15M13 6l6 6-6 6',sparkle:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
 shield:'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',globe:'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z',
 chat:'M4 5h16v11H9l-5 4z',calendar:'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',camera:'M4 8h4l2-3h4l2 3h4v12H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
 gift:'M4 10h16v11H4zM3 7h18v3H3zM12 7v14M12 7c-1.5-3-5-3.5-5-1.5S10 7 12 7zM12 7c1.5-3 5-3.5 5-1.5S14 7 12 7z',rocket:'M12 3c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10zM9 16l-3 3M15 16l3 3M12 9.5a1.5 1.5 0 100-3',
 search:'M11 18a7 7 0 100-14 7 7 0 000 14zM16 16l5 5',settings:'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2 .3-1.5-1.5L17 5l-3-1-1 2h-2l-1-2-3 1 .5 2.2L6 8.7 4 8.3l-1 3 2 1v1.4l-2 1 1 3 2-.4 1.5 1.5L7 21l3 1 1-2h2l1 2 3-1-.5-2.2 1.5-1.5 2 .4 1-3-2-1z',
 phone:'M7 2h10v20H7zM11 18h2',card:'M3 6h18v12H3zM3 10h18M7 15h4',leaf:'M5 19C5 10 11 5 20 4c-1 9-6 15-15 15zM5 19l7-7',fire:'M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.3 2.6-5.3 3.5-8.8 2 1.4 2.6 3.4 2.6 3.4S13.5 7 13 3c4.2 2.6 5.5 7 5.5 10.8 0 4.4-2.6 7.2-6.5 7.2z',
 home:'M3 11l9-8 9 8M5 9.5V21h14V9.5',cloud:'M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 8.5a4.8 4.8 0 01-1 9.5z',code:'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
 sun:'M12 17a5 5 0 100-10 5 5 0 000 10zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
 battery:'M3 7h15v10H3zM18 10h3v4h-3M6 10v4M9.5 10v4',car:'M5 16h14M3 16v-4l2.5-5h13L21 12v4M7 16v2M17 16v2M3 12h18',
 money:'M3 6h18v12H3zM12 15a3 3 0 100-6 3 3 0 000 6zM6 9v.01M18 15v.01',water:'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z',
 heartbeat:'M3 12h4l2-5 4 10 2-5h6',book:'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5',briefcase:'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
 truck:'M2 6h12v10H2zM14 10h5l3 3v3h-8M6 19a2 2 0 100-4 2 2 0 000 4zM18 19a2 2 0 100-4 2 2 0 000 4z',target:'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
 x:'M6 6l12 12M18 6L6 18',quote:'M10 7c-3 .8-5 3.4-5 6.5V17h4.5v-4.5H7.2c.2-1.6 1.3-2.9 2.8-3.4zM19 7c-3 .8-5 3.4-5 6.5V17h4.5v-4.5h-2.3c.2-1.6 1.3-2.9 2.8-3.4z',alert:'M12 3l10 18H2zM12 10v5M12 18h.01',
 music:'M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z',trophy:'M7 4h10v5a5 5 0 01-10 0zM7 6H4c0 3 1.5 4.5 3.5 4.8M17 6h3c0 3-1.5 4.5-3.5 4.8M12 14v4M8 21h8M9 18h6',
};
function color(c:Layer['color'],t:PieceTheme,fallback:string){
 if(!c)return fallback;
 return c==='white'?'#ffffff':c==='black'?'#0A0A0A':c.startsWith('#')?c:(t as Record<string,unknown>)[c] as string;
}

export function composePiece(p:ComposeContent,c:Ctx):Built{
 const u=unit(c),t=c.theme,W=c.box.w,H=c.box.h,rtl=c.dir==='rtl';
 const el=h('div','width:100%;height:100%;position:relative');el.dataset.compose='true'; // composed pieces check their own text against what is beneath
 // The colour under each layer (the last shape, icon tile or card that contains its centre), so text
 // on a shape always stays readable whatever colours the style generated.
 const boxOf=(l:Layer)=>({x:l.x,y:l.y,w:l.w??.3,h:l.h??(l.type==='shape'||l.type==='icon'?(l.w??.14)*W/H:.3)});
 const under=(i:number)=>{const L=p.layers[i]!,b=boxOf(L),cx=b.x+(L.w??.9)/2,cy=b.y+(L.h??.12)/2;
  for(let k=i-1;k>=0;k--){const u=p.layers[k]!;if(!(u.type==='shape'&&u.shape!=='ring'||u.type==='card'||u.type==='icon'&&u.fill))continue;const ub=boxOf(u);
   if(cx>=ub.x&&cx<=ub.x+ub.w&&cy>=ub.y&&cy<=ub.y+ub.h)return color(u.fill,t,u.type==='card'?t.surface:t.primary);}
  return t.background;}; // nothing beneath: the frame (or the device screen) shows through
 const layers=p.layers.map((l,li)=>{
  const w=(l.w??(l.type==='icon'||l.type==='avatar'?.14:l.type==='text'||l.type==='number'?.9:l.type==='bar'?.8:.3)),hh=(l.h??(l.type==='icon'||l.type==='avatar'||l.type==='shape'?w*W/H:l.type==='bar'?.05:l.type==='text'||l.type==='number'?.12:.3));
  const x=rtl?1-l.x-w:l.x;
  const box=h('div',`position:absolute;left:${x*100}%;top:${l.y*100}%;width:${w*100}%;height:${hh*100}%;opacity:${l.opacity};box-sizing:border-box`);
  const inner=h('div',`width:100%;height:100%;transform:rotate(${rtl?-l.rotate:l.rotate}deg);display:flex;align-items:center;justify-content:${l.align==='center'?'center':l.align==='end'?'flex-end':'flex-start'};box-sizing:border-box`);
  box.append(inner);el.append(box);
  let fg=color(l.color,t,t.text);const fill=color(l.fill,t,l.type==='shape'?t.primary:t.surface);
  if(l.type==='text'||l.type==='number'){const bg=under(li),need=l.size>=7?3:4.5;if(contrast(fg,bg)<need)fg=contrast(on(bg),bg)>=need?on(bg):readableOn(fg,bg,need);}
  let type:((q:number)=>void)|null=null,draw:((q:number)=>void)|null=null,grow:((q:number)=>void)|null=null;
  switch(l.type){
   case 'card':inner.style.cssText+=`;${l.fill?`background:${fill};border-radius:${R(t.radius)}px`:card(t)};${l.level===0?'box-shadow:none':''}`;if(l.fill)inner.style.cssText+=`;${surf(t,l.level).replace(/background:[^;]*;?/,'')}`;break;
   case 'text':{const tx=h('div',`font-size:${u*l.size}px;font-weight:${l.weight};color:${fg};line-height:1.15;text-align:${l.align};width:100%;${l.size>=8?displayFont():''}`);tx.dir='auto';inner.append(tx);
    const full=l.text??'',parts=/\p{Script=Arabic}/u.test(full)?full.split(/(\s+)/):[...full];tx.textContent=full;
    if(l.in.from==='type')type=q=>{tx.textContent=parts.slice(0,Math.round(parts.length*q)).join('');};break;}
   case 'number':{const tx=h('div',`font-size:${u*l.size}px;font-weight:${l.weight};color:${fg};line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;${NUM};${numberFont()}`);inner.append(tx);
    const v=l.value??0,show=(k:number)=>{tx.textContent=(l.prefix??'')+formatNumber(l.from+(v-l.from)*k,l.decimals)+(l.suffix??'');};show(1);
    if(l.in.from==='count')type=q=>show(ease.cubic(q));break;}
   case 'shape':{
    const r=l.shape==='circle'||l.shape==='ring'?'50%':l.shape==='pill'?`${R(999)}px`:l.shape==='blob'?'42% 58% 63% 37% / 41% 44% 56% 59%':`${R(t.radius*.6)}px`;
    inner.style.cssText+=`;border-radius:${r};${l.shape==='ring'?`border:${u*Math.max(.6,l.size/4)}px solid ${fill};`:`background:${fill};`}`;break;}
   case 'icon':{const sv=s('svg',{viewBox:'0 0 24 24',width:'100%',height:'100%'});const path=s('path',{d:ICON[l.icon??'sparkle']??ICON.sparkle!,fill:'none',stroke:fg,'stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round',pathLength:1,'stroke-dasharray':l.in.from==='draw'?1:'none'});
    sv.append(path);if(l.fill){inner.style.cssText+=`;background:${fill};border-radius:${l.shape==='circle'?'50%':R(t.radius*.6)+'px'};padding:18%`;}inner.append(sv);
    if(l.in.from==='draw')draw=q=>path.setAttribute('stroke-dashoffset',String(1-q));break;}
   case 'bar':{inner.style.cssText+=`;background:${alpha(fg===t.text?t.primary:fg,.14)};border-radius:${R(99)}px;overflow:hidden;justify-content:flex-start`;
    const f=h('div',`height:100%;width:${l.progress*100}%;background:${l.fill?fill:t.primary};border-radius:${R(99)}px`);inner.append(f);grow=q=>{f.style.width=l.progress*100*q+'%';};break;}
   case 'line':{
    // Drawn in the layer's own pixels (no stretching), so dashes and stroke width stay true.
    const pw=w*W,ph=hh*H,pts=(l.points??[{x:0,y:1},{x:1,y:0}]).map(q=>[(rtl?1-q.x:q.x)*pw,q.y*ph]);
    const sv=s('svg',{viewBox:`0 0 ${pw} ${ph}`,width:'100%',height:'100%',style:'overflow:visible'});
    const path=s('path',{d:pts.map((q,i)=>(i?'L':'M')+q[0]!.toFixed(1)+' '+q[1]!.toFixed(1)).join(' '),fill:'none',stroke:l.color?fg:t.accent,'stroke-width':u*Math.max(.4,l.size/5),'stroke-linecap':'round','stroke-linejoin':'round',pathLength:1,'stroke-dasharray':1,'stroke-dashoffset':l.in.from==='draw'?1:0});
    sv.append(path);inner.append(sv);draw=q=>path.setAttribute('stroke-dashoffset',String(1-q));break;}
   case 'image':{if(!l.asset||!c.assets[l.asset])throw new Error('Composed piece: unknown image asset '+(l.asset??''));const img=document.createElement('img');img.src=c.assets[l.asset]!;
    img.style.cssText=`width:100%;height:100%;object-fit:cover;border-radius:${R(t.radius)}px`;inner.append(img);break;}
   case 'avatar':{const a=avatar(l.text??'?',Math.min(w*W,hh*H),avatarColor(Math.abs((l.text??'').length)%6,l.fill?fill:undefined));inner.append(a);break;}
  }
  return {l,box,inner,type,draw,grow};
 });
 return {el,length:composeLength(p),render:(x)=>{
  for(const k of layers){
   const a=k.l.in,q=seg(x,a.at,a.dur),move=u*8;
   switch(a.from){
    case 'none':k.box.style.opacity=String(k.l.opacity);break;
    case 'fade':k.box.style.opacity=String(ease.cubic(q)*k.l.opacity);break;
    case 'up':case 'down':case 'left':case 'right':{const dx=a.from==='left'?-move:a.from==='right'?move:0,dy=a.from==='up'?move:a.from==='down'?-move:0;
     enter(k.box,q,{x:rtl?-dx:dx,y:dy,scale:.98});k.box.style.opacity=String(Number(k.box.style.opacity)*k.l.opacity);break;}
    case 'scale':enter(k.box,q,{y:0,scale:.6});break;
    case 'pop':enter(k.box,q,{y:0,scale:.2,curve:ease.back});break;
    case 'spin':k.box.style.opacity=String(ease.cubic(q));k.box.style.transform=`rotate(${(1-ease.back(q))*-180}deg) scale(${.4+.6*ease.back(q)})`;break;
    default:k.box.style.opacity=String(Math.min(1,q*4)*k.l.opacity);
   }
   if(k.type)k.type(q);if(k.draw)k.draw(ease.smooth(q));if(k.grow)k.grow(ease.cubic(q));
   // Loops start once the layer is in, so holds stay alive.
   if(k.l.loop&&x>a.at+a.dur){const lt=(x-a.at-a.dur)*k.l.loop.speed,A=k.l.loop.amount;
    const extra=k.l.loop.kind==='float'?`translateY(${Math.sin(lt*2.4)*u*3*A}px)`:k.l.loop.kind==='pulse'?`scale(${1+Math.sin(lt*4)*.06*A})`:k.l.loop.kind==='spin'?`rotate(${lt*120*A}deg)`:k.l.loop.kind==='sway'?`rotate(${Math.sin(lt*2)*8*A}deg)`:'';
    if(k.l.loop.kind==='blink')k.box.style.opacity=String((.55+.45*Math.abs(Math.cos(lt*3)))*k.l.opacity);
    k.inner.style.transform=`rotate(${rtl?-k.l.rotate:k.l.rotate}deg) ${extra}`;}
   else if(k.l.loop)k.inner.style.transform=`rotate(${rtl?-k.l.rotate:k.l.rotate}deg)`; // before the loop starts (also when seeking back)
  }
 }};
}
