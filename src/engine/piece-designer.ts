// Designs every scene's visual from zero. It reads the sentence (its meaning, key phrase, list,
// numbers, a before→after turn, a quotation), picks a composition that suits that content, and
// builds it from layers with only the sentence's own words, numbers and icons that match them.
// Nothing is invented: no sample names, apps, prices or data. Each video varies the arrangement,
// shapes, colours, entrances and loops (seeded by the video), and the brain scores every
// composition by verdicts (pd-<archetype>), so compositions that get approved come up more often.
import {inScript} from '../components/pieces/kit.js';

export type Role='hook'|'problem'|'reveal'|'tasks'|'done'|'track'|'growth'|'number'|'speed'|'support'|'team'|'steps'|'alerts'|'cta'|'explain'|'pricing'|'quote'|'logos'|'calendar'|'map'|'compare'|'form'|'download';
export type Num={value:number;prefix?:string;suffix?:string;decimals:number};
export type Designed={archetype:string;description:string;layers:Record<string,unknown>[];
 /** How well the composition suits the sentence (its fit, before the per-video variation). */
 fit:number};
type Read={role:Role;label:string;items:string[];num?:Num;from?:string;to?:string;fromIcon?:string;toIcon?:string;icons:string[];words:string[];quote?:string;lead?:string;digits?:'arabic'|'persian'};

function rng(seed:string){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
/** Words that never end a label ("Book a call on", "Workspace that keeps everything in"). */
const TRAIL=new Set('the a an and or of to in on at by for with from into onto your our my their its this that these those is are was were be as so than then but not no every each all any just very more most its it we you they i'.split(' ').concat(['و','لە','بە','بۆ','کە','لەگەڵ','بێ','یان','في','من','على','إلى','الى','عن','مع','أو','او','از','به','در','با','که','یا','برای','هەموو','هەر','كل','همه','هر','one']));
/** Shortens to at most n characters at a word boundary, never mid-word and never with "…";
 *  a shortened label never ends on a filler word. A single over-long word is cut as a last resort. */
export function fitWords(s:string,n:number){
 // Whole when it fits, or overshoots only a little ("…for small teams" is better than "…for small").
 const t=s.trim().replace(/[,;:،؛—–-]+$/,'');if(t.length<=n*1.12)return t; // whole: "built in" keeps its "in"
 const words=t.split(/\s+/);let out='';for(const w of words){const next=out?out+' '+w:w;if(next.length>n)break;out=next;}
 out=trimTail(out.replace(/[,;:،؛—–-]+$/,''));return out||t.slice(0,n).trimEnd();
}
function trimTail(s:string){const w=s.split(/\s+/);while(w.length>1&&TRAIL.has(w.at(-1)!.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')))w.pop();return w.join(' ');}
const clip=fitWords;
/** Words that carry no content on their own (introductions, helpers). */
const FILLER=new Set('meet introducing introduce say says said hello here there what when where which while will would could should have has had been being also only even still about over under after before because'.split(' ').concat(['بناسە','ئەمە','ئەوە','تعرف','تعرّف','هذا','هذه','آشنا','این']));
const cap=(s:string)=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
const L=(o:Record<string,unknown>)=>o;
const IN=(at:number,dur:number,from:string,sound?:string)=>({at:Number(at.toFixed(2)),dur:Number(dur.toFixed(2)),from,...(sound?{sound}:{})});
const r2=(n:number)=>Number(n.toFixed(3));

const VERBS=/^(turns?|converts?|makes?|changes?|becomes?|goes|go|moves?|grows?|brings?|helps?|lets?|gets?|is|are|was|were)$/i;
const FILL=/^(the|a|an|your|our|their|my|of|and|or|from|in|on|with|for|one|every|each|all|some)$/i;
/** Two content words from the end (before the turn) or the start (after it). */
function side(part:string,at:'start'|'end'){const all=part.split(/\s+/).filter(Boolean);
 let w=all;if(at==='end'){const k=all.map((x,i)=>VERBS.test(x)||FILL.test(x)?i:-1).filter(i=>i>=0).pop();if(k!==undefined&&k<all.length-1)w=all.slice(k+1);}
 else{const k=all.findIndex((x,i)=>i>0&&FILL.test(x));if(k>0)w=all.slice(0,k);}
 const keep=(at==='end'?w.slice(-3):w.slice(0,3)).filter(x=>!VERBS.test(x)&&!FILL.test(x));
 const pick=(keep.length?keep:[at==='end'?w[w.length-1]!:w[0]!]);const out=(at==='end'?pick.slice(-2):pick.slice(0,2)).join(' ');return clip(cap(out),22);}
/** The parts of a sentence a composition can show. */
export function readSentence(sentence:string,o:{role?:Role;items:string[];num?:Num;label:string;icon:(t:string,i:number)=>string}):Read{
 const s=sentence.replace(/[.!?؟]+$/,'').trim();
 const turn=s.match(/^(.*?)\s+(?:into|to|→|->|so|then|becomes?|turns? into)\s+(.+)$/i)??s.match(/^(?:from\s+)(.+?)\s+to\s+(.+)$/i);
 // Content words only: "Meet", "That", "With" never become a label of their own.
 const words=s.split(/\s+/).map(w=>w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')).filter(w=>w.replace(/[^\p{L}]/gu,'').length>3&&!TRAIL.has(w.toLowerCase())&&!FILLER.has(w.toLowerCase())).slice(0,6);
 const items=o.items.slice(0,4).map(x=>cap(x.replace(/^(the|a|an|your|our|their|my|no more|instead of|without)\s+/i,'')));
 const quote=s.match(/["“«]([^"“”«»]{4,})["”»]/)?.[1];
 // The words before a list ("No more" in "No more spreadsheets, lost emails or missed deadlines").
 const at=items[0]?s.toLowerCase().indexOf(items[0].toLowerCase()):-1,lead=at>0?cap(s.slice(0,at).trim().replace(/[,:]$/,'')):undefined;
 const role=o.role??'explain',turnOk=!['map','cta','calendar','quote'].includes(role);
 // Which digits the sentence writes its figures in (Arabic-Indic ٠-٩ or Persian ۰-۹).
 const digits=/[٠-٩]/.test(s)?'arabic' as const:/[۰-۹]/.test(s)?'persian' as const:undefined;
 return {role,label:o.label,items,num:o.num,...(digits?{digits}:{}),...(quote?{quote}:{}),...(lead?{lead}:{}),
  ...(turn&&turnOk&&!o.num?(()=>{const from=side(turn[1]!,'end'),to=side(turn[2]!,'start');return {from,to,fromIcon:o.icon(from,0),toIcon:o.icon(to,1)};})():{}),
  icons:[...(items.length?items:words.length?words:[s])].slice(0,4).map((t,i)=>o.icon(t,i)),words};
}

type Build=(r:Read,x:()=>number)=>{layers:Record<string,unknown>[];description:string};
const pick=<T>(x:()=>number,a:T[])=>a[Math.floor(x()*a.length)]!;
const shapeOf=(x:()=>number)=>pick(x,['circle','rect','blob','pill']);
const loopOf=(x:()=>number)=>pick(x,['float','pulse','sway']);
/** The words to show when a composition needs a few items and the sentence has no list. */
const partsOf=(r:Read,n:number)=>r.items.slice(0,n);
const has=(r:Read,...roles:Role[])=>roles.includes(r.role);

const ARCH:Record<string,{fits:(r:Read)=>number;build:Build}>={
 // A centre with satellites joined by drawn lines: parts of one idea.
 orbit:{fits:r=>(r.items.length>=2?1.2:0)*(has(r,'team','explain','steps','tasks')?1.15:1),build:(r,x)=>{
  const items=partsOf(r,3),cx=.5,cy=.4,R=.3,start=-90+(x()-.5)*40,layers:Record<string,unknown>[]=[];
  const sat=items.map((_,i)=>{const a=(start+i*360/items.length)*Math.PI/180;return {x:cx+Math.cos(a)*R,y:cy+Math.sin(a)*R*.95};});
  sat.forEach((p,i)=>layers.push(L({type:'line',points:[{x:cx,y:cy},{x:r2(p.x),y:r2(p.y)}],x:0,y:0,w:1,h:1,size:3,color:'muted',opacity:.5,in:IN(.3+i*.12,.5,'draw','none')})));
  layers.push(L({type:'shape',shape:shapeOf(x),x:cx-.13,y:cy-.13,w:.26,fill:'primary',in:IN(.1,.5,'pop'),loop:{kind:'pulse',amount:.3}}));
  layers.push(L({type:'icon',icon:r.icons[0]!,x:cx-.07,y:cy-.07,w:.14,color:'white',in:IN(.3,.5,'spin','none')}));
  sat.forEach((p,i)=>{
   layers.push(L({type:'icon',icon:r.icons[i+1]??r.icons[i]!,x:r2(p.x-.065),y:r2(p.y-.065),w:.13,fill:i%2?'accent':'surface',color:i%2?'white':'primary',shape:'circle',in:IN(.55+i*.15,.4,'pop'),loop:{kind:loopOf(x),amount:.35,speed:r2(.8+x()*.6)}}));
   layers.push(L({type:'text',text:clip(items[i]!,22),x:r2(p.x-.17),y:r2(p.y+.08),w:.34,h:.07,size:3.8,weight:700,align:'center',in:IN(.7+i*.15,.35,'fade')}));});
  // The key phrase below, unless it only repeats the parts.
  const lw=r.label.toLowerCase(),repeats=items.filter(t=>lw.includes(t.toLowerCase())).length>=Math.min(2,items.length);
  if(!repeats)layers.push(L({type:'text',text:clip(r.label.split(/\s+/).slice(0,4).join(' '),28),x:.08,y:.84,w:.84,h:.1,size:5.2,weight:800,align:'center',in:IN(1.1,.6,'type')}));
  return {layers,description:`A centre idea with ${items.length} parts orbiting it, joined by drawn lines.`};}},
 // Items along a drawn path with markers: a journey, steps or a sequence.
 path:{fits:r=>(r.items.length>=2?1:0)*(has(r,'steps','calendar','tasks','done')?1.3:1),build:(r,x)=>{
  const items=r.items.slice(0,4),n=items.length,layers:Record<string,unknown>[]=[];
  const diag=x()<.5,pts=items.map((_,i)=>diag?{x:r2(.14+i*(.72/(n-1||1))),y:r2(.72-i*(.5/(n-1||1)))}:{x:.16,y:r2(.14+i*(.66/(n-1||1)))});
  layers.push(L({type:'line',points:pts,x:0,y:0,w:1,h:1,size:4,color:'accent',in:IN(.25,.9+n*.15,'draw')}));
  pts.forEach((p,i)=>{
   layers.push(L({type:'icon',icon:has(r,'done')?'check':r.icons[i]!,x:r2(p.x-.065),y:r2(p.y-.065),w:.13,fill:i===n-1?'accent':'primary',color:'white',in:IN(.35+i*.3,.4,'pop',has(r,'done')?'click':undefined)}));
   layers.push(L({type:'text',text:clip(items[i]!,24),x:diag?r2(Math.min(.62,p.x-.12)):r2(p.x+.1),y:diag?r2(p.y+.095):r2(p.y-.035),w:diag?.36:.66,h:.07,size:4.2,weight:700,align:diag?'center':'start',in:IN(.5+i*.3,.35,diag?'up':'left')}));});
  return {layers,description:`${n} points along a path that draws itself, a marker landing on each.`};}},
 // One big symbol with rings and the key phrase typing in: a single strong idea.
 burst:{fits:r=>has(r,'hook','explain','reveal')?.6:.45,build:(r,x)=>{
  const layers:Record<string,unknown>[]=[],cy=.36+(x()-.5)*.06;
  for(const [k,s] of [[0,.62],[1,.46]] as const)layers.push(L({type:'shape',shape:'ring',x:r2(.5-s/2),y:r2(cy-s/2*.7),w:s,fill:k?'accent':'primary',size:k?3:2,opacity:.5,in:IN(.1+k*.15,.6,'scale'),loop:{kind:'pulse',amount:.4,speed:.7+k*.3}}));
  layers.push(L({type:'icon',icon:r.icons[0]!,x:.37,y:r2(cy-.13*.7-.03),w:.26,fill:'primary',color:'white',shape:'circle',in:IN(.3,.55,'pop','impact'),loop:{kind:'float',amount:.4}}));
  for(let k=0;k<3;k++)layers.push(L({type:'icon',icon:'sparkle',x:r2(.12+x()*.76),y:r2(.06+x()*.2),w:.06,color:k%2?'accent':'primary',in:IN(.6+k*.12,.3,'pop'),loop:{kind:'blink',amount:.6,speed:r2(.6+x())}}));
  layers.push(L({type:'text',text:clip(r.label,40),x:.06,y:.74,w:.88,h:.14,size:6.4,weight:800,align:'center',in:IN(.85,.9,'type')}));
  return {layers,description:'One large symbol with pulsing rings and sparkles, the key phrase typing in below.'};}},
 // A statement card: the key phrase big, an underline growing, an icon in the corner.
 statement:{fits:r=>(r.label.length>6?.7:.2)*(has(r,'explain','hook','pricing','form','logos')?1.2:1),build:(r,x)=>{
  const start=x()<.5;
  const layers=[L({type:'card',x:.04,y:.1,w:.92,h:.8,level:2,in:IN(0,.45,'scale')}),
   L({type:'icon',icon:r.icons[0]!,x:start?.1:.74,y:.17,w:.16,fill:'accent',color:'white',in:IN(.3,.45,'spin'),loop:{kind:loopOf(x),amount:.4}}),
   L({type:'text',text:clip(r.label,48),x:.1,y:.4,w:.8,h:.28,size:7.6,weight:800,align:start?'start':'center',in:IN(.5,1,'type')}),
   L({type:'bar',x:start?.1:.3,y:.74,w:start?.5:.4,h:.025,progress:1,in:IN(1.4,.6,'grow')})];
  return {layers,description:'The key phrase as a big statement on a card, an underline growing and an icon in the corner.'};}},
 // A number counting up with mini bars rising: a result.
 callout:{fits:r=>r.num?(has(r,'growth')?1.5:1.1):0,build:(r,x)=>{
  const n=r.num!,layers:Record<string,unknown>[]=[],bars=4,base=.78,col=x()<.5;
  layers.push(L({type:'card',x:.04,y:.06,w:.92,h:.88,in:IN(0,.4,'fade')}));
  // The bars only rise (a shape, not data): no values are made up.
  for(let i=0;i<bars;i++){const hgt=.12+i*(.32/(bars-1));layers.push(L({type:'shape',shape:'rect',x:r2(.56+i*.085),y:r2(base-hgt),w:.06,h:r2(hgt),fill:i===bars-1?'accent':'primary',opacity:i===bars-1?1:.55,in:IN(.4+i*.12,.5,'up','tick')}));}
  layers.push(L({type:'number',value:n.value,...(n.prefix?{prefix:n.prefix}:{}),...(n.suffix?{suffix:n.suffix}:{}),decimals:n.decimals,...dg(r),x:.1,y:col?.24:.3,w:.5,h:.2,size:16,weight:800,color:'primary',in:IN(.35,1.2,'count')}));
  layers.push(L({type:'text',text:clip(r.label,36),x:.1,y:col?.48:.54,w:.46,h:.2,size:4.6,weight:700,color:'muted',in:IN(.9,.4,'up')}));
  layers.push(L({type:'icon',icon:r.icons[0]!,x:.1,y:.1,w:.1,color:'accent',in:IN(.2,.4,'pop')}));
  return {layers,description:'A number counting up beside rising bars on a card.'};}},
 // A number inside an arc that draws to its share (for percentages), or a full ring.
 meter:{fits:r=>r.num?(r.num.suffix==='%'&&r.num.value<=100?1.4:has(r,'speed','number')?1:.6):0,build:(r,x)=>{
  const n=r.num!,share=n.suffix==='%'&&n.value<=100?Math.max(.05,n.value/100):1,cx=.5,cy=.4,R=.27,start=-90+(x()<.5?0:180),k=Math.max(2,Math.round(24*share));
  const pts=Array.from({length:k},(_,i)=>{const a=(start+360*share*i/(k-1))*Math.PI/180;return {x:r2(cx+Math.cos(a)*R),y:r2(cy+Math.sin(a)*R)};});
  const layers=[L({type:'shape',shape:'ring',x:r2(cx-R-.02),y:r2(cy-R-.02),w:r2(2*R+.04),fill:'muted',size:3,opacity:.25,in:IN(.05,.4,'scale')}),
   L({type:'line',points:pts,x:0,y:0,w:1,h:1,size:7,color:'primary',in:IN(.3,1.2,'draw')}),
   L({type:'number',value:n.value,...(n.prefix?{prefix:n.prefix}:{}),...(n.suffix?{suffix:n.suffix}:{}),decimals:n.decimals,...dg(r),x:.2,y:.32,w:.6,h:.16,size:13,weight:800,align:'center',in:IN(.3,1.2,'count')}),
   L({type:'icon',icon:r.icons[0]!,x:.86,y:.06,w:.1,color:'accent',in:IN(1.3,.4,'pop'),loop:{kind:'float',amount:.4}}),
   L({type:'text',text:clip(r.label,40),x:.06,y:.8,w:.88,h:.12,size:5.4,weight:800,align:'center',in:IN(1.2,.5,'up')})];
  return {layers,description:'The number counting up inside an arc that draws to its share.'};}},
 // Before → after: two tiles and an arrow drawing between them.
 flow:{fits:r=>r.from&&r.to?1.4:0,build:(r,x)=>{
  const sq=x()<.5?'circle':'rect';
  const layers=[L({type:'icon',icon:r.fromIcon??r.icons[0]!,x:.1,y:.26,w:.22,fill:'muted',color:'white',shape:sq,in:IN(.15,.45,'pop')}),
   L({type:'text',text:r.from!,x:.02,y:.56,w:.38,h:.1,size:4.4,weight:700,align:'center',color:'muted',in:IN(.35,.35,'fade')}),
   L({type:'line',points:[{x:0,y:.5},{x:1,y:.5}],x:.36,y:.32,w:.28,h:.1,size:5,color:'accent',in:IN(.6,.6,'draw','whoosh')}),
   L({type:'icon',icon:'arrow',x:.58,y:.31,w:.08,color:'accent',in:IN(1.1,.3,'pop','none')}),
   L({type:'icon',icon:r.toIcon??r.icons[1]??'sparkle',x:.68,y:.26,w:.22,fill:'primary',color:'white',shape:sq,in:IN(1.2,.5,'pop','success'),loop:{kind:'pulse',amount:.4}}),
   L({type:'text',text:r.to!,x:.6,y:.56,w:.38,h:.1,size:4.6,weight:800,align:'center',in:IN(1.35,.4,'up')})];
  return {layers,description:'Before and after as two tiles with an arrow drawing from one to the other.'};}},
 // Cards piling up, tilted and restless: pressure, a problem, too many things at once.
 stack:{fits:r=>r.from&&r.to?0:has(r,'problem','alerts')?1.8:has(r,'hook')?.8:0,build:(r,x)=>{
  const items=partsOf(r,4),layers:Record<string,unknown>[]=[],n=items.length||1,gap=Math.min(.19,.66/n),tilt=2+x()*3;
  (items.length?items:[clip(r.label,30)]).forEach((t,i)=>{const y=r2(.12+i*gap),dx=r2((i%2?.08:.02)+x()*.04),rot=r2((i%2?1:-1)*tilt);
   layers.push(L({type:'card',x:dx,y,w:.8,h:.15,level:1,rotate:rot,in:IN(.1+i*.28,.4,'down','pop'),loop:{kind:'sway',amount:.12,speed:r2(.6+x()*.5)}}));
   layers.push(L({type:'icon',icon:r.icons[i]??r.icons[0]!,x:r2(dx+.04),y:r2(y+.03),w:.09,fill:i%2?'accent':'primary',color:'white',rotate:rot,in:IN(.2+i*.28,.3,'pop','none')}));
   layers.push(L({type:'text',text:clip(t,26),x:r2(dx+.16),y:r2(y+.025),w:.6,h:.1,size:4.4,weight:700,rotate:rot,in:IN(.25+i*.28,.3,'fade')}));});
  layers.push(L({type:'icon',icon:'alert',x:.8,y:.02,w:.13,fill:'accent',color:'white',shape:'circle',in:IN(.2+n*.28,.4,'pop','impact'),loop:{kind:'pulse',amount:.6,speed:1.4}}));
  return {layers,description:`${n} tilted cards piling up one after another, with a warning that pulses: pressure or a problem.`};}},
 // Tiles in a grid, each with its icon and words: several things side by side.
 grid:{fits:r=>r.items.length>=3?1.1*(has(r,'team','logos','pricing','track','support')?1.25:1):0,build:(r,x)=>{
  const items=r.items.slice(0,4),n=items.length,cols=n===4?2:3,rows=Math.ceil(n/cols),tw=cols===2?.42:.29,th=rows===2?.36:.5,layers:Record<string,unknown>[]=[],order=x()<.5;
  items.forEach((t,i)=>{const c=i%cols,rr=Math.floor(i/cols),tx=r2(.5-(cols*tw+(cols-1)*.04)/2+c*(tw+.04)),ty=r2(.5-(rows*th+(rows-1)*.04)/2+rr*(th+.04)),k=order?i:n-1-i;
   layers.push(L({type:'card',x:tx,y:ty,w:tw,h:th,level:1,in:IN(.1+k*.18,.4,'scale')}));
   layers.push(L({type:'icon',icon:r.icons[i]!,x:r2(tx+tw/2-.065),y:r2(ty+th*.18),w:.13,fill:i%2?'accent':'primary',color:'white',shape:shapeOf(x),in:IN(.25+k*.18,.35,'pop'),loop:{kind:loopOf(x),amount:.3,speed:r2(.7+x()*.5)}}));
   layers.push(L({type:'text',text:clip(t,cols===3?16:22),x:r2(tx+.02),y:r2(ty+th*.62),w:r2(tw-.04),h:.08,size:cols===3?3.8:4.2,weight:700,align:'center',in:IN(.35+k*.18,.3,'up')}));});
  return {layers,description:`${n} tiles in a grid, each with an icon and its words.`};}},
 // The name or key phrase opening up: shapes sweep in, the words land, a mark pops.
 reveal:{fits:r=>has(r,'reveal')?1.9:has(r,'download')?.9:0,build:(r,x)=>{
  const dir=x()<.5?'left':'right',lw=r.label.toLowerCase(),words=r.words.filter(w=>!lw.includes(w.toLowerCase())).slice(0,2).map(cap);
  const layers=[L({type:'shape',shape:'blob',x:.08,y:.08,w:.5,fill:'primary',opacity:.18,in:IN(0,.6,'scale'),loop:{kind:'spin',amount:.08,speed:.4}}),
   L({type:'shape',shape:'circle',x:.5,y:.36,w:.4,fill:'accent',opacity:.2,in:IN(.1,.6,'scale'),loop:{kind:'float',amount:.5}}),
   L({type:'card',x:.08,y:.28,w:.84,h:.3,level:2,in:IN(.25,.5,dir)}),
   L({type:'icon',icon:r.icons[0]!,x:.13,y:.33,w:.16,fill:'primary',color:'white',shape:'circle',in:IN(.55,.45,'pop','impact')}),
   L({type:'text',text:clip(r.label,36),x:.33,y:.33,w:.56,h:.2,size:r.label.length>26?4.6:r.label.length>14?5.6:7,weight:800,in:IN(.65,.6,'type')}),
   ...words.map((w,i)=>L({type:'text',text:clip(w,16),x:r2(.16+i*.36),y:.68,w:.32,h:.07,size:4,weight:700,color:'muted',align:'center',in:IN(1.1+i*.15,.35,'up')})),
   L({type:'icon',icon:'sparkle',x:.82,y:.2,w:.08,color:'accent',in:IN(1,.35,'pop'),loop:{kind:'blink',amount:.6}})];
  return {layers,description:'The name or key phrase arriving on a card over sweeping shapes, with its key words below.'};}},
 // A button with the call to action, a ring pulsing around it, then a press and a check.
 action:{fits:r=>has(r,'cta','download','form')?2:0,build:(r,x)=>{
  const y=.32+(x()-.5)*.08,label=clip(r.label,34),fs=label.length>24?4:label.length>16?4.8:5.6;
  const layers=[L({type:'shape',shape:'pill',x:.06,y:r2(y-.06),w:.88,h:.3,fill:'accent',opacity:.18,in:IN(.4,.6,'scale'),loop:{kind:'pulse',amount:.7,speed:1.2}}),
   L({type:'shape',shape:'pill',x:.12,y:r2(y),w:.76,h:.18,fill:'primary',in:IN(.1,.5,'pop')}),
   L({type:'text',text:label,x:.15,y:r2(y+.03),w:.54,h:.12,size:fs,weight:800,align:'center',in:IN(.35,.6,'type')}), // ends before the arrow at .73
   L({type:'icon',icon:'arrow',x:.73,y:r2(y+.035),w:.1,color:'white',in:IN(.8,.35,'left','none'),loop:{kind:'sway',amount:.3}}),
   L({type:'icon',icon:'check',x:.42,y:r2(y+.3),w:.16,fill:'accent',color:'white',shape:'circle',in:IN(1.5,.45,'pop','success')}),
   ...(r.icons[0]&&r.icons[0]!=='sparkle'?[L({type:'icon',icon:r.icons[0],x:.08,y:.06,w:.1,color:'primary',in:IN(.2,.4,'pop'),loop:{kind:'float',amount:.4}})]:[])];
  return {layers,description:'The call to action on a button with a pulsing halo, then a check pops in.'};}},
 // The quoted words on a card, a big quotation mark, a line drawing under them.
 quote:{fits:r=>r.quote||has(r,'quote')?2:0,build:(r,x)=>{
  const text=clip(r.quote??r.label,120),big=text.length<50;
  const layers=[L({type:'card',x:.04,y:.12,w:.92,h:.72,level:2,in:IN(0,.45,'up')}),
   L({type:'icon',icon:'quote',x:.08,y:.03,w:.18,fill:'accent',color:'white',shape:'circle',in:IN(.25,.4,'pop')}),
   L({type:'text',text,x:.1,y:.3,w:.8,h:.38,size:big?6.4:4.8,weight:big?800:600,align:x()<.5?'start':'center',in:IN(.5,Math.min(1.6,.4+text.length*.02),'type')}),
   L({type:'line',points:[{x:0,y:.5},{x:1,y:.5}],x:.1,y:.72,w:.4,h:.04,size:4,color:'accent',in:IN(1.6,.5,'draw')})];
  return {layers,description:'The quoted words typing onto a card under a big quotation mark.'};}},
 // Pins dropping on an abstract land shape, joined by a route that draws.
 pins:{fits:r=>has(r,'map')?2:0,build:(r,x)=>{
  const items=r.items.length?partsOf(r,3):[clip(r.label,18)],n=items.length,pts=Array.from({length:n},(_,i)=>({x:r2(.18+i*(.6/(n-1||1))+(x()-.5)*.06),y:r2(.62-((i%2)*.32)+(x()-.5)*.06)}));
  const layers:Record<string,unknown>[]=[L({type:'shape',shape:'blob',x:.04,y:.1,w:.92,h:.78,fill:'primary',opacity:.1,in:IN(0,.6,'scale')}),
   L({type:'shape',shape:'blob',x:.5,y:.04,w:.4,h:.4,fill:'accent',opacity:.1,in:IN(.1,.6,'scale')})];
  if(n>1)layers.push(L({type:'line',points:pts.map(p=>({x:r2(p.x),y:r2(p.y+.05)})),x:0,y:0,w:1,h:1,size:4,color:'accent',in:IN(.4+n*.25,.8,'draw','whoosh')}));
  pts.forEach((p,i)=>{layers.push(L({type:'icon',icon:'pin',x:r2(p.x-.06),y:r2(p.y-.08),w:.12,color:i===n-1?'accent':'primary',in:IN(.3+i*.25,.4,'down','pop'),loop:{kind:'float',amount:.3}}));
   if(items[i])layers.push(L({type:'text',text:clip(items[i]!,18),x:r2(Math.max(0,p.x-.18)),y:r2(p.y+.09),w:.36,h:.07,size:4,weight:700,align:'center',in:IN(.45+i*.25,.3,'fade')}));});
  return {layers,description:`${n} pins dropping on an abstract map, joined by a route that draws.`};}},
 // The old way crossed out beside the new way: a comparison.
 contrast:{fits:r=>has(r,'compare')&&r.items.length?2:0,build:(r,x)=>{
  const old=partsOf(r,3),layers:Record<string,unknown>[]=[],swap=x()<.5;
  old.forEach((t,i)=>{const y=r2(.14+i*.2);
   layers.push(L({type:'card',x:.04,y,w:.44,h:.15,level:0,fill:'background',opacity:.9,in:IN(.1+i*.15,.35,'right')}));
   layers.push(L({type:'icon',icon:'x',x:.07,y:r2(y+.035),w:.07,color:'muted',in:IN(.25+i*.15,.3,'pop','none')}));
   layers.push(L({type:'text',text:clip(t,18),x:.16,y:r2(y+.03),w:.3,h:.09,size:3.8,weight:600,color:'muted',in:IN(.25+i*.15,.3,'fade')}));});
  layers.push(L({type:'card',x:.52,y:.12,w:.44,h:.62,level:2,fill:swap?'primary':undefined,in:IN(.7,.5,'scale')}));
  layers.push(L({type:'icon',icon:'check',x:.67,y:.2,w:.14,fill:swap?'surface':'accent',color:swap?'primary':'white',shape:'circle',in:IN(.95,.4,'pop','success')}));
  const lw=r.label.toLowerCase(),overlap=old.some(t=>lw.includes(t.toLowerCase())||t.toLowerCase().includes(lw));
  layers.push(L({type:'text',text:clip(overlap&&r.lead?r.lead:r.label,40),x:.56,y:.42,w:.36,h:.24,size:5,weight:800,align:'center',in:IN(1.1,.6,'type')}));
  return {layers,description:'The old way crossed out on one side, the new way on a bright card on the other.'};}},
 // The figure itself as a solid 3D object (bevelled, lit, casting a soft shadow), the phrase below.
 'solid-figure':{fits:r=>r.num&&fig(r.num).length<=7?(has(r,'growth','number','speed','reveal')?1:.75):0,build:(r,x)=>{
  const text=fig(r.num!,r.digits);
  const layers=[L({type:'scene3d',model:{kind:'text',text,camera:pick(x,['orbit','push','reveal'])},x:.04,y:.04,w:.92,h:.56,in:IN(.15,.9,pick(x,['pop','up','spin']))}),
   L({type:'icon',icon:r.icons[0]!,x:.44,y:.6,w:.12,color:'accent',in:IN(.9,.4,'pop','none'),loop:{kind:'float',amount:.4}}),
   L({type:'text',text:clip(r.label,40),x:.06,y:.76,w:.88,h:.14,size:5.6,weight:800,align:'center',in:IN(1.05,.6,'up')})];
  return {layers,description:'The figure as solid 3D, spinning in under a soft light, the key phrase below.'};}},
 // The sentence's own symbol as a 3D object (a tube icon, or a coin badge carrying it).
 'solid-object':{fits:r=>(has(r,'hook','reveal','done','speed','support','growth','download')?.6:.25)*(r.icons[0]&&r.icons[0]!=='sparkle'?1:.4),build:(r,x)=>{
  const icon=r.icons[0]!,badge=has(r,'done','support')||x()<.3;
  const model=badge?{kind:'shape',shape:'badge',icon,camera:pick(x,['orbit','float'])}:{kind:'icon',icon,camera:pick(x,['orbit','float','reveal'])};
  const layers=[L({type:'scene3d',model,x:.12,y:.04,w:.76,h:.6,in:IN(.1,.9,pick(x,['pop','spin','down']))}),
   L({type:'text',text:clip(r.label,40),x:.06,y:.7,w:.88,h:.16,size:6,weight:800,align:'center',in:IN(.8,.7,'type')})];
  return {layers,description:badge?'A 3D coin badge carrying the symbol, the key phrase typing in below.':'The symbol as a 3D object turning in the light, the key phrase typing in below.'};}},
};
/** A figure as written (prefix, value, suffix), for showing it as one word. */
const fig=(n:Num,digits?:'arabic'|'persian')=>{const t=(n.prefix??'')+n.value.toFixed(n.decimals)+(n.suffix??'');return digits?inScript(t,digits):t;};
/** A number layer's digits follow the sentence's. */
const dg=(r:Read)=>r.digits?{digits:r.digits}:{};
export const archetypes=Object.keys(ARCH);
const SHOWS_NUMBER=new Set(['callout','meter','solid-figure']);
/** 3D compositions: one family, so a video gets a 3D moment rather than 3D everywhere. */
const IN3D=new Set(['solid-figure','solid-object']);

/** A saved composition is never reused as is: scale, timing, entrances, shapes, colours and loops vary per video. */
export function vary(layers:Record<string,unknown>[],seed:string){
 const r=rng(seed),MOVES=['up','down','left','right','fade','scale'];
 const scale=.92+r()*.1,dy=(r()-.5)*.05,stagger=.85+r()*.35,dur=.85+r()*.3,swap=r()<.5,loopTo=['float','pulse','sway'][Math.floor(r()*3)]!;
 return layers.map(l0=>{const l={...l0};const inn={...(l.in as Record<string,unknown>)};
  for(const k of ['x','y'] as const)if(typeof l[k]==='number'&&l.type!=='line')l[k]=r2(Math.min(1.15,Math.max(-.15,.5+((l[k] as number)-.5)*scale+(k==='y'?dy:0))));
  for(const k of ['w','h'] as const)if(typeof l[k]==='number'&&l.type!=='line')l[k]=r2(Math.min(1.35,(l[k] as number)*scale));
  if(l.type==='line'){l.x=r2(.5+((l.x as number)-.5)*scale);l.y=r2(.5+((l.y as number)-.5)*scale+dy);l.w=r2((l.w as number)*scale);l.h=r2((l.h as number)*scale);}
  if(typeof inn.at==='number')inn.at=r2((inn.at as number)*stagger);if(typeof inn.dur==='number')inn.dur=r2(Math.max(.05,(inn.dur as number)*dur));
  if(MOVES.includes(String(inn.from))&&l.type!=='card'&&r()<.4)inn.from=MOVES[Math.floor(r()*MOVES.length)];
  if(swap&&(l.type==='shape'||l.type==='icon'||l.type==='line')){for(const k of ['fill','color'] as const){if(l[k]==='primary')l[k]='accent';else if(l[k]==='accent')l[k]='primary';}}
  if(l.loop&&r()<.4)l.loop={...(l.loop as object),kind:loopTo};
  l.in=inn;return l;});
}

/** Marks which words each layer stands for, so a voice-over can bring it in as they are spoken:
 *  a text its own words, a number its figure, an icon the words of the label that follows it. */
function speaks(layers:Record<string,unknown>[]){
 return layers.map((l,i)=>{const next=layers[i+1];
  const model=l.model as {kind?:string;text?:string}|undefined;
  const says=l.type==='text'?String(l.text??'').replace(/…$/,''):l.type==='number'?String(l.value):l.type==='scene3d'&&model?.kind==='text'?String(model.text??'').replace(/[^\p{L}\p{N}.]/gu,''):(l.type==='icon'||l.type==='scene3d')&&next?.type==='text'?String(next.text??'').replace(/…$/,''):'';
  return says.trim()?{...l,says:says.trim()}:l;});
}
/** How a learned confidence (0..1, 0.5 untested) weighs a composition. */
const weight=(c:number|undefined)=>c===undefined?1:(.2+2.3*c)**2/1.82;
/** A new visual for a sentence. `taken` lists compositions already used in this video (they are
 *  avoided so scenes differ); `learned` is the brain's score of each composition (pd-<name>). */
export function designPiece(sentence:string,o:{seed:string;role?:Role;label:string;items:string[];num?:Num;icon:(t:string,i:number)=>string;taken?:string[];learned?:Record<string,number>;exclude?:string[];
 /** Use this composition (a new variant of it), whatever else would fit. */
 only?:string}):Designed{
 const r=readSentence(sentence,o),x=rng(o.seed+':'+sentence),last=o.taken?.at(-1);
 // A sentence with a figure shows it: compositions without a number rarely win.
 const ranked=Object.entries(ARCH).map(([k,a])=>({k,s:a.fits(r)*(r.num&&!SHOWS_NUMBER.has(k)&&!keepsOwn(k,r)?.25:1)*(.7+x()*.6)*(k===last?.15:o.taken?.includes(k)?.45:1)*(IN3D.has(k)&&o.taken?.some(t=>IN3D.has(t))?.4:1)*weight(o.learned?.['pd-'+k])})).filter(a=>(o.only?a.k===o.only:a.s>0&&!o.exclude?.includes(a.k))).sort((a,b)=>b.s-a.s);
 const k=ranked[0]?.k??(o.exclude?.includes('statement')?'burst':'statement'),b=ARCH[k]!.build(r,x);
 return {archetype:k,description:b.description,layers:speaks(vary(b.layers,o.seed+':'+k+':'+sentence)),fit:fitOf(r,k)};
}
/** How well a composition suits a sentence's reading (0 = it cannot show it). */
function fitOf(r:Read,k:string){const a=ARCH[k];return a?a.fits(r)*(r.num&&!SHOWS_NUMBER.has(k)&&!keepsOwn(k,r)?.25:1):0;}
/** A quotation stays a quote and a call to action stays a button, even when they mention a figure ("Start your free 14-day trial"). */
function keepsOwn(k:string,r:Read){return k==='quote'&&!!r.quote||k==='action'&&has(r,'cta','download','form');}
/** How well a composition suits a sentence, as designPiece reads it. */
export function fitFor(sentence:string,k:string,o:{role?:Role;label:string;items:string[];num?:Num;icon:(t:string,i:number)=>string}){return fitOf(readSentence(sentence,o),k);}
