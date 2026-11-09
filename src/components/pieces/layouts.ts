// Layout variants: where a piece's parts sit. A dashboard can be tiles, one hero number with a
// trend line, or a list; a checklist rows, a grid or a stack of cards; and so on. Every variant
// keeps its piece's timetable (timing.ts), so motion and sound stay in step. A video picks
// variants from its style (seeded, steered by what the brain learned), and two pieces of the
// same kind in one video get different layouts. No DOM here.

export const layoutVariants:Record<string,string[]>={
 dashboard:['cards','hero','list'],
 checklist:['rows','grid','stack'],
 notifications:['stack','cascade','banner'],
 progress:['bars','rings','columns'],
 counter:['big','ring','split'],
 chat:['bubbles','thread'],
 avatars:['row','grid','stack'],
 quote:['card','big','split'],
 chart:['vertical','horizontal'],
 tasks:['bottom','top','side'],
 pricing:['columns','rows'],
};
export const hasLayouts=(kind:string)=>!!layoutVariants[kind];

function rng(seed:string){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

/** A layout for a piece: seeded by the video's style, steered by learned layout records
 *  (pt-layout-<kind>-<variant>), never the same as `avoid` (the last one of this kind in the video). */
export function pickLayout(kind:string,seed:string,{learned,avoid,chartType}:{learned?:Record<string,number>;avoid?:string;chartType?:string}={}){
 let opts=layoutVariants[kind];if(!opts)return undefined;
 if(kind==='chart'&&chartType&&chartType!=='bar')return undefined;
 if(avoid&&opts.length>1)opts=opts.filter(o=>o!==avoid);
 const w=opts.map(o=>{const c=learned?.[`pt-layout-${kind}-${o}`];return c===undefined?1:(.2+2.3*c)**2;});
 const r=rng(seed+':'+kind)(),sum=w.reduce((a,b)=>a+b,0);let x=r*sum;
 for(let i=0;i<opts.length;i++){x-=w[i]!;if(x<=0)return opts[i]!;}
 return opts[opts.length-1]!;
}

type AnyPiece={kind:string;layout?:string;type?:string;screen?:AnyPiece};
/** Gives every piece without a layout one, from the video's seed: two pieces of the same kind in
 *  a row never share a layout. Returns the layout trait ids used (pt-layout-<kind>-<variant>). */
export function assignLayouts(pieces:(AnyPiece|undefined)[],seed:string,learned?:Record<string,number>){
 const last=new Map<string,string>(),used:string[]=[];let n=0;
 for(const p of pieces){if(!p)continue;const c=p.kind==='phone'||p.kind==='browser'?p.screen:p;if(!c||!hasLayouts(c.kind))continue;
  if(!c.layout){const pick=pickLayout(c.kind,`${seed}:${n++}`,{learned,avoid:last.get(c.kind),chartType:c.type});if(pick)c.layout=pick;}
  if(c.layout){last.set(c.kind,c.layout);used.push(`pt-layout-${c.kind}-${c.layout}`);}}
 return [...new Set(used)];
}
