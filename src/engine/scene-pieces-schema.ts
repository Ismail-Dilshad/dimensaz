// Animated scene pieces: ready-made, brand-coloured visuals that show what a sentence says
// (UI mockups, dashboards, task cards flying to avatars, charts, counters, notifications,
// chats, checklists, cursors) plus designed transitions. A scene's text stays on screen as
// the headline; the piece is the visual. Everything is deterministic in time.
import {z} from 'zod';
import {genomeSchema} from '../components/pieces/genome.js';

const hex=z.string().regex(/^#[0-9a-f]{6}$/i);
const label=z.string().min(1).max(80);
const short=z.string().min(1).max(160);

/** Design style id (see components/pieces/skins.ts): soft, glass, neon, brutal, editorial, clay, outline, pop. */
const styleId=z.string().regex(/^[a-z][a-z0-9-]{1,30}$/);
export const pieceThemeSchema=z.object({primary:hex,accent:hex,surface:hex,background:hex,text:hex,muted:hex,radius:z.number().min(0).max(48).default(20),style:styleId.optional(),
 /** The video's own bred design style (components/pieces/genome.ts); takes precedence over `style`. */
 genome:genomeSchema.optional()}).strict();
export type PieceTheme=z.infer<typeof pieceThemeSchema>;

const person=z.object({name:label,color:hex.optional()}).strict();
const stat=z.object({label,value:z.number(),prefix:z.string().max(4).optional(),suffix:z.string().max(6).optional(),decimals:z.number().int().min(0).max(2).default(0),trend:z.enum(['up','down','none']).default('none')}).strict();
const chart=z.object({type:z.enum(['bar','line','donut']).default('bar'),values:z.array(z.number()).min(2).max(12),labels:z.array(z.string().max(12)).optional(),highlight:z.number().int().nonnegative().optional(),unit:z.string().max(6).optional()}).strict();
/** A point inside the piece: 0..1 of its width and height. */
const point=z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).strict();
export const cursorSchema=z.object({
 /** Where the cursor goes and when (seconds into the scene); it clicks on every step with click:true. */
 path:z.array(point.extend({at:z.number().min(0),click:z.boolean().default(false)}).strict()).min(1).max(12),
 style:z.enum(['arrow','hand']).default('arrow'),
}).strict();

const base={title:z.string().max(60).optional()};
/** Where the piece's parts sit (components/pieces/layouts.ts); chosen per video when left out. */
const layout=z.string().regex(/^[a-z][a-z-]{1,20}$/).optional();
const dashboard=z.object({kind:z.literal('dashboard'),layout,...base,stats:z.array(stat).min(1).max(4),chart:chart.optional()}).strict();
const tasks=z.object({kind:z.literal('tasks'),layout,...base,tasks:z.array(z.object({title:short,assignee:z.string().max(40).optional(),tag:z.string().max(16).optional()}).strict()).min(1).max(6),
 people:z.array(person).max(5).default([]),flow:z.enum(['assign','complete','appear']).default('assign')}).strict();
const chartPiece=z.object({kind:z.literal('chart'),layout,...base,...chart.shape}).strict();
const counter=z.object({kind:z.literal('counter'),layout,...base,from:z.number().default(0),to:z.number(),prefix:z.string().max(4).optional(),suffix:z.string().max(6).optional(),decimals:z.number().int().min(0).max(2).default(0),caption:z.string().max(60).optional()}).strict();
const progress=z.object({kind:z.literal('progress'),layout,...base,items:z.array(z.object({label,value:z.number().min(0).max(100)}).strict()).min(1).max(5)}).strict();
const notifications=z.object({kind:z.literal('notifications'),layout,...base,items:z.array(z.object({app:label,title:short,body:z.string().max(160).optional()}).strict()).min(1).max(4)}).strict();
const checklist=z.object({kind:z.literal('checklist'),layout,...base,items:z.array(short).min(1).max(6)}).strict();
const chat=z.object({kind:z.literal('chat'),layout,...base,messages:z.array(z.object({from:z.enum(['me','them']),text:short,name:z.string().max(30).optional()}).strict()).min(1).max(6)}).strict();
const avatars=z.object({kind:z.literal('avatars'),layout,...base,people:z.array(person).min(1).max(6),caption:z.string().max(60).optional()}).strict();
const image=z.object({kind:z.literal('image'),layout,...base,asset:z.string().min(1),fit:z.enum(['cover','contain']).default('cover')}).strict();
const plan=z.object({name:label,price:z.number().nonnegative(),prefix:z.string().max(4).default('$'),period:z.string().max(12).optional(),features:z.array(short).max(5).default([]),
 highlight:z.boolean().default(false),badge:z.string().max(20).optional()}).strict();
const pricing=z.object({kind:z.literal('pricing'),layout,...base,plans:z.array(plan).min(1).max(3),cta:z.string().max(30).optional()}).strict();
const quote=z.object({kind:z.literal('quote'),layout,text:z.string().min(1).max(220),name:label,role:z.string().max(60).optional(),rating:z.number().int().min(1).max(5).optional()}).strict();
const logos=z.object({kind:z.literal('logos'),layout,...base,items:z.array(z.object({name:z.string().min(1).max(30),asset:z.string().optional()}).strict()).min(2).max(8)}).strict();
const calendar=z.object({kind:z.literal('calendar'),layout,...base,days:z.number().int().min(28).max(31).default(30),
 /** Weekday (0-6) of the 1st, in the order of `weekdays`. */ firstDay:z.number().int().min(0).max(6).default(2),
 weekdays:z.array(z.string().max(4)).length(7).optional(),events:z.array(z.object({day:z.number().int().min(1).max(31),label:z.string().min(1).max(40)}).strict()).max(4).default([]),
 highlight:z.number().int().min(1).max(31).optional()}).strict();
const map=z.object({kind:z.literal('map'),layout,...base,pins:z.array(z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),label:z.string().max(30).optional()}).strict()).min(1).max(5),
 route:z.boolean().default(false)}).strict();
const side=z.object({label:z.string().min(1).max(30),asset:z.string().optional(),points:z.array(z.string().min(1).max(60)).max(4).default([])}).strict();
const compare=z.object({kind:z.literal('compare'),layout,before:side,after:side}).strict();
const form=z.object({kind:z.literal('form'),layout,...base,fields:z.array(z.object({label,value:z.string().min(1).max(60)}).strict()).min(1).max(4),button:z.string().min(1).max(30),
 done:z.string().max(40).optional()}).strict();
const download=z.object({kind:z.literal('download'),layout,buttons:z.array(z.object({label:z.string().min(1).max(24),sub:z.string().max(30).optional()}).strict()).min(1).max(3),
 rating:z.number().min(0).max(5).optional(),caption:z.string().max(60).optional()}).strict();
// A composed piece: the agent designs a new visual from layers when no ready-made piece fits.
export const icons=['check','star','heart','bolt','bell','user','users','lock','chart','cart','mail','clock','pin','play','plus','arrow','sparkle','shield','globe','chat','calendar','camera','gift','rocket','search','settings','phone','card','leaf','fire','home','cloud','code','music','trophy','sun','battery','car','money','water','heartbeat','book','briefcase','truck','target'] as const;
const colorRef=z.union([z.enum(['primary','accent','text','muted','surface','background','white','black']),hex]);
const unit01=z.number().min(-.2).max(1.2);
export const layerSchema=z.object({
 type:z.enum(['card','text','number','shape','icon','bar','line','image','avatar']),
 x:unit01.default(0),y:unit01.default(0),w:z.number().min(.01).max(1.4).optional(),h:z.number().min(.01).max(1.4).optional(),
 text:z.string().max(160).optional(),value:z.number().optional(),from:z.number().default(0),prefix:z.string().max(4).optional(),suffix:z.string().max(8).optional(),decimals:z.number().int().min(0).max(2).default(0),
 shape:z.enum(['rect','circle','pill','ring','blob']).default('rect'),icon:z.enum(icons).optional(),color:colorRef.optional(),fill:colorRef.optional(),
 size:z.number().min(1).max(40).default(5),weight:z.number().int().min(100).max(900).default(700),align:z.enum(['start','center','end']).default('start'),
 asset:z.string().optional(),points:z.array(z.object({x:unit01,y:unit01}).strict()).min(2).max(24).optional(),progress:z.number().min(0).max(1).default(1),
 level:z.number().min(0).max(2).default(1),rotate:z.number().min(-45).max(45).default(0),opacity:z.number().min(0).max(1).default(1),
 in:z.object({at:z.number().min(0).max(10).default(0),dur:z.number().min(.05).max(4).default(.5),
  from:z.enum(['fade','up','down','left','right','scale','pop','draw','type','count','grow','spin','none']).default('up'),
  sound:z.enum(['none','whoosh','click','tick','pop','success','impact']).optional()}).strict().default({at:0,dur:.5,from:'up'}),
 loop:z.object({kind:z.enum(['float','pulse','spin','sway','blink']),amount:z.number().min(0).max(1).default(.3),speed:z.number().min(.1).max(4).default(1)}).strict().optional(),
}).strict();
export type Layer=z.infer<typeof layerSchema>;
const compose=z.object({kind:z.literal('compose'),name:z.string().max(40).optional(),
 /** Saved composed piece to use (assets/pieces/NAME.json) and its words or numbers. */
 template:z.string().regex(/^[a-z0-9-]{2,40}$/).optional(),vars:z.record(z.string(),z.union([z.string().max(160),z.number()])).optional(),
 layers:z.array(layerSchema).max(28).default([]),length:z.number().min(.5).max(10).optional(),
 /** A piece designed for this video (piece-designer.ts): its template form, saved for reuse when the video is approved. */
 designed:z.object({name:z.string().regex(/^[a-z0-9-]{2,40}$/),description:z.string().max(400),tags:z.array(z.string().max(30)).max(20),vars:z.record(z.string(),z.union([z.string(),z.number()])),layers:z.array(z.unknown()).max(28)}).strict().optional()}).strict();
export const contentSchema=z.discriminatedUnion('kind',[dashboard,tasks,chartPiece,counter,progress,notifications,checklist,chat,avatars,image,pricing,quote,logos,calendar,map,compare,form,download,compose]);
export type PieceContent=z.infer<typeof contentSchema>;

export const pieceKinds=['phone','browser','dashboard','tasks','chart','counter','progress','notifications','checklist','chat','avatars','image','pricing','quote','logos','calendar','map','compare','form','download','compose'] as const;
export const transitions=['none','fade','wipe','push','zoom-through','mask-reveal','circle-reveal'] as const;
const common={
 cursor:cursorSchema.optional(),
 /** Where the visual sits; the sentence goes in the space left. */
 placement:z.enum(['center','top','bottom']).default('center'),
 /** Share of the frame height the visual uses. */
 size:z.number().min(.3).max(.75).default(.56),
 /** How the scene comes in. */
 transition:z.enum(transitions).default('wipe'),
 /** Seconds into the scene when the visual starts animating. */
 delay:z.number().min(0).max(3).default(.15),
 /** Layout direction: auto follows the scene's language (right-to-left for Kurdish, Arabic,
  *  Persian, Urdu...); ltr or rtl forces it, e.g. an English app shown in a Kurdish video. */
 direction:z.enum(['auto','ltr','rtl']).default('auto'),
 /** This piece's own design style; normally every piece follows the video's style. */
 style:styleId.optional(),
};
const phone=z.object({kind:z.literal('phone'),screen:contentSchema,app:z.string().max(30).optional(),tilt:z.number().min(-20).max(20).default(0)}).strict();
const browser=z.object({kind:z.literal('browser'),screen:contentSchema,url:z.string().max(60).optional()}).strict();
export const pieceSchema=z.discriminatedUnion('kind',[phone.extend(common),browser.extend(common),dashboard.extend(common),tasks.extend(common),chartPiece.extend(common),
 counter.extend(common),progress.extend(common),notifications.extend(common),checklist.extend(common),chat.extend(common),avatars.extend(common),image.extend(common),
 pricing.extend(common),quote.extend(common),logos.extend(common),calendar.extend(common),map.extend(common),compare.extend(common),form.extend(common),download.extend(common),compose.extend(common)]).superRefine((p,c)=>{
 const inner=p.kind==='phone'||p.kind==='browser'?p.screen:p;
 if(inner.kind==='compose'&&!inner.layers.length&&!inner.template)c.addIssue({code:'custom',message:'A composed piece needs layers or a template'});
});
export type Piece=z.infer<typeof pieceSchema>;
/** In a request: which planned scene (0-based) gets which piece. */
export const sceneVisualSchema=z.object({
 /** Planned scene index (0-based)... */
 scene:z.number().int().nonnegative().optional(),
 /** ...or words from the sentence the piece belongs to (case-insensitive; the first scene containing them). */
 match:z.string().min(2).optional(),
 piece:pieceSchema,
}).strict().refine(v=>(v.scene===undefined)!==(v.match===undefined),'Give exactly one of scene or match');
const norm=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/** The scene index a visual belongs to, or an error that names the scenes. */
export function sceneIndexFor(v:{scene?:number;match?:string},scenes:{text:string}[]){
 if(v.scene!==undefined){if(!scenes[v.scene])throw new Error(`sceneVisuals: there is no scene ${v.scene} (the plan has ${scenes.length} scenes, numbered from 0)`);return v.scene;}
 const want=norm(v.match!);const i=scenes.findIndex(s=>norm(s.text).includes(want));
 if(i<0)throw new Error(`sceneVisuals: no scene contains "${v.match}". Scenes: ${scenes.map((s,n)=>n+': '+s.text.slice(0,60)).join(' | ')}`);
 return i;
}
