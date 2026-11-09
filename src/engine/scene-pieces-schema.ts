// Scene pieces: the visual of a scene, designed from zero for each video from layers (cards,
// text, numbers, shapes, icons, bars, lines, images, avatars), each with its own entrance,
// loop and sound. There are no ready-made pieces: the designer (engine/piece-designer.ts)
// composes one from what the sentence says, or the agent writes the layers itself. A scene's
// text stays on screen as the headline; the piece is the visual. Deterministic in time.
import {z} from 'zod';
import {genomeSchema} from '../components/pieces/genome.js';

const hex=z.string().regex(/^#[0-9a-f]{6}$/i);

export const pieceThemeSchema=z.object({primary:hex,accent:hex,surface:hex,background:hex,text:hex,muted:hex,radius:z.number().min(0).max(48).default(20),
 /** The video's own design style, generated from zero (components/pieces/genome.ts). */
 genome:genomeSchema.optional(),
 /** Use these colours exactly (copied from a learned look on request) instead of the style's own mix of them. */
 exact:z.boolean().optional()}).strict();
export type PieceTheme=z.infer<typeof pieceThemeSchema>;

/** A point inside the piece: 0..1 of its width and height. */
const point=z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).strict();
export const cursorSchema=z.object({
 /** Where the cursor goes and when (seconds into the scene); it clicks on every step with click:true. */
 path:z.array(point.extend({at:z.number().min(0),click:z.boolean().default(false)}).strict()).min(1).max(12),
 style:z.enum(['arrow','hand']).default('arrow'),
}).strict();

export const icons=['check','star','heart','bolt','bell','user','users','lock','chart','cart','mail','clock','pin','play','plus','arrow','sparkle','shield','globe','chat','calendar','camera','gift','rocket','search','settings','phone','card','leaf','fire','home','cloud','code','music','trophy','sun','battery','car','money','water','heartbeat','book','briefcase','truck','target','x','quote','alert'] as const;
const colorRef=z.union([z.enum(['primary','accent','text','muted','surface','background','white','black']),hex]);
const unit01=z.number().min(-.2).max(1.2);
export const layerSchema=z.object({
 type:z.enum(['card','text','number','shape','icon','bar','line','image','avatar']),
 x:unit01.default(0),y:unit01.default(0),w:z.number().min(.01).max(1.4).optional(),h:z.number().min(.01).max(1.4).optional(),
 text:z.string().max(160).optional(),value:z.number().optional(),from:z.number().default(0),prefix:z.string().max(4).optional(),suffix:z.string().max(8).optional(),decimals:z.number().int().min(0).max(2).default(0),
 shape:z.enum(['rect','circle','pill','ring','blob']).default('rect'),icon:z.enum(icons).optional(),color:colorRef.optional(),fill:colorRef.optional(),
 size:z.number().min(1).max(40).default(5),weight:z.number().int().min(100).max(900).default(700),align:z.enum(['start','center','end']).default('start'),
 asset:z.string().optional(),points:z.array(z.object({x:unit01,y:unit01}).strict()).min(2).max(24).optional(),progress:z.number().min(0).max(1).default(1),
 /** The sentence's words this layer stands for: with a voice-over it enters when they are spoken. */
 says:z.string().max(160).optional(),
 level:z.number().min(0).max(2).default(1),rotate:z.number().min(-45).max(45).default(0),opacity:z.number().min(0).max(1).default(1),
 in:z.object({at:z.number().min(0).max(10).default(0),dur:z.number().min(.05).max(4).default(.5),
  from:z.enum(['fade','up','down','left','right','scale','pop','draw','type','count','grow','spin','none']).default('up'),
  sound:z.enum(['none','whoosh','click','tick','pop','success','impact']).optional()}).strict().default({at:0,dur:.5,from:'up'}),
 loop:z.object({kind:z.enum(['float','pulse','spin','sway','blink']),amount:z.number().min(0).max(1).default(.3),speed:z.number().min(.1).max(4).default(1)}).strict().optional(),
}).strict();
export type Layer=z.infer<typeof layerSchema>;
const compose=z.object({kind:z.literal('compose'),name:z.string().max(40).optional(),
 layers:z.array(layerSchema).min(1).max(28),length:z.number().min(.5).max(10).optional(),
 /** How the designer made it (piece-designer.ts): the brain scores each composition by verdicts. */
 designed:z.object({archetype:z.string().regex(/^[a-z][a-z-]{1,30}$/),description:z.string().max(400)}).strict().optional()}).strict();
export type ComposeContent=z.infer<typeof compose>;

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
};
export const pieceSchema=compose.extend(common);
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
