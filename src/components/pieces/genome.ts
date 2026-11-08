// A design style as a set of traits (a "genome"). The named styles are only teaching
// examples: every video gets a new genome, bred from the examples that fit its brief,
// mutated, steered by what the brain has learned, and checked to differ from every style used
// before. No DOM here: the server generates genomes, the renderer turns them into a skin.
import {z} from 'zod';

const transition=z.enum(['none','fade','wipe','push','zoom-through','mask-reveal','circle-reveal']);
const font=z.enum(['video','inter','grotesk','serif','round']);
export const genomeSchema=z.object({
 v:z.literal(1),id:z.string().regex(/^g-[0-9a-f]{8}$/),name:z.string().max(80),parents:z.array(z.string()).max(4),
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
export type Genome=z.infer<typeof genomeSchema>;
type Body=Omit<Genome,'v'|'id'|'name'|'parents'>;

/** The teaching examples: each a coherent point in the space, with the moods it suits. */
export const examples:Record<string,{name:string;mood:string[];g:Body}>={
 soft:{name:'Soft cards',mood:['clean','friendly','saas','product','modern','startup','default','light'],g:{tone:'light',accent:'brand',fill:'solid',tint:0,border:{w:1,color:'text'},shadow:{kind:'soft',depth:1,dir:0},radius:1,
  backdrop:{kind:'none',amount:0},type:{display:'video',numbers:'video',weight:700,upper:false,tracking:0},motion:{curve:'back',distance:1,scale:.94,rotate:0},tick:'round',avatar:'circle',transitions:['wipe','push','mask-reveal'],sound:{kit:'library',pitch:1,bright:.6}}},
 glass:{name:'Glass',mood:['premium','ai','fintech','elegant','calm','luxury','futuristic','sleek','modern'],g:{tone:'light',accent:'brand',fill:'glass',tint:.3,border:{w:1,color:'light'},shadow:{kind:'soft',depth:1.1,dir:0},radius:1.25,
  backdrop:{kind:'orbs',amount:.8},type:{display:'video',numbers:'video',weight:600,upper:false,tracking:-.01},motion:{curve:'cubic',distance:.6,scale:.97,rotate:0},tick:'round',avatar:'circle',transitions:['fade','zoom-through','circle-reveal'],sound:{kit:'soft',pitch:1.05,bright:.5}}},
 neon:{name:'Midnight neon',mood:['tech','developer','ai','gaming','crypto','night','bold','futuristic','dark','cyber','code'],g:{tone:'dark',accent:'cool',fill:'solid',tint:.15,border:{w:1,color:'primary'},shadow:{kind:'glow',depth:1,dir:0},radius:.55,
  backdrop:{kind:'grid',amount:.7},type:{display:'grotesk',numbers:'grotesk',weight:600,upper:true,tracking:.06},motion:{curve:'snap',distance:.55,scale:1,rotate:0},tick:'square',avatar:'squircle',transitions:['wipe','zoom-through','push'],sound:{kit:'digital',pitch:1,bright:.8}}},
 brutal:{name:'Brutalist',mood:['bold','fashion','streetwear','agency','creative','loud','edgy','youth','magazine','punk'],g:{tone:'paper',accent:'brand',fill:'solid',tint:0,border:{w:3,color:'ink'},shadow:{kind:'offset',depth:1,dir:1},radius:0,
  backdrop:{kind:'none',amount:0},type:{display:'grotesk',numbers:'grotesk',weight:800,upper:true,tracking:.02},motion:{curve:'snap',distance:1.4,scale:.9,rotate:-3},tick:'square',avatar:'square',transitions:['push','wipe','none'],sound:{kit:'punchy',pitch:.95,bright:.7}}},
 editorial:{name:'Editorial paper',mood:['luxury','editorial','finance','law','consulting','culture','calm','classic','premium','report','news'],g:{tone:'paper',accent:'brand',fill:'solid',tint:0,border:{w:1,color:'text'},shadow:{kind:'none',depth:0,dir:0},radius:.2,
  backdrop:{kind:'none',amount:0},type:{display:'serif',numbers:'serif',weight:400,upper:false,tracking:0},motion:{curve:'smooth',distance:.45,scale:1,rotate:0},tick:'round',avatar:'circle',transitions:['fade','mask-reveal','wipe'],sound:{kit:'minimal',pitch:.9,bright:.4}}},
 clay:{name:'Clay',mood:['playful','kids','education','friendly','fun','soft','health','food','casual','cute','3d'],g:{tone:'tinted',accent:'brand',fill:'solid',tint:.6,border:{w:0,color:'text'},shadow:{kind:'inset',depth:1,dir:0},radius:1.8,
  backdrop:{kind:'none',amount:0},type:{display:'round',numbers:'round',weight:600,upper:false,tracking:0},motion:{curve:'elastic',distance:1.2,scale:.7,rotate:0},tick:'round',avatar:'squircle',transitions:['circle-reveal','zoom-through','push'],sound:{kit:'soft',pitch:1.15,bright:.5}}},
 outline:{name:'Blueprint outline',mood:['technical','engineering','minimal','architecture','data','developer','precise','b2b','infrastructure'],g:{tone:'light',accent:'brand',fill:'solid',tint:.15,border:{w:2,color:'primary'},shadow:{kind:'none',depth:0,dir:0},radius:.4,
  backdrop:{kind:'dots',amount:.6},type:{display:'video',numbers:'grotesk',weight:600,upper:true,tracking:.1},motion:{curve:'smooth',distance:.5,scale:.98,rotate:0},tick:'square',avatar:'circle',transitions:['wipe','mask-reveal','fade'],sound:{kit:'minimal',pitch:1.05,bright:.7}}},
 pop:{name:'Pop colour',mood:['playful','consumer','social','retail','sale','music','fun','energetic','food','marketing','loud'],g:{tone:'brand',accent:'yellow',fill:'solid',tint:0,border:{w:0,color:'text'},shadow:{kind:'lift',depth:1,dir:0},radius:1.4,
  backdrop:{kind:'none',amount:0},type:{display:'grotesk',numbers:'grotesk',weight:800,upper:false,tracking:-.01},motion:{curve:'back',distance:1.4,scale:.6,rotate:4},tick:'round',avatar:'squircle',transitions:['zoom-through','circle-reveal','push'],sound:{kit:'punchy',pitch:1.1,bright:.8}}},
};
export const exampleIds=Object.keys(examples);

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

export type BreedInput={seed:string;
 /** Example ids with weights (from the brief, genre, brand and stated preferences). */
 parents:{id:string;w:number}[];
 /** Learned trait records: trait id → confidence 0..1 (0.5 = untested). */
 learned?:Record<string,number>;
 /** Traits the user wants to avoid (from "never brutal" etc.). */
 avoid?:string[];
 /** Styles already used: the new one must differ from all of them. */
 used?:Body[];
 dark?:boolean;
 /** How far to wander from the parents, 0 calm to 1 wild. */
 adventure?:number;
};

/** Breeds a new style: traits from the weighted parents, mutated, steered by learned traits,
 *  made coherent, and re-bred until it differs from every style used before. */
export function breed(i:BreedInput):Genome{
 const used=i.used??[],minGap=.2;let best:{g:Body;gap:number}|null=null;
 for(let attempt=0;attempt<40;attempt++){
  const r=rng(i.seed+'#'+attempt),adv=clamp((i.adventure??.35)+attempt*.03,0,1);
  const total=i.parents.reduce((a,p)=>a+Math.max(.01,p.w),0);
  const pick=()=>{let x=r()*total;for(const p of i.parents){x-=Math.max(.01,p.w);if(x<=0)return examples[p.id]!.g;}return examples[i.parents[0]!.id]!.g;};
  // A trait that kept being approved is chosen far more often; one that kept being rejected, rarely.
  const learnedW=(trait:string)=>{const c=i.learned?.['pt-'+trait];const avoid=i.avoid?.includes(trait)?.05:1;return (c===undefined?1:(.2+2.3*c)**2)*avoid;};
  /** Take a value from a parent, sometimes mutate to any value, weighted by what was learned. */
  const choose=<T extends string>(key:string,fromParent:T,trait:(v:T)=>string):T=>{
   const opts=ENUMS[key] as T[];const base=r()<adv*.45?opts[Math.floor(r()*opts.length)]!:fromParent;
   const w=opts.map(o=>(o===base?3:.25)*learnedW(trait(o)));const sum=w.reduce((a,b)=>a+b,0);let x=r()*sum;
   for(let k=0;k<opts.length;k++){x-=w[k]!;if(x<=0)return opts[k]!;}return base;};
  const num=(v:number,range:number,lo:number,hi:number)=>clamp(v+(r()*2-1)*range*adv,lo,hi);
  // The best-fitting parent leads the defining traits (tone, colour, corners) most of the time.
  const lead=examples[i.parents[0]!.id]!.g;const A=r()<.6?lead:pick(),B=pick(),C=pick();
  const g:Body={
   tone:choose('tone',(i.dark?'dark':A.tone),v=>'tone-'+v),accent:choose('accent',B.accent,v=>'accent-'+v),
   fill:choose('fill',C.fill,v=>'fill-'+v),tint:num((A.tint+B.tint)/2,.5,0,1),
   border:{w:num(pick().border.w,1.5,0,4),color:choose('border',pick().border.color,()=>'')},
   shadow:{kind:choose('shadow',B.shadow.kind,v=>'shadow-'+v),depth:num(B.shadow.depth||.6,.6,0,1.6),dir:num(B.shadow.dir,1,-1,1)},
   radius:num((A.radius+C.radius)/2,.8,0,2.2),
   backdrop:{kind:choose('backdrop',pick().backdrop.kind,v=>'backdrop-'+v),amount:num(.6,.4,.2,1)},
   type:{display:choose('font',C.type.display,v=>'font-'+v),numbers:choose('font',pick().type.numbers,()=>''),weight:Math.round(num(A.type.weight,250,300,900)/100)*100,
    upper:r()<adv*.3?!B.type.upper:B.type.upper,tracking:num(B.type.tracking,.05,-.03,.16)},
   motion:{curve:choose('curve',A.motion.curve,v=>'motion-'+v),distance:num(A.motion.distance,.6,.3,1.8),scale:num(A.motion.scale,.25,.5,1),rotate:num(A.motion.rotate,5,-8,8)},
   tick:choose('tick',pick().tick,()=>''),avatar:choose('avatar',pick().avatar,()=>''),
   transitions:[...new Set([...A.transitions.slice(0,1),...B.transitions.slice(0,2),...(r()<adv?[ENUMS.transition![Math.floor(r()*6)] as Body['transitions'][number]]:[])])].slice(0,3),
   sound:{kit:choose('kit',B.sound.kit,v=>'sound-'+v),pitch:num(B.sound.pitch,.25,.7,1.35),bright:num(B.sound.bright,.4,0,1)},
  };
  cohere(g,r);
  const gap=used.length?Math.min(...used.map(u=>distance(g,u))):1;
  if(!best||gap>best.gap)best={g,gap};
  if(gap>=minGap)break;
 }
 const g=best!.g;const id='g-'+hashHex(JSON.stringify(g)+i.seed).slice(0,8);
 return genomeSchema.parse({v:1,id,name:describe(g),parents:i.parents.slice(0,3).map(p=>p.id),...g});
}

/** Makes a bred style coherent (no glass without something behind it, offset shadows need a border...). */
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

/** A readable name for a bred style ("Dark glass, glowing, grotesk caps, snappy"). */
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
/** The genome of a named example (for a style asked for by name, before it is varied). */
export const exampleGenome=(id:string):Genome=>genomeSchema.parse({v:1,id:'g-'+hashHex(id).slice(0,8),name:examples[id]?.name??id,parents:[id],...(examples[id]??examples.soft!).g});
