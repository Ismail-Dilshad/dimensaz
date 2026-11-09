// Designs a brand-new piece for one sentence when no ready-made or saved piece fits. It reads
// the sentence (its key phrase, its list, its numbers, a before→after turn), picks a
// composition that suits that content, and builds it from layers with words, icons and numbers
// from the sentence, varied by the video's seed. Every design is also a template ({{vars}}),
// so an approved one is saved and reused (and varied again) by later videos.
import {listTemplatesSync} from './composed-pieces.js';

export type Designed={name:string;description:string;tags:string[];vars:Record<string,string|number>;layers:Record<string,unknown>[];archetype:string};
type Num={value:number;prefix?:string;suffix?:string;decimals:number};
type Read={label:string;items:string[];num?:Num;from?:string;to?:string;fromIcon?:string;toIcon?:string;icons:string[];words:string[]};

function rng(seed:string){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const hash=(s:string)=>{let h=0x811c9dc5;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16).padStart(8,'0').slice(0,6);};
const clip=(s:string,n:number)=>s.length<=n?s:s.slice(0,n-1).trimEnd()+'…';
const L=(o:Record<string,unknown>)=>o;
const IN=(at:number,dur:number,from:string,sound?:string)=>({at:Number(at.toFixed(2)),dur:Number(dur.toFixed(2)),from,...(sound?{sound}:{})});

const VERBS=/^(turns?|converts?|makes?|changes?|becomes?|goes|go|moves?|grows?|brings?|helps?|lets?|gets?|is|are|was|were)$/i;
const FILL=/^(the|a|an|your|our|their|my|of|and|or|from|in|on|with|for)$/i;
/** Two content words from the end (before the turn) or the start (after it). */
function side(part:string,at:'start'|'end'){const all=part.split(/\s+/).filter(Boolean);
 // Before the turn: the words after the last verb or filler; after it: the words up to the first filler.
 let w=all;if(at==='end'){const k=all.map((x,i)=>VERBS.test(x)||FILL.test(x)?i:-1).filter(i=>i>=0).pop();if(k!==undefined&&k<all.length-1)w=all.slice(k+1);}
 else{const k=all.findIndex((x,i)=>i>0&&FILL.test(x));if(k>0)w=all.slice(0,k);}
 const keep=(at==='end'?w.slice(-3):w.slice(0,3)).filter(x=>!VERBS.test(x)&&!FILL.test(x));
 const pick=(keep.length?keep:[at==='end'?w[w.length-1]!:w[0]!]);const out=(at==='end'?pick.slice(-2):pick.slice(0,2)).join(' ');return clip(out.charAt(0).toUpperCase()+out.slice(1),22);}
/** The parts of a sentence a composition can show. */
export function readSentence(sentence:string,o:{items:string[];num?:Num;label:string;icon:(t:string,i:number)=>string}):Read{
 const s=sentence.replace(/[.!?؟]+$/,'').trim();
 const turn=s.match(/^(.*?)\s+(?:into|to|→|->|so|then|becomes?|turns? into)\s+(.+)$/i)??s.match(/^(?:from\s+)(.+?)\s+to\s+(.+)$/i);
 const words=s.split(/\s+/).filter(w=>w.replace(/[^\p{L}]/gu,'').length>3).slice(0,6);
 const items=o.items.slice(0,4).map(x=>{const t=x.replace(/^(the|a|an|your|our|their|my)\s+/i,'');return t.charAt(0).toUpperCase()+t.slice(1);});
 return {label:o.label,items,num:o.num,...(turn&&!o.num?(()=>{const from=side(turn[1]!,'end'),to=side(turn[2]!,'start');return {from,to,fromIcon:o.icon(from,0),toIcon:o.icon(to,1)};})():{}),
  icons:[...(items.length?items:words.length?words:[s])].slice(0,4).map((t,i)=>o.icon(t,i)),words};
}

type Build=(r:Read,x:()=>number)=>{layers:Record<string,unknown>[];vars:Record<string,string|number>;description:string};
const pick=<T>(x:()=>number,a:T[])=>a[Math.floor(x()*a.length)]!;
const shapeOf=(x:()=>number)=>pick(x,['circle','rect','blob','pill']);
const loopOf=(x:()=>number)=>pick(x,['float','pulse','sway']);

const ARCH:Record<string,{fits:(r:Read)=>number;build:Build}>={
 // A centre with satellites joined by drawn lines: parts of one idea.
 orbit:{fits:r=>r.items.length>=2?1.2:r.words.length>=3?.6:0,build:(r,x)=>{
  const items=(r.items.length>=2?r.items:r.words.slice(0,3)).slice(0,3),vars:Record<string,string|number>={label:clip(r.label.split(/\s+/).slice(0,4).join(' '),28),icon:r.icons[0]!};
  const cx=.5,cy=.4,R=.3,start=-90+(x()-.5)*40,layers:Record<string,unknown>[]=[];
  const sat=items.map((t,i)=>{const a=(start+i*360/items.length)*Math.PI/180;return {x:cx+Math.cos(a)*R,y:cy+Math.sin(a)*R*.95};});
  sat.forEach((p,i)=>layers.push(L({type:'line',points:[{x:cx,y:cy},{x:p.x,y:p.y}],x:0,y:0,w:1,h:1,size:3,color:'muted',opacity:.5,in:IN(.3+i*.12,.5,'draw','none')})));
  layers.push(L({type:'shape',shape:shapeOf(x),x:cx-.13,y:cy-.13,w:.26,fill:'primary',in:IN(.1,.5,'pop'),loop:{kind:'pulse',amount:.3}}));
  layers.push(L({type:'icon',icon:'{{icon}}',x:cx-.07,y:cy-.07,w:.14,color:'white',in:IN(.3,.5,'spin','none')}));
  sat.forEach((p,i)=>{vars['item'+(i+1)]=clip(items[i]!,22);vars['icon'+(i+1)]=r.icons[i+1]??r.icons[i]!;
   layers.push(L({type:'icon',icon:`{{icon${i+1}}}`,x:p.x-.065,y:p.y-.065,w:.13,fill:i%2?'accent':'surface',color:i%2?'white':'primary',shape:'circle',in:IN(.55+i*.15,.4,'pop'),loop:{kind:loopOf(x),amount:.35,speed:.8+x()*.6}}));
   layers.push(L({type:'text',text:`{{item${i+1}}}`,x:p.x-.17,y:p.y+.08,w:.34,h:.07,size:3.8,weight:700,align:'center',in:IN(.7+i*.15,.35,'fade')}));});
  layers.push(L({type:'text',text:'{{label}}',x:.08,y:.84,w:.84,h:.1,size:5.2,weight:800,align:'center',in:IN(1.1,.6,'type')}));
  return {layers,vars,description:`A centre idea with ${items.length} parts orbiting it, joined by drawn lines: parts, features or ingredients of one thing.`};}},
 // Items along a drawn path with markers: a journey, steps or a sequence.
 path:{fits:r=>r.items.length>=2?1:0,build:(r,x)=>{
  const items=r.items.slice(0,4),n=items.length,vars:Record<string,string|number>={},layers:Record<string,unknown>[]=[];
  const diag=x()<.5,pts=items.map((_,i)=>diag?{x:.14+i*(.72/(n-1||1)),y:.72-i*(.5/(n-1||1))}:{x:.16,y:.14+i*(.66/(n-1||1))});
  layers.push(L({type:'line',points:pts.map(p=>({x:p.x,y:p.y})),x:0,y:0,w:1,h:1,size:4,color:'accent',in:IN(.25,.9+n*.15,'draw')}));
  pts.forEach((p,i)=>{vars['item'+(i+1)]=clip(items[i]!,24);vars['icon'+(i+1)]=r.icons[i]!;
   layers.push(L({type:'icon',icon:`{{icon${i+1}}}`,x:p.x-.065,y:p.y-.065,w:.13,fill:i===n-1?'accent':'primary',color:'white',in:IN(.35+i*.3,.4,'pop')}));
   layers.push(L({type:'text',text:`{{item${i+1}}}`,x:diag?Math.min(.62,p.x-.12):p.x+.1,y:diag?p.y+.07:p.y-.035,w:diag?.36:.66,h:.07,size:4.2,weight:700,align:diag?'center':'start',in:IN(.5+i*.3,.35,diag?'up':'left')}));});
  return {layers,vars,description:`${n} points along a path that draws itself, a marker landing on each: a journey, a sequence or steps.`};}},
 // One big symbol with rings and the key phrase typing in: a single strong idea.
 burst:{fits:()=>.5,build:(r,x)=>{
  const vars:Record<string,string|number>={label:clip(r.label,40),icon:r.icons[0]!},layers:Record<string,unknown>[]=[];
  const cy=.36+(x()-.5)*.06;
  for(const [k,s] of [[0,.62],[1,.46]] as const)layers.push(L({type:'shape',shape:'ring',x:.5-s/2,y:cy-s/2*.7,w:s,fill:k?'accent':'primary',size:k?3:2,opacity:.5,in:IN(.1+k*.15,.6,'scale'),loop:{kind:'pulse',amount:.4,speed:.7+k*.3}}));
  layers.push(L({type:'icon',icon:'{{icon}}',x:.37,y:cy-.13*.7-.03,w:.26,fill:'primary',color:'white',shape:'circle',in:IN(.3,.55,'pop','impact'),loop:{kind:'float',amount:.4}}));
  for(let k=0;k<3;k++)layers.push(L({type:'icon',icon:'sparkle',x:.12+x()*.76,y:.06+x()*.2,w:.06,color:k%2?'accent':'primary',in:IN(.6+k*.12,.3,'pop'),loop:{kind:'blink',amount:.6,speed:.6+x()}}));
  layers.push(L({type:'text',text:'{{label}}',x:.06,y:.74,w:.88,h:.14,size:6.4,weight:800,align:'center',in:IN(.85,.9,'type')}));
  return {layers,vars,description:'One large symbol with pulsing rings and sparkles, the key phrase typing in below: a single strong idea or promise.'};}},
 // A statement card: the key phrase big, an underline growing, an icon in the corner.
 statement:{fits:r=>r.label.length>6?.7:.2,build:(r,x)=>{
  const vars:Record<string,string|number>={label:clip(r.label,48),icon:r.icons[0]!},start=x()<.5;
  const layers=[L({type:'card',x:.04,y:.1,w:.92,h:.8,level:2,in:IN(0,.45,'scale')}),
   L({type:'icon',icon:'{{icon}}',x:start?.1:.74,y:.17,w:.16,fill:'accent',color:'white',in:IN(.3,.45,'spin'),loop:{kind:loopOf(x),amount:.4}}),
   L({type:'text',text:'{{label}}',x:.1,y:.4,w:.8,h:.28,size:7.6,weight:800,align:start?'start':'center',in:IN(.5,1,'type')}),
   L({type:'bar',x:start?.1:.3,y:.74,w:start?.5:.4,h:.025,progress:1,in:IN(1.4,.6,'grow')})];
  return {layers,vars,description:'The key phrase as a big statement on a card, an underline growing and an icon in the corner: a claim or a promise.'};}},
 // A number counting up with mini bars rising: a result.
 callout:{fits:r=>r.num?1.3:0,build:(r,x)=>{
  const n=r.num!,vars:Record<string,string|number>={value:n.value,prefix:n.prefix??'',suffix:n.suffix??'',label:clip(r.label,36),icon:r.icons[0]!},layers:Record<string,unknown>[]=[];
  const bars=4,base=.78,col=x()<.5;
  layers.push(L({type:'card',x:.04,y:.06,w:.92,h:.88,in:IN(0,.4,'fade')}));
  for(let i=0;i<bars;i++){const hgt=.12+i*(.32/(bars-1));layers.push(L({type:'shape',shape:'rect',x:.56+i*.085,y:base-hgt,w:.06,h:hgt,fill:i===bars-1?'accent':'primary',opacity:i===bars-1?1:.55,in:IN(.4+i*.12,.5,'up','tick')}));}
  layers.push(L({type:'number',value:'{{value}}',prefix:'{{prefix}}',suffix:'{{suffix}}',decimals:n.decimals,x:.1,y:col?.24:.3,w:.5,h:.2,size:16,weight:800,color:'primary',in:IN(.35,1.2,'count')}));
  layers.push(L({type:'text',text:'{{label}}',x:.1,y:col?.48:.54,w:.46,h:.2,size:4.6,weight:700,color:'muted',in:IN(.9,.4,'up')}));
  layers.push(L({type:'icon',icon:'{{icon}}',x:.1,y:.1,w:.1,color:'accent',in:IN(.2,.4,'pop')}));
  return {layers,vars,description:'A number counting up beside rising bars on a card: a result or a measurable change.'};}},
 // Before → after: two tiles and an arrow drawing between them.
 flow:{fits:r=>r.from&&r.to?1.4:0,build:(r,x)=>{
  const vars:Record<string,string|number>={from:r.from!,to:r.to!,icon1:r.fromIcon??r.icons[0]!,icon2:r.toIcon??r.icons[1]??'sparkle'},sq=x()<.5?'circle':'rect';
  const layers=[L({type:'icon',icon:'{{icon1}}',x:.1,y:.26,w:.22,fill:'muted',color:'white',shape:sq,in:IN(.15,.45,'pop')}),
   L({type:'text',text:'{{from}}',x:.02,y:.56,w:.38,h:.1,size:4.4,weight:700,align:'center',color:'muted',in:IN(.35,.35,'fade')}),
   L({type:'line',points:[{x:0,y:.5},{x:1,y:.5}],x:.36,y:.32,w:.28,h:.1,size:5,color:'accent',in:IN(.6,.6,'draw','whoosh')}),
   L({type:'icon',icon:'arrow',x:.58,y:.31,w:.08,color:'accent',in:IN(1.1,.3,'pop','none')}),
   L({type:'icon',icon:'{{icon2}}',x:.68,y:.26,w:.22,fill:'primary',color:'white',shape:sq,in:IN(1.2,.5,'pop','success'),loop:{kind:'pulse',amount:.4}}),
   L({type:'text',text:'{{to}}',x:.6,y:.56,w:.38,h:.1,size:4.6,weight:800,align:'center',in:IN(1.35,.4,'up')})];
  return {layers,vars,description:'Before and after as two tiles with an arrow drawing from one to the other: a change, a transformation or cause and effect.'};}},
};

/** A new piece for a sentence; `taken` names designs already used in this video. */
export function designPiece(sentence:string,o:{seed:string;label:string;items:string[];num?:Num;icon:(t:string,i:number)=>string;taken?:string[]}):Designed{
 const r=readSentence(sentence,o),x=rng(o.seed+':'+sentence);
 const ranked=Object.entries(ARCH).map(([k,a])=>({k,s:a.fits(r)*(.7+x()*.6)*(o.taken?.includes(k)?.35:1)})).filter(a=>a.s>0).sort((a,b)=>b.s-a.s);
 const k=ranked[0]!.k,b=ARCH[k]!.build(r,x);
 const tags=[...new Set([k,...r.words.map(w=>w.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')).filter(w=>w.length>3)].slice(0,8))];
 let name=`${k}-${hash(o.seed+sentence)}`;const existing=new Set(listTemplatesSync().map(t=>t.name));while(existing.has(name))name=`${k}-${hash(name)}`;
 return {name,description:b.description,tags,vars:b.vars,layers:b.layers,archetype:k};
}
