// A design style as a set of traits (a "genome"), generated from zero for every video: each
// trait is drawn on its own, nudged by cues in the brief (words that suggest a mood), by what
// the brain has learned from verdicts, and by what the user asked for or against, then made
// coherent and checked to differ from every style used before. There are no preset looks.
// No DOM here: the server generates genomes, the renderer turns them into a skin.
import {z} from 'zod';

const transition=z.enum(['none','fade','wipe','push','zoom-through','mask-reveal','circle-reveal']);
const font=z.enum(['video','inter','grotesk','serif','round']);
const genomeShape=z.object({
 v:z.literal(1),id:z.string().regex(/^g-[0-9a-f]{8}$/),name:z.string().max(140),/** The brief's words that steered this style. */ cues:z.array(z.string().max(30)).max(12),
 tone:z.enum(['light','dark','paper','tinted','brand']),
 accent:z.enum(['brand','warm','cool','yellow','complement']),
 fill:z.enum(['solid','glass','gradient']),tint:z.number().min(0).max(1),
 border:z.object({w:z.number().min(0).max(4),color:z.enum(['text','primary','ink','light'])}).strict(),
 shadow:z.object({kind:z.enum(['none','soft','offset','glow','inset','lift']),depth:z.number().min(0).max(1.6),dir:z.number().min(-1).max(1)}).strict(),
 radius:z.number().min(0).max(2.2),
 backdrop:z.object({kind:z.enum(['none','orbs','grid','dots','stripes','gradient','rings']),amount:z.number().min(0).max(1)}).strict(),
 type:z.object({display:font,numbers:font,weight:z.number().int().min(300).max(900),upper:z.boolean(),tracking:z.number().min(-.03).max(.16)}).strict(),
 motion:z.object({curve:z.enum(['back','cubic','elastic','smooth','snap']),distance:z.number().min(.3).max(1.8),scale:z.number().min(.5).max(1),rotate:z.number().min(-8).max(8)}).strict(),
 tick:z.enum(['round','square']),avatar:z.enum(['circle','square','squircle']),
 transitions:z.array(transition).min(1).max(3),
 sound:z.object({kit:z.enum(['library','soft','digital','punchy','minimal']),pitch:z.number().min(.7).max(1.35),bright:z.number().min(0).max(1)}).strict(),
}).strict();
/** A style; one saved by an older version (bred from named examples, with `parents`) still opens. */
export const genomeSchema=z.preprocess(v=>{if(!v||typeof v!=='object'||!('parents' in v))return v;const {parents:_p,...rest}=v as Record<string,unknown>;void _p;return {cues:[],...rest};},genomeShape);
export type Genome=z.infer<typeof genomeShape>;
export type Body=Omit<Genome,'v'|'id'|'name'|'cues'>;

// ---------- randomness (seeded, so a job's style is reproducible) ----------
function rng(seed:string){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));

// ---------- traits (what the brain learns) ----------
/** The discrete traits of a genome, as ids the brain keeps a record for (pt-<trait>). */
export function traits(g:Body):string[]{
 return [`tone-${g.tone}`,`fill-${g.fill}`,`shadow-${g.shadow.kind}`,`backdrop-${g.backdrop.kind}`,`motion-${g.motion.curve}`,`font-${g.type.display}`,
  `corners-${g.radius<.15?'square':g.radius<.8?'tight':g.radius<1.5?'round':'pill'}`,`border-${g.border.w<.5?'none':g.border.w<2?'thin':'thick'}`,`case-${g.type.upper?'upper':'normal'}`,`sound-${g.sound.kit}`,`accent-${g.accent}`];
}
export const traitLabel=(t:string)=>t.replace('-',': ');
const ENUMS:Record<string,string[]>={tone:['light','dark','paper','tinted','brand'],accent:['brand','warm','cool','yellow','complement'],fill:['solid','glass','gradient'],
 border:['text','primary','ink','light'],shadow:['none','soft','offset','glow','inset','lift'],backdrop:['none','orbs','grid','dots','stripes','gradient','rings'],
 font:['video','inter','grotesk','serif','round'],curve:['back','cubic','elastic','smooth','snap'],tick:['round','square'],avatar:['circle','square','squircle'],
 kit:['library','soft','digital','punchy','minimal'],transition:['fade','wipe','push','zoom-through','mask-reveal','circle-reveal']};

/** How different two styles are, 0 (same) to about 1. */
export function distance(a:Body,b:Body){
 const e=(x:unknown,y:unknown)=>x===y?0:1,n=(x:number,y:number,r:number)=>Math.min(1,Math.abs(x-y)/r);
 const parts=[e(a.tone,b.tone)*2,e(a.fill,b.fill),e(a.shadow.kind,b.shadow.kind)*1.5,n(a.shadow.depth,b.shadow.depth,1.5),e(a.backdrop.kind,b.backdrop.kind)*1.2,n(a.radius,b.radius,1.5)*1.2,
  n(a.border.w,b.border.w,3),e(a.border.color,b.border.color)*.5,e(a.type.display,b.type.display),e(a.type.numbers,b.type.numbers)*.5,n(a.type.weight,b.type.weight,500)*.6,e(a.type.upper,b.type.upper)*.6,
  e(a.motion.curve,b.motion.curve),n(a.motion.distance,b.motion.distance,1.2)*.6,n(a.motion.rotate,b.motion.rotate,8)*.5,e(a.accent,b.accent)*.8,n(a.tint,b.tint,1)*.6,
  e(a.sound.kit,b.sound.kit)*.6,n(a.sound.pitch,b.sound.pitch,.5)*.3,e(a.tick,b.tick)*.3,e(a.avatar,b.avatar)*.3,(a.transitions.filter(t=>!b.transitions.includes(t)).length/3)*.6];
 return parts.reduce((x,y)=>x+y,0)/15.5;
}

/** Words in a brief that suggest traits: general design knowledge, not looks. Each cue nudges
 *  single traits; the style itself is still drawn trait by trait. */
const CUES:{words:RegExp;boost:Record<string,number>}[]=[
 {words:/\b(tech|developer|devs?|code|coding|night|gaming|gamer|crypto|cyber|hacker|terminal|api|dark)\b/,boost:{'tone-dark':5,'shadow-glow':3,'backdrop-grid':2,'font-grotesk':2,'motion-snap':2,'sound-digital':3,'case-upper':1.5,'accent-cool':2}},
 {words:/\b(premium|luxury|elegant|calm|finance|financial|money|wealth|bank|law|legal|consulting|advice|classic|report)\b/,boost:{'tone-paper':3,'font-serif':3,'shadow-none':2,'motion-smooth':3,'sound-minimal':2,'corners-tight':1.5,'fill-glass':1.2}},
 {words:/\b(ai|smart|futur\w*|intelligen\w*|assistant|cloud|vision|magic)\b/,boost:{'fill-glass':3,'backdrop-orbs':3,'backdrop-gradient':1.5,'motion-cubic':2,'sound-soft':2,'corners-round':1.5}},
 {words:/\b(kids?|children|fun|play\w*|game|learn\w*|school|education|food|snack|candy|pets?|cute|toy)\b/,boost:{'tone-tinted':3,'shadow-inset':3,'corners-pill':3,'font-round':3,'motion-elastic':3,'sound-soft':2,'accent-yellow':1.5}},
 {words:/\b(bold|fashion|streetwear|drop|sneakers?|agency|loud|edgy|youth|music|festival|sale|deal)\b/,boost:{'shadow-offset':4,'corners-square':3,'font-grotesk':2,'case-upper':3,'motion-snap':2,'sound-punchy':3,'border-thick':3,'tone-paper':1.5}},
 {words:/\b(technical|engineer\w*|data|analytics|infrastructure|b2b|precise|minimal|architecture|blueprint)\b/,boost:{'shadow-none':3,'border-thick':2,'backdrop-dots':3,'case-upper':2,'motion-smooth':2,'sound-minimal':3,'font-inter':1.5}},
 {words:/\b(saas|team|teams|workspace|product|startup|productivity|tasks?|projects?)\b/,boost:{'tone-light':2,'shadow-soft':2,'corners-round':2,'motion-back':2,'sound-library':2}},
 {words:/\b(energy|solar|green|eco|nature|clean|health|wellness|calm)\b/,boost:{'tone-tinted':1.5,'backdrop-gradient':2,'corners-round':1.5,'motion-smooth':1.5,'accent-warm':1.5}},
 {words:/\b(shop|store|retail|consumer|brand|social|launch|new|app)\b/,boost:{'tone-brand':2,'shadow-lift':2,'motion-back':1.5,'sound-punchy':1.5,'accent-yellow':1.2}},
];
const CORNERS:Record<string,[number,number]>={square:[0,.06],tight:[.25,.7],round:[.85,1.4],pill:[1.5,2.2]};
const BORDERS:Record<string,[number,number]>={none:[0,.2],thin:[.8,1.6],thick:[2.2,3.6]};

export type GenerateInput={seed:string;brief:string;
 /** Learned trait records: pt-<trait> → confidence 0..1 (0.5 = untested). */
 learned?:Record<string,number>;
 /** Traits to favour or avoid (from the user's words: "dark styles", "never square"). */
 prefer?:string[];avoid?:string[];
 /** Styles already used: the new one must differ from all of them. */
 used?:Body[];dark?:boolean;
};
/** Which cues of the brief steer the style. */
export function cuesOf(brief:string){const s=brief.toLowerCase();return CUES.flatMap(c=>[...s.matchAll(new RegExp(c.words.source,'g'))].map(m=>m[0]));}
/** Trait ids a phrase points at (for preferences like "make it dark and glowing"). */
export function traitsFromWords(text:string){const s=text.toLowerCase();const out=new Set<string>();
 for(const c of CUES)if(c.words.test(s))for(const [t,b] of Object.entries(c.boost))if(b>=2.5)out.add(t);
 for(const t of ['dark','light','paper','tinted','glass','gradient','glow','offset','inset','lift','orbs','grid','dots','stripes','rings','serif','grotesk','round','rounded','square','pill','elastic','snap','smooth','bouncy','caps','uppercase'])
  if(new RegExp(`\\b${t}\\b`).test(s))out.add(({dark:'tone-dark',light:'tone-light',paper:'tone-paper',tinted:'tone-tinted',glass:'fill-glass',gradient:'fill-gradient',glow:'shadow-glow',offset:'shadow-offset',inset:'shadow-inset',lift:'shadow-lift',
   orbs:'backdrop-orbs',grid:'backdrop-grid',dots:'backdrop-dots',stripes:'backdrop-stripes',rings:'backdrop-rings',serif:'font-serif',grotesk:'font-grotesk',round:'corners-round',rounded:'corners-round',square:'corners-square',pill:'corners-pill',
   elastic:'motion-elastic',bouncy:'motion-elastic',snap:'motion-snap',smooth:'motion-smooth',caps:'case-upper',uppercase:'case-upper'} as Record<string,string>)[t]!);
 return [...out];}

/** Generates a new style from zero: every trait drawn on its own, steered by cues, learning and
 *  the user's wishes, made coherent, and drawn again until it differs from every earlier style. */
export function generate(i:GenerateInput):Genome{
 const s=i.brief.toLowerCase(),boost:Record<string,number>={};
 for(const c of CUES)if(c.words.test(s))for(const [t,b] of Object.entries(c.boost))boost[t]=(boost[t]??1)*b;
 for(const t of i.prefer??[])boost[t]=(boost[t]??1)*6;
 if(i.dark)boost['tone-dark']=(boost['tone-dark']??1)*8;
 const used=i.used??[],minGap=.2;let best:{g:Body;gap:number}|null=null;
 for(let attempt=0;attempt<60;attempt++){
  const r=rng(i.seed+'#'+attempt);
  const weight=(t:string)=>{const c=i.learned?.['pt-'+t];return (boost[t]??1)*(c===undefined?1:(.2+2.3*c)**2)*(i.avoid?.includes(t)?.03:1);};
  const draw=<T extends string>(opts:readonly T[],trait:(v:T)=>string):T=>{const w=opts.map(o=>weight(trait(o)));const sum=w.reduce((a,b)=>a+b,0);let x=r()*sum;for(let k=0;k<opts.length;k++){x-=w[k]!;if(x<=0)return opts[k]!;}return opts[opts.length-1]!;};
  const span=([a,b]:[number,number])=>a+(b-a)*r();
  const corners=draw(['square','tight','round','pill'] as const,v=>'corners-'+v),border=draw(['none','thin','thick'] as const,v=>'border-'+v);
  const curve=draw(ENUMS.curve as unknown as readonly Body['motion']['curve'][],v=>'motion-'+v);
  const display=draw(ENUMS.font as unknown as readonly Body['type']['display'][],v=>'font-'+v);
  const trans=[...ENUMS.transition!] as Body['transitions'][number][];const picked:Body['transitions'][number][]=[];
  for(let k=0;k<3;k++){const left=trans.filter(t=>!picked.includes(t));picked.push(left[Math.floor(r()*left.length)]!);}
  const g:Body={
   tone:draw(ENUMS.tone as unknown as readonly Body['tone'][],v=>'tone-'+v),accent:draw(ENUMS.accent as unknown as readonly Body['accent'][],v=>'accent-'+v),
   fill:draw(ENUMS.fill as unknown as readonly Body['fill'][],v=>'fill-'+v),tint:r(),
   border:{w:Number(span(BORDERS[border]!).toFixed(2)),color:(ENUMS.border as Body['border']['color'][])[Math.floor(r()*4)]!},
   shadow:{kind:draw(ENUMS.shadow as unknown as readonly Body['shadow']['kind'][],v=>'shadow-'+v),depth:Number((.5+r()*.9).toFixed(2)),dir:Number((r()*2-1).toFixed(2))},
   radius:Number(span(CORNERS[corners]!).toFixed(2)),
   backdrop:{kind:draw(ENUMS.backdrop as unknown as readonly Body['backdrop']['kind'][],v=>'backdrop-'+v),amount:Number((.35+r()*.6).toFixed(2))},
   type:{display,numbers:r()<.55?display:draw(ENUMS.font as unknown as readonly Body['type']['numbers'][],v=>'font-'+v),weight:Math.round((weight('case-upper')>1.5?650:450)+r()*350)/50*50|0,
    upper:r()<Math.min(.85,.25*weight('case-upper')),tracking:Number(((r()-.3)*.08).toFixed(3))},
   motion:{curve,distance:Number(span(curve==='snap'?[.4,.9]:curve==='smooth'||curve==='cubic'?[.3,.75]:[.85,1.6]).toFixed(2)),scale:Number(span(curve==='elastic'||curve==='back'?[.55,.9]:[.9,1]).toFixed(2)),rotate:Number(((r()*2-1)*(weight('shadow-offset')>2?5:2)).toFixed(1))},
   tick:r()<.5?'round':'square',avatar:(['circle','square','squircle'] as const)[Math.floor(r()*3)]!,transitions:picked,
   sound:{kit:draw(ENUMS.kit as unknown as readonly Body['sound']['kit'][],v=>'sound-'+v),pitch:Number((.8+r()*.45).toFixed(2)),bright:Number(r().toFixed(2))},
  };
  g.type.weight=Math.max(300,Math.min(900,Math.round(g.type.weight/100)*100));
  cohere(g,r);
  const gap=used.length?Math.min(...used.map(u=>distance(g,u))):1;
  if(!best||gap>best.gap)best={g,gap};
  if(gap>=minGap)break;
 }
 const g=best!.g;const id='g-'+hashHex(JSON.stringify(g)+i.seed).slice(0,8);
 return genomeSchema.parse({v:1,id,name:describe(g),cues:[...new Set(cuesOf(i.brief))].slice(0,12),...g});
}
/** Makes a generated style coherent (no glass without something behind it, offset shadows need a border...). */
function cohere(g:Body,r:()=>number){
 if(g.fill==='glass'&&(g.backdrop.kind==='none'||g.backdrop.kind==='stripes'))g.backdrop={kind:r()<.5?'orbs':'gradient',amount:Math.max(.6,g.backdrop.amount)};
 if(g.fill==='glass'&&g.tone==='brand')g.tone='light';
 if(g.shadow.kind==='offset'&&g.border.w<1.5)g.border.w=1.5+r()*1.5;
 if(g.shadow.kind==='offset'&&g.border.color==='light')g.border.color='ink';
 if(g.tone==='dark'&&g.border.color==='ink')g.border.color=r()<.5?'primary':'light';
 if(g.tone!=='dark'&&g.shadow.kind==='glow'&&r()<.6)g.shadow.kind='soft';
 if(g.shadow.kind==='inset'&&g.radius<1)g.radius=1+r();
 if(g.shadow.kind==='inset'&&g.border.w>1)g.border.w=0;
 if(g.type.display==='serif')g.type.upper=false,g.type.weight=Math.min(g.type.weight,500);
 if(g.type.display==='round'&&g.motion.curve==='snap')g.motion.curve='back';
 if(g.type.display==='round')g.type.upper=false;
 if(g.motion.curve==='smooth'||g.motion.curve==='cubic')g.motion.rotate*=.3;
 if(!g.transitions.length)g.transitions=['wipe'];
}
const hashHex=(s:string)=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(const c of s){const k=c.charCodeAt(0);h1=Math.imul(h1^k,2654435761);h2=Math.imul(h2^k,1597334677);}
 h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
 return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');};

/** A readable name for a generated style ("Dark glass, glowing, grotesk caps, snappy"). */
export function describe(g:Body){
 const tone={light:'Light',dark:'Dark',paper:'Paper',tinted:'Tinted',brand:'Brand-colour'}[g.tone];
 const fill=g.fill==='glass'?' glass':g.fill==='gradient'?' gradient':'';
 const depth={none:'flat',soft:'soft shadows',offset:'hard offset shadows',glow:'glowing edges',inset:'puffy clay',lift:'chunky 3D edges'}[g.shadow.kind];
 const corners=g.radius<.15?'square':g.radius<.8?'tight corners':g.radius<1.5?'rounded':'pill-round';
 const font={video:'',inter:'Inter',grotesk:'grotesk',serif:'serif',round:'rounded type'}[g.type.display];
 const motion={back:'springy',cubic:'smooth',elastic:'bouncy',smooth:'calm',snap:'snappy'}[g.motion.curve];
 const bd=g.backdrop.kind==='none'?'':` on ${g.backdrop.kind}`;
 return `${tone}${fill}${bd}, ${depth}, ${corners}${font?', '+font+(g.type.upper?' caps':''):g.type.upper?', caps':''}, ${motion}`;
}
