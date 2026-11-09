// Pieces: a new visual designed for one video from layers (cards, text, numbers,
// shapes, icons, bars, lines, images, avatars), each with its own entrance and an optional
// loop. They draw through the video's own design style and mirror in right-to-left scenes.
import type {ComposeContent,Layer,PieceTheme} from '../../engine/scene-pieces-schema.js';
import {h,s,seg,ease,enter,alpha,on,card,avatar,avatarColor,formatNumber,inScript,mix,R,surf,displayFont,numberFont,contrast,readableOn,type Built,type Ctx} from './kit.js';
import {composeLength} from './timing.js';
import {ICON} from './icons.js';
import {scene3d} from './three/engine.js';

/** Numbers (with %, $, k) stay one left-to-right run inside right-to-left text. */
const NUM='direction:ltr;unicode-bidi:isolate';
const unit=(c:Ctx)=>c.unit??Math.min(c.box.w,c.box.h*1.1)/100;
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
 const under=(i:number)=>{const L=p.layers[i]!,b=boxOf(L);return beneath(i,b.x+(L.w??.9)/2,b.y+(L.h??.12)/2);};
 // A see-through shape (a faint blob, a tinted tile) is blended over what lies beneath it, so text
 // on a 10% shape is checked against the dark or light frame it really shows, not the shape's colour.
 const beneath=(i:number,cx:number,cy:number):string=>{
  for(let k=i-1;k>=0;k--){const u=p.layers[k]!;if(!(u.type==='shape'&&u.shape!=='ring'||u.type==='card'||u.type==='icon'&&u.fill))continue;const ub=boxOf(u);
   if(cx>=ub.x&&cx<=ub.x+ub.w&&cy>=ub.y&&cy<=ub.y+ub.h){const col=color(u.fill,t,u.type==='card'?t.surface:t.primary);
    if(u.opacity>=.95)return col;const below=beneath(k,cx,cy),six=/^#[0-9a-f]{6}$/i;
    return six.test(col)&&six.test(below)?mix(below,col,u.opacity):col;}}
  return t.background;}; // nothing beneath: the frame (or the device screen) shows through
 const layers=p.layers.map((l,li)=>{
  const w=(l.w??(l.type==='icon'||l.type==='avatar'?.14:l.type==='text'||l.type==='number'?.9:l.type==='bar'?.8:.3)),hh=(l.h??(l.type==='icon'||l.type==='avatar'||l.type==='shape'?w*W/H:l.type==='bar'?.05:l.type==='text'||l.type==='number'?.12:.3));
  const x=rtl?1-l.x-w:l.x;
  const box=h('div',`position:absolute;left:${x*100}%;top:${l.y*100}%;width:${w*100}%;height:${hh*100}%;opacity:${l.opacity};box-sizing:border-box`);
  const inner=h('div',`width:100%;height:100%;transform:rotate(${rtl?-l.rotate:l.rotate}deg);display:flex;align-items:center;justify-content:${l.align==='center'?'center':l.align==='end'?'flex-end':'flex-start'};box-sizing:border-box`);
  box.append(inner);el.append(box);
  let fg=color(l.color,t,t.text);const fill=color(l.fill,t,l.type==='shape'?t.primary:t.surface);
  if(l.type==='text'||l.type==='number'){const bg=under(li),need=l.size>=7?3:4.5;if(contrast(fg,bg)<need)fg=contrast(on(bg),bg)>=need?on(bg):readableOn(fg,bg,need);}
  let type:((q:number)=>void)|null=null,draw:((q:number)=>void)|null=null,grow:((q:number)=>void)|null=null,three:((x:number)=>void)|null=null;
  switch(l.type){
   case 'card':inner.style.cssText+=`;${l.fill?`background:${fill};border-radius:${R(t.radius)}px`:card(t)};${l.level===0?'box-shadow:none':''}`;if(l.fill)inner.style.cssText+=`;${surf(t,l.level).replace(/background:[^;]*;?/,'')}`;break;
   case 'text':{const tx=h('div',`font-size:${u*l.size}px;font-weight:${l.weight};color:${fg};line-height:1.15;text-align:${l.align};width:100%;${l.size>=8?displayFont():''}`);tx.dir='auto';inner.append(tx);
    const full=l.text??'',parts=/\p{Script=Arabic}/u.test(full)?full.split(/(\s+)/):[...full];tx.textContent=full;
    if(l.in.from==='type')type=q=>{tx.textContent=parts.slice(0,Math.round(parts.length*q)).join('');};break;}
   case 'number':{const tx=h('div',`font-size:${u*l.size}px;font-weight:${l.weight};color:${fg};line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;${NUM};${numberFont()}`);inner.append(tx);
    const v=l.value??0,show=(k:number)=>{const sc=(x:string)=>l.digits&&l.digits!=='latin'?inScript(x,l.digits):x;tx.textContent=sc(l.prefix??'')+formatNumber(l.from+(v-l.from)*k,l.decimals,l.digits)+sc(l.suffix??'');};show(1);
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
   case 'scene3d':{const s3=scene3d(l,t as PieceTheme&{genome?:import('./genome.js').Genome},w*W,hh*H,`${li}:${p.name??''}:${l.text??''}`,{from:l.in.from,dur:l.in.dur,under:under(li)});inner.append(s3.el);three=s3.render;break;}
   case 'avatar':{const a=avatar(l.text??'?',Math.min(w*W,hh*H),avatarColor(Math.abs((l.text??'').length)%6,l.fill?fill:undefined));inner.append(a);break;}
  }
  return {l,box,inner,type,draw,grow,three};
 });
 return {el,length:composeLength(p),render:(x)=>{
  for(const k of layers){
   const a=k.l.in,q=seg(x,a.at,a.dur),move=u*8;
   // A 3D layer animates its own entrance in 3D; it is simply shown from its start.
   if(k.three){k.box.style.opacity=x>=a.at?String(k.l.opacity):'0';if(x>=a.at)k.three(x-a.at);continue;}
   switch(a.from){
    case 'none':k.box.style.opacity=String(k.l.opacity);break;
    case 'fade':k.box.style.opacity=String(ease.cubic(q)*k.l.opacity);break;
    case 'up':case 'down':case 'left':case 'right':{const dx=a.from==='left'?-move:a.from==='right'?move:0,dy=a.from==='up'?move:a.from==='down'?-move:0;
     enter(k.box,q,{x:rtl?-dx:dx,y:dy,scale:.98});k.box.style.opacity=String(Number(k.box.style.opacity)*k.l.opacity);break;}
    // Every entrance keeps the layer's own opacity (a faint 10% shape stays faint once it is in).
    case 'scale':enter(k.box,q,{y:0,scale:.6});k.box.style.opacity=String(Number(k.box.style.opacity)*k.l.opacity);break;
    case 'pop':enter(k.box,q,{y:0,scale:.2,curve:ease.back});k.box.style.opacity=String(Number(k.box.style.opacity)*k.l.opacity);break;
    case 'spin':k.box.style.opacity=String(ease.cubic(q)*k.l.opacity);k.box.style.transform=`rotate(${(1-ease.back(q))*-180}deg) scale(${.4+.6*ease.back(q)})`;break;
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
