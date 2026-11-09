// Edit decision list: a JSON description of footage edits, applied in order.
import {z} from 'zod';
import {languageInputSchema} from '../engine/languages.js';

const time=z.number().nonnegative();
const frac=z.number().min(0).max(1);
const range=z.object({start:time,end:time}).strict().refine(r=>r.end>r.start,'Range end must be after start');
const color=z.string().regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i,'Use a hex color like #FFFFFF');
const cue=z.object({start:time,end:time,text:z.string().min(1)}).strict().refine(c=>c.end>c.start,'Cue end must be after start');

export const aspectSizes={'9:16':[1080,1920],'16:9':[1920,1080],'1:1':[1080,1080],'4:5':[1080,1350]} as const;

export const operationSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('trim'),start:time.default(0),end:time.optional()}).strict(),
 z.object({op:z.literal('split'),at:z.array(time).min(1),keep:z.array(z.number().int().nonnegative()).min(1).optional()}).strict(),
 z.object({op:z.literal('cut'),ranges:z.array(range).min(1)}).strict(),
 z.object({op:z.literal('concat'),files:z.array(z.string().min(1)).min(1),position:z.enum(['after','before']).default('after')}).strict(),
 z.object({op:z.literal('crop'),x:z.number().nonnegative(),y:z.number().nonnegative(),width:z.number().positive(),height:z.number().positive()}).strict(),
 z.object({op:z.literal('reframe'),aspect:z.enum(['9:16','16:9','1:1','4:5']),focusX:frac.default(.5),focusY:frac.default(.5),width:z.number().int().positive().optional(),height:z.number().int().positive().optional()}).strict(),
 z.object({op:z.literal('zoom'),scale:z.number().min(1).max(4).default(1.15),start:time.default(0),end:time.optional(),ramp:z.number().min(0).max(2).default(0),focusX:frac.default(.5),focusY:frac.default(.4)}).strict(),
 z.object({op:z.literal('speed'),factor:z.number().min(.25).max(4)}).strict(),
 // Punch-ins: the frame jumps in (scale) for each range and back out after, all in one pass;
 // alternating framings hide jump cuts in talking-head footage.
 z.object({op:z.literal('punch'),ranges:z.array(z.object({start:time,end:time,scale:z.number().min(1).max(2)}).strict().refine(r=>r.end>r.start,'Range end must be after start')).min(1).max(200),
  focusX:frac.default(.5),focusY:frac.default(.38)}).strict(),
 // Brand layer from config/brand.json: logo watermark in a corner and an animated end card.
 z.object({op:z.literal('brand'),watermark:z.boolean().default(true),position:z.enum(['top-left','top-right','bottom-left','bottom-right']).default('top-right'),
  width:z.number().min(.05).max(.5).default(.16),opacity:frac.default(.85),margin:z.number().min(0).max(.2).default(.05),logo:z.enum(['primary','mark','onLight','onDark']).default('primary'),
  endCard:z.boolean().default(true),endCardDuration:z.number().min(1).max(6).default(2.5),endCardText:z.string().min(1).optional()}).strict()
  .refine(b=>b.watermark||b.endCard,'Enable watermark, endCard or both'),
 // Image or video (transparent .mov/.webm/.png welcome) placed over the footage. x/y are the
 // overlay's centre as fractions of the frame; width is a fraction of the frame width.
 z.object({op:z.literal('overlay'),file:z.string().min(1),start:time.default(0),end:time.optional(),x:frac.default(.5),y:frac.default(.5),
  width:z.number().min(.01).max(1).default(.3),opacity:frac.default(1),loop:z.boolean().default(false)}).strict()
  .refine(o=>o.end===undefined||o.end>o.start,'Overlay end must be after start'),
 // Background music under the footage; while someone speaks it is lowered automatically
 // (sidechain ducking against the footage's own sound), then comes back up in the gaps.
 z.object({op:z.literal('music'),file:z.string().min(1),start:time.default(0),end:time.optional(),gainDb:z.number().min(-40).max(6).default(-16),
  duck:z.boolean().default(true),duckDb:z.number().min(3).max(30).default(12),fadeIn:z.number().min(0).max(10).default(1),fadeOut:z.number().min(0).max(10).default(2),
  loop:z.boolean().default(true),offset:time.default(0)}).strict()
  .refine(m=>m.end===undefined||m.end>m.start,'Music end must be after start'),
 // Several images or videos over the footage in one pass (transparent .mov/.webm/.png welcome).
 z.object({op:z.literal('overlays'),items:z.array(z.object({file:z.string().min(1),start:time,end:time.optional(),x:frac.default(.5),y:frac.default(.5),width:z.number().min(.01).max(1).default(.3)}).strict()).min(1).max(40)}).strict(),
 z.object({op:z.literal('fade'),in:z.number().min(0).max(10).default(0),out:z.number().min(0).max(10).default(0)}).strict().refine(f=>f.in>0||f.out>0,'Set fade in or out'),
 z.object({op:z.literal('volume'),gainDb:z.number().min(-60).max(30)}).strict(),
 z.object({op:z.literal('loudness'),target:z.number().min(-40).max(-5).default(-14),truePeak:z.number().min(-9).max(0).default(-1.5),lra:z.number().min(1).max(20).default(11)}).strict(),
 z.object({op:z.literal('resize'),width:z.number().int().positive(),height:z.number().int().positive(),mode:z.enum(['pad','crop','stretch']).default('pad'),color:color.default('#000000')}).strict(),
 z.object({op:z.literal('captions'),srt:z.string().optional(),cues:z.array(cue).min(1).optional(),language:languageInputSchema.default('auto'),fontPreset:z.string().optional(),
  size:z.number().min(.02).max(.2).default(.055),color:color.default('#FFFFFF'),stroke:color.default('#000000'),strokeWidth:z.number().min(0).max(.4).default(.14),
  background:color.nullable().default(null),position:z.enum(['bottom','center','top']).default('bottom'),margin:frac.default(.16),maxWidth:z.number().min(.3).max(1).default(.86),weight:z.number().int().min(100).max(900).default(700)}).strict()
  .refine(c=>!!c.srt!==!!c.cues,'Give exactly one of srt or cues'),
]);
export type Operation=z.infer<typeof operationSchema>;
export type Cue=z.infer<typeof cue>;

export const exportPresets={
 social:{crf:18,preset:'medium',audioBitrate:'192k'},
 web:{crf:23,preset:'medium',audioBitrate:'128k'},
 archive:{crf:14,preset:'slow',audioBitrate:'320k'},
 draft:{crf:28,preset:'veryfast',audioBitrate:'96k'},
} as const;

export const edlSchema=z.object({
 version:z.literal(1),
 input:z.string().min(1),
 output:z.string().optional(),
 operations:z.array(operationSchema).default([]),
 export:z.object({preset:z.enum(['social','web','archive','draft']).default('social')}).strict().default({preset:'social'}),
}).strict();
export type Edl=z.infer<typeof edlSchema>;
