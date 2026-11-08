// Animated scene pieces: ready-made, brand-coloured visuals that show what a sentence says
// (UI mockups, dashboards, task cards flying to avatars, charts, counters, notifications,
// chats, checklists, cursors) plus designed transitions. A scene's text stays on screen as
// the headline; the piece is the visual. Everything is deterministic in time.
import {z} from 'zod';

const hex=z.string().regex(/^#[0-9a-f]{6}$/i);
const label=z.string().min(1).max(80);
const short=z.string().min(1).max(160);

export const pieceThemeSchema=z.object({primary:hex,accent:hex,surface:hex,background:hex,text:hex,muted:hex,radius:z.number().min(0).max(48).default(20)}).strict();
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
const dashboard=z.object({kind:z.literal('dashboard'),...base,stats:z.array(stat).min(1).max(4),chart:chart.optional()}).strict();
const tasks=z.object({kind:z.literal('tasks'),...base,tasks:z.array(z.object({title:short,assignee:z.string().max(40).optional(),tag:z.string().max(16).optional()}).strict()).min(1).max(6),
 people:z.array(person).max(5).default([]),flow:z.enum(['assign','complete','appear']).default('assign')}).strict();
const chartPiece=z.object({kind:z.literal('chart'),...base,...chart.shape}).strict();
const counter=z.object({kind:z.literal('counter'),...base,from:z.number().default(0),to:z.number(),prefix:z.string().max(4).optional(),suffix:z.string().max(6).optional(),decimals:z.number().int().min(0).max(2).default(0),caption:z.string().max(60).optional()}).strict();
const progress=z.object({kind:z.literal('progress'),...base,items:z.array(z.object({label,value:z.number().min(0).max(100)}).strict()).min(1).max(5)}).strict();
const notifications=z.object({kind:z.literal('notifications'),...base,items:z.array(z.object({app:label,title:short,body:z.string().max(160).optional()}).strict()).min(1).max(4)}).strict();
const checklist=z.object({kind:z.literal('checklist'),...base,items:z.array(short).min(1).max(6)}).strict();
const chat=z.object({kind:z.literal('chat'),...base,messages:z.array(z.object({from:z.enum(['me','them']),text:short,name:z.string().max(30).optional()}).strict()).min(1).max(6)}).strict();
const avatars=z.object({kind:z.literal('avatars'),...base,people:z.array(person).min(1).max(6),caption:z.string().max(60).optional()}).strict();
const image=z.object({kind:z.literal('image'),...base,asset:z.string().min(1),fit:z.enum(['cover','contain']).default('cover')}).strict();
export const contentSchema=z.discriminatedUnion('kind',[dashboard,tasks,chartPiece,counter,progress,notifications,checklist,chat,avatars,image]);
export type PieceContent=z.infer<typeof contentSchema>;

export const pieceKinds=['phone','browser','dashboard','tasks','chart','counter','progress','notifications','checklist','chat','avatars','image'] as const;
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
};
const phone=z.object({kind:z.literal('phone'),screen:contentSchema,app:z.string().max(30).optional(),tilt:z.number().min(-20).max(20).default(0)}).strict();
const browser=z.object({kind:z.literal('browser'),screen:contentSchema,url:z.string().max(60).optional()}).strict();
export const pieceSchema=z.discriminatedUnion('kind',[phone.extend(common),browser.extend(common),dashboard.extend(common),tasks.extend(common),chartPiece.extend(common),
 counter.extend(common),progress.extend(common),notifications.extend(common),checklist.extend(common),chat.extend(common),avatars.extend(common),image.extend(common)]);
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
