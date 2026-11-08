// When each piece animates, without a browser: the piece's length (used by the compositor to
// fit the piece in its scene) and its sound cues (a pop when a notification lands, a click
// when the cursor clicks...). The times mirror the animation in content.ts and index.ts;
// change both together.
import type {Piece,PieceContent} from '../../engine/scene-pieces-schema.js';

export type SoundKind='whoosh'|'click'|'tick'|'pop'|'success'|'impact';
/** A cue in seconds from the start of the piece's scene (before speed fitting). */
export type Cue={at:number;sound:SoundKind;gain:number;why:string};
type Timed={length:number;cues:Cue[]};
const cue=(at:number,sound:SoundKind,why:string,gain=1):Cue=>({at,sound,gain,why});
const shift=(cs:Cue[],by:number)=>cs.map(c=>({...c,at:c.at+by}));

function chartTiming(p:{type:'bar'|'line'|'donut';values:number[];highlight?:number}):Timed{
 const n=p.values.length,hi=p.highlight??p.values.indexOf(Math.max(...p.values));
 if(p.type==='bar')return {length:.6+n*.12+.9,cues:[...p.values.map((_,i)=>cue(.3+i*.1,'tick','bar grows',.8)),cue(.75+hi*.1,'pop','top bar value')]};
 if(p.type==='line')return {length:2.2,cues:[cue(.3,'whoosh','line draws',.5),...p.values.map((_,i)=>cue(.3+1.4*i/(n-1),'tick','point',.55)),cue(1.6,'pop','value tag')]};
 return {length:2,cues:[cue(.3,'whoosh','donut sweeps',.5),cue(1.3,'impact','donut complete',.8)]};
}

export function contentTiming(p:PieceContent):Timed{
 switch(p.kind){
  case 'counter':{const cues:Cue[]=[];for(let t=.1;t<1.35;t+=.13)cues.push(cue(t,'tick','counting',.45+.4*(t/1.35)));cues.push(cue(1.4,'impact','number lands'));return {length:1.8,cues};}
  case 'progress':{const n=p.items.length;return {length:.5+n*.25+1.2,cues:[...p.items.map((_,i)=>cue(.35+i*.22+.15,'tick','bar fills',.7)),cue(.35+(n-1)*.22+1.25,'success','all filled',.8)]};}
  case 'chart':return chartTiming(p);
  case 'dashboard':{
   const cues=[...p.stats.map((_,i)=>cue(.35+i*.15,'pop','tile',.8))];
   for(let t=.6;t<1.6;t+=.2)cues.push(cue(t,'tick','numbers count',.4));
   const ch=p.chart?chartTiming(p.chart):null;if(ch)cues.push(...shift(ch.cues,.9).map(c=>({...c,gain:c.gain*.7})));
   return {length:2.6,cues};
  }
  case 'tasks':{
   const n=p.tasks.length,startFly=.6+n*.18,people=p.people.length||new Set(p.tasks.map(t=>t.assignee).filter(Boolean)).size;
   const cues=p.tasks.map((_,i)=>cue(.2+i*.18,'tick','card slides in',.5));
   if(p.flow==='assign'&&people)cues.push(...p.tasks.map((_,i)=>cue(startFly+i*.45+.5,'pop','card reaches its person')));
   if(p.flow==='complete'){cues.push(...p.tasks.map((_,i)=>cue(startFly+i*.4,'click','task ticked')));cues.push(cue(startFly+(n-1)*.4+.35,'success','all done'));}
   return {length:startFly+n*.45+.6,cues};
  }
  case 'notifications':return {length:.3+p.items.length*.55+.4,cues:p.items.map((_,i)=>cue(.2+i*.55+.12,'pop','notification lands'))};
  case 'checklist':{const n=p.items.length;return {length:.6+n*.45+.3,cues:[...p.items.map((_,i)=>cue(.35+i*.45+.2,'click','item checked')),cue(.35+(n-1)*.45+.5,'success','list done',.8)]};}
  case 'chat':{let at=.2;const cues:Cue[]=[];for(const m of p.messages){const showAt=m.from==='me'?at:at+.7;cues.push(cue(showAt,'pop',m.from==='me'?'message sent':'message arrives',.85));at=showAt+.75;}return {length:at,cues};}
  case 'avatars':return {length:.4+p.people.length*.12+.8,cues:p.people.map((_,i)=>cue(.2+i*.12,'pop','person appears',.6))};
  case 'image':return {length:1,cues:[]};
  case 'pricing':{const t=pricingTimes(p);return {length:t.length,cues:[...p.plans.map((pl,i)=>cue(t.card(i)+.15,'pop',pl.highlight?'highlighted plan':'plan card',pl.highlight?1:.75)),
   ...Array.from({length:t.rows},(_,j)=>cue(t.feature(j),'tick','feature row',.6)),...(p.cta?[cue(t.press,'click','plan button')]:[])]};}
  case 'quote':{const t=quoteTimes(p);return {length:t.length,cues:[cue(.25,'pop','quote mark',.6),...Array.from({length:p.rating??0},(_,k)=>cue(t.star(k),'tick','star',.7)),cue(t.name,'pop','name',.6)]};}
  case 'logos':{const n=p.items.length;return {length:.25+n*.1+.8,cues:p.items.map((_,i)=>cue(.25+i*.1,'tick','logo',.6))};}
  case 'calendar':{const t=calendarTimes(p);return {length:t.length,cues:[cue(.3,'tick','days appear',.5),cue(.55,'tick','days appear',.4),cue(.8,'tick','days appear',.3),
   ...p.events.map((_,e)=>cue(t.event(e),'pop','event lands')),...(p.highlight?[cue(t.highlight,'click','day highlighted',.8)]:[])]};}
  case 'map':{const t=mapTimes(p);return {length:t.length,cues:[...p.pins.map((_,i)=>cue(t.pin(i)+.2,'pop','pin drops')),...(p.route?[cue(t.route,'whoosh','route draws',.55)]:[])]};}
  case 'compare':return {length:COMPARE.length,cues:[cue(COMPARE.sweep,'whoosh','slider sweeps',.6),cue(COMPARE.after,'success','after revealed',.7)]};
  case 'form':{const t=formTimes(p);const cues:Cue[]=[];
   p.fields.forEach((_,i)=>{const [a,b]=t.field(i);for(let x=a;x<b;x+=.12)cues.push(cue(x,'tick','typing',.35));});
   cues.push(cue(t.press,'click','button pressed'),cue(t.done,'success','submitted',.8));return {length:t.length,cues};}
  case 'download':{const t=downloadTimes(p);return {length:t.length,cues:[...p.buttons.map((_,i)=>cue(.2+i*.15+.1,'pop','store button',.7)),cue(t.press,'click','button pressed'),
   ...(p.rating!==undefined?Array.from({length:5},(_,k)=>cue(t.star(k),'tick','star',.5)):[])]};}
 }
}

// Shared timetables: content.ts animates from these, so sound and motion always agree.
type Of<K extends PieceContent['kind']>=Extract<PieceContent,{kind:K}>;
export function pricingTimes(p:Of<'pricing'>){
 const n=p.plans.length,rows=Math.max(0,...p.plans.map(x=>x.features.length)),fStart=.2+n*.15+.45;
 const press=fStart+rows*.15+.2;
 return {card:(i:number)=>.2+i*.15,price:(i:number)=>.45+i*.15,rows,feature:(j:number)=>fStart+j*.15,press,length:press+(p.cta?.6:.3)};
}
export function quoteTimes(p:Of<'quote'>){
 const words=p.text.split(/\s+/).filter(Boolean).length,step=Math.min(.06,1.4/Math.max(1,words)),wStart=.45,starsAt=wStart+words*step+.15;
 const name=starsAt+(p.rating??0)*.1+.1;
 return {wStart,step,star:(k:number)=>starsAt+k*.1,name,length:name+.6};
}
export function calendarTimes(p:Of<'calendar'>){
 const evStart=1.05;const highlight=evStart+p.events.length*.35+.1;
 return {cells:{start:.3,spread:.6},event:(e:number)=>evStart+e*.35,highlight,length:highlight+(p.highlight?.5:.2)};
}
export function mapTimes(p:Of<'map'>){
 const route=.5+p.pins.length*.3;
 return {pin:(i:number)=>.5+i*.3,route,length:route+(p.route?.8:0)+.4};
}
export const COMPARE={sweep:.8,sweepDur:1.1,after:1.95,length:2.4};
export function formTimes(p:Of<'form'>){
 const spans:[number,number][]=[];let x=.5;
 for(const f of p.fields){const d=Math.min(.9,[...f.value].length*.045);spans.push([x,x+d]);x+=d+.25;}
 const press=x+.1,done=press+.35;
 return {field:(i:number)=>spans[i]!,press,done,length:done+.7};
}
export function downloadTimes(p:Of<'download'>){
 const press=.2+p.buttons.length*.15+.4,stars=press+.35;
 return {press,star:(k:number)=>stars+k*.08,stars,length:stars+(p.rating!==undefined?5*.08+.4:0)+(p.caption?.5:.2)};
}

/** Length and cues of a whole piece, in seconds from the scene start. */
export function pieceTiming(p:Piece):Timed{
 let inner:Timed,offset=0,extra=0;const cues:Cue[]=[];
 if(p.kind==='phone'){inner=contentTiming(p.screen);offset=.45;extra=.5;cues.push(cue(0,'whoosh','phone slides up',.6));}
 else if(p.kind==='browser'){inner=contentTiming(p.screen);offset=.5;extra=.6;cues.push(cue(0,'whoosh','window rises',.5));}
 else inner=contentTiming(p);
 const length=p.delay+(extra?extra+inner.length:inner.length);
 cues.push(...shift(inner.cues,offset));
 const delayed=shift(cues,p.delay);
 // The cursor is not delayed; it clicks where the path says click.
 const clicks=(p.cursor?.path??[]).filter(q=>q.click).map(q=>cue(q.at,'click','cursor click',1.1));
 return {length,cues:[...delayed,...clicks].sort((a,b)=>a.at-b.at)};
}

const TRANSITION_SOUND:Record<Piece['transition'],number>={none:0,fade:0,wipe:.7,push:.8,'zoom-through':1,'mask-reveal':.7,'circle-reveal':.8};
/** Scene-time cues for one scene: its transition in, then the piece's own cues, fitted to the
 *  scene the way the compositor fits the animation (a long piece plays faster). */
export function sceneCues(p:Piece,duration:number){
 const t=pieceTiming(p),speed=Math.max(1,t.length/Math.max(.5,duration*.85));
 const out:Cue[]=[];
 const transition=TRANSITION_SOUND[p.transition]>0;
 if(transition)out.push(cue(0,'whoosh',p.transition+' transition',TRANSITION_SOUND[p.transition]));
 for(const c of t.cues){if(transition&&c.at<.4&&c.sound==='whoosh')continue; // one whoosh per entrance
 const at=c.at/speed;if(at<duration-.05)out.push({...c,at});}
 // Keep the soundscape clean: nothing closer than 70 ms, the stronger cue wins; 14 at most.
 const kept:Cue[]=[];
 for(const c of out.sort((a,b)=>a.at-b.at)){const last=kept.at(-1);if(last&&c.at-last.at<.07){if(c.gain>last.gain)kept[kept.length-1]=c;continue;}kept.push(c);}
 return kept.length>14?kept.filter(c=>c.sound!=='tick').concat(kept.filter(c=>c.sound==='tick')).slice(0,14).sort((a,b)=>a.at-b.at):kept;
}
