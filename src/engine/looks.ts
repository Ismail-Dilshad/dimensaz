// Looks learned from a video you like (a TikTok, a Reel, any link or file). The video is studied
// (downloaded for study only, never used in a video) with the reference measurements that
// already exist (media_tools style: brightness, colour roles, cut rhythm, motion energy and
// easing), and only numbers are kept. A look never copies: its colours are not used (your
// brand's are), and it only makes some style traits likelier and suggests the music's mood. Each
// video made "like" it is still generated new and must differ from every earlier style.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from './config.js';
import {runPythonModule} from './audio-analysis.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';
import type {Mood} from './music/compose.js';

export const lookName=z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/,'A look name uses lowercase letters, digits and dashes');
export const lookSchema=z.object({version:z.literal(1),name:lookName,
 source:z.object({url:z.string().optional(),file:z.string().optional(),title:z.string().optional(),creator:z.string().nullable().optional()}).strict(),
 measured:z.object({brightness:z.number().nullable(),backgroundSaturation:z.number().nullable(),backgroundHue:z.number().nullable(),accentHue:z.number().nullable(),
  energy:z.number().nullable(),burstsPerSecond:z.number().nullable(),easing:z.string().nullable(),averageShotSeconds:z.number().nullable(),cutsPerMinute:z.number().nullable()}).strict(),
 steer:z.record(z.string(),z.number()),music:z.object({mood:z.enum(['calm','warm','inspiring','upbeat','playful','energetic','dark']),bpm:z.number().optional()}).strict(),
 /** Headline size (×) and title weight, from the reference's text lines. */
 type:z.object({scale:z.number().min(.7).max(1.4),weight:z.enum(['heavy','regular','light']).nullable()}).strict().optional(),
 /** Where the visual sits (the text keeps the reference's side) and how much of the frame it fills. */
 layout:z.object({placement:z.enum(['center','top','bottom']),size:z.number().min(.3).max(.75)}).strict().optional(),
 /** Scene pacing for videos without a voice-over (a voice sets its own timing). */
 pacing:z.object({minSceneDuration:z.number().min(1.6).max(5),wordsPerSecond:z.number().min(2).max(3.4)}).strict().optional(),
 /** The reference's own colours, used only when you ask to copy them (--copy colors). */
 palette:z.object({background:z.string(),accent:z.string().optional(),text:z.string().optional()}).strict().optional(),
 extra:z.object({text:z.unknown().optional(),busy:z.number().nullable().optional(),audio:z.unknown().optional()}).strict().optional(),
 summary:z.array(z.string()),created:z.string()}).strict();
export type Look=z.infer<typeof lookSchema>;
export const looksDir=()=>process.env.TEMPOLOOM_LOOKS_DIR??path.join(ROOT,'assets','looks');

const hsl=(hex:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number];const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;
 let h=0;if(d){h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;}return {h,s:d?d/(1-Math.abs(2*l-1)):0,l,c:d};};

export type TextMeasure={linesPerFrame:number;lineHeight:number|null;headlineHeight:number|null;stroke:number|null;coverage:number;position:{top:number;center:number;bottom:number}};
export type AudioMeasure={bpm:number;confidence:number;onsetsPerSecond:number;lufs:number|null}|null;
type StyleItem={kind:string;durationSeconds?:number;brightness?:number|null;palette?:{roles?:Record<string,string>;colours?:{hex:string;share:number;saturation:number}[]};rhythm?:{averageShotSeconds?:number|null;cutsPerMinute?:number|null}|null;
 motion?:{energyMean?:number;burstsPerSecond?:number;dominantEasing?:string|null}};
/** What a measured reference means for a generated style: trait nudges, music mood, a summary. */
export function lookFromMeasurements(items:StyleItem[],name:string,source:Look['source'],more:{text?:TextMeasure;busy?:number|null;audio?:AudioMeasure}={}):Look{
 const v=items.find(i=>i.kind==='video')??items[0];if(!v)throw new Error('Nothing was measured');
 const roles={...(v.palette?.roles??{})};
 // The accent: the most vivid colour that still covers a visible part of the frame (not a second background shade).
 const vivid=(v.palette?.colours??[]).filter(c=>c.share>=.008&&c.hex!==roles.background).map(c=>({c,h:hsl(c.hex)})).filter(x=>x.h.c>=.35&&x.h.l>=.2&&x.h.l<=.85)
  .sort((a,b)=>b.h.c*b.c.share**.15-a.h.c*a.c.share**.15)[0];
 if(vivid)roles.accent=vivid.c.hex;else delete roles.accent;
 const bg=roles.background?hsl(roles.background):null,ac=roles.accent?hsl(roles.accent):null;
 const b=v.brightness??null,e=v.motion?.energyMean??null,shot=v.rhythm&&'averageShotSeconds' in v.rhythm?v.rhythm.averageShotSeconds??null:null,cpm=v.rhythm&&'cutsPerMinute' in v.rhythm?v.rhythm.cutsPerMinute??null:null;
 const steer:Record<string,number>={},sum:string[]=[];const add=(t:string,w:number)=>{steer[t]=Number(((steer[t]??1)*w).toFixed(2));};
 // Tone (from brightness and the background's colour; the colour itself is never used).
 if(b!==null){
  if(b<.28){add('tone-dark',8);add('shadow-glow',1.6);sum.push('dark frames');}
  else if(bg&&bg.c>.3&&b>.35){add(b>.6?'tone-tinted':'tone-brand',6);sum.push('a strongly coloured background');}
  else if(bg&&b>.7&&bg.l>.8&&bg.c>=.03&&bg.c<=.14&&bg.h>=20&&bg.h<=60){add('tone-paper',7);add('font-serif',1.6);sum.push('warm paper-like light frames');}
  else if(b>.7){add('tone-light',5);sum.push('light, clean frames');}
 }
 // Accent temperature (warm, yellow or cool), never the colour.
 if(ac){if(ac.h<45||ac.h>=330){add('accent-warm',2.5);sum.push('warm accents');}else if(ac.h<70){add('accent-yellow',2.5);sum.push('yellow accents');}else if(ac.h>=160&&ac.h<260){add('accent-cool',2.5);sum.push('cool accents');}}
 // Motion energy and cut rhythm.
 const fast=(e!==null&&e>=10)||(cpm!==null&&cpm>=40)||(shot!==null&&shot<1.4),lively=!fast&&((e!==null&&e>=5)||(cpm!==null&&cpm>=20));
 const calm=!fast&&!lively&&((e!==null&&e<2)||(shot!==null&&shot>4));
 if(fast){add('motion-snap',6);add('sound-punchy',2);add('case-upper',1.6);add('transition-none',3);add('transition-push',2);add('transition-zoom-through',2);sum.push('fast cuts and snappy motion');}
 else if(lively){add('motion-back',5);add('transition-push',1.6);add('transition-wipe',1.6);sum.push('lively, springy motion');}
 else if(calm){add('motion-smooth',6);add('sound-minimal',1.6);add('transition-fade',3);add('transition-mask-reveal',2);sum.push('calm, slow motion and long shots');}
 else if(e!==null){add('motion-cubic',4);sum.push('smooth, even motion');}
 const easing=v.motion?.dominantEasing??null;
 if(easing==='ease-in-out')add('motion-smooth',1.6);else if(easing==='ease-out')add('motion-cubic',1.4);else if(easing==='linear')add('motion-snap',1.4);
 const mood:Mood=fast?'energetic':b!==null&&b<.28?'dark':calm?'calm':lively?'upbeat':'warm';
 // Type: headline size against ours (a line box ≈ 0.04 of the frame) and stroke weight.
 const tx=more.text;let type:Look['type'];
 if(tx?.headlineHeight){const scale=Math.max(.8,Math.min(1.3,tx.headlineHeight/.0406));const sr=tx.stroke??null;
  const weight=sr===null?null:sr>=.19?'heavy':sr<=.095?'light':'regular';
  // (calibrated on known weights: light ≈.08–.10, regular ≈.11–.12, semibold ≈.13–.17, heavy ≥.22 of the line height)
  type={scale:Number(scale.toFixed(2)),weight};
  if(weight==='heavy'){add('weight-heavy',4);sum.push('heavy, bold type');}else if(weight==='light'){add('weight-light',4);sum.push('light type');}
  if(scale>=1.12)sum.push('big headlines');else if(scale<=.9)sum.push('small, quiet headlines');}
 // Layout: the visual goes opposite the text; a busy frame gets a bigger visual.
 let layout:Look['layout'];
 if(tx&&tx.coverage>0){const p=tx.position,busy=more.busy??null;
  const placement:NonNullable<Look['layout']>['placement']=p.bottom>.55?'top':'center';
  const size=busy===null?.56:busy>.06?.66:busy<.02?.48:.56;layout={placement,size};
  sum.push(placement==='top'?'text low in the frame':p.top>.55?'text high in the frame':'text in the middle');
  if(busy!==null)sum.push(busy>.06?'busy, full frames':busy<.02?'sparse, airy frames':'balanced frames');}
 // Pacing (only for videos without a voice-over): scenes as short or long as the reference's shots.
 let pacing:Look['pacing'];
 if(shot!==null){pacing={minSceneDuration:Number(Math.max(1.8,Math.min(4.5,shot*.95)).toFixed(2)),wordsPerSecond:shot<1.5?3:shot>4?2.2:2.5};}
 // Sound: the reference's music tempo, and how busy its sound effects are.
 const au=more.audio??null;let bpm:number|undefined;
 if(au){if(au.confidence>=.2&&au.lufs!==null&&au.lufs>-40)bpm=au.bpm;
  if(au.onsetsPerSecond>=4){add('sound-punchy',2.5);sum.push('busy, punchy sound');}else if(au.onsetsPerSecond<=1.2){add('sound-minimal',2.5);sum.push('sparse sound');}
  if(bpm)sum.push(`music around ${Math.round(bpm)} BPM`);}
 const palette=roles.background?{background:roles.background,...(roles.accent?{accent:roles.accent}:{}),...(roles.text?{text:roles.text}:{})}:undefined;
 return lookSchema.parse({version:1,name,source,measured:{brightness:b,backgroundSaturation:bg?Number(bg.s.toFixed(2)):null,backgroundHue:bg?Math.round(bg.h):null,accentHue:ac?Math.round(ac.h):null,
  energy:e,burstsPerSecond:v.motion?.burstsPerSecond??null,easing,averageShotSeconds:shot,cutsPerMinute:cpm},steer,music:{mood,...(bpm?{bpm}:{})},...(type?{type}:{}),...(layout?{layout}:{}),...(pacing?{pacing}:{}),...(palette?{palette}:{}),
  extra:{text:tx??null,busy:more.busy??null,audio:au},summary:sum.length?sum:['an even, neutral look'],created:new Date().toISOString()});
}

/** Hard cuts from FFmpeg's scene score: a frame that changes far more than the frames around it
 *  (so fast motion inside a shot is not counted). Cuts per minute and the average shot length. */
export async function cutRhythm(file:string,duration:number){
 const {spawn}=await import('node:child_process');
 const err=await new Promise<string>((resolve,reject)=>{const p=spawn(ffmpeg,['-hide_banner','-i',file,'-vf',"scale=160:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score",'-an','-f','null','-']);let e='';
  p.stderr.on('data',d=>e+=d);p.on('error',reject);p.on('close',()=>resolve(e));});
 const sc=[...err.matchAll(/scene_score=([\d.]+)/g)].map(m=>Number(m[1]));if(sc.length<10)return null;
 const fps=Number(err.match(/, ([\d.]+) fps/)?.[1]??30)||30;
 let cuts=0,last=-1e9;
 for(let i=1;i<sc.length;i++){const around=[...sc.slice(Math.max(0,i-4),i),...sc.slice(i+1,i+5)].sort((a,b)=>a-b),med=around[Math.floor(around.length/2)]??0;
  if(sc[i]!>=.15&&sc[i]!>=4*med+.05&&i-last>=fps*.25){cuts++;last=i;}}
 const dur=duration||sc.length/fps;
 return {cutsPerMinute:Number((cuts/dur*60).toFixed(2)),averageShotSeconds:Number((dur/(cuts+1)).toFixed(2))};
}
/** The reference's sound: music tempo, how many sound events a second, and loudness (null when silent). */
async function audioOf(file:string,tmp:string):Promise<AudioMeasure>{
 const wav=path.join(tmp,'audio.wav');
 try{await (await import('../renderer/ffmpeg-encoder.js')).run(ffmpeg,['-v','error','-y','-i',file,'-vn','-ac','1','-ar','22050','-t','120',wav]);}catch{return null;}
 const {analyzeMusic}=await import('./music/analyze.js');const {measureLoudness}=await import('./sound-quality.js');
 try{const a=await analyzeMusic(wav),l=await measureLoudness(wav);return {bpm:a.bpm,confidence:a.confidence,onsetsPerSecond:a.onsetsPerSecond,lufs:l.lufs};}catch{return null;}
}
const exists=(f:string)=>fs.access(f).then(()=>true,()=>false);
export async function listLooks():Promise<Look[]>{
 const files=(await fs.readdir(looksDir()).catch(()=>[] as string[])).filter(f=>f.endsWith('.json')).sort();
 return (await Promise.all(files.map(async f=>{try{return lookSchema.parse(JSON.parse(await fs.readFile(path.join(looksDir(),f),'utf8')));}catch{return null;}}))).filter((x):x is Look=>!!x);
}
export async function readLook(name:string):Promise<Look>{
 lookName.parse(name);
 try{return lookSchema.parse(JSON.parse(await fs.readFile(path.join(looksDir(),name+'.json'),'utf8')));}
 catch{throw new Error(`No look "${name}". Learn one with: pnpm tempoloom look learn URL --name ${name}. Saved: ${(await listLooks()).map(l=>l.name).join(', ')||'none'}`);}
}

/** Studies a link or a file and saves the look. A link is only downloaded with confirm (it reports
 *  the title, length and size first); the download stays a study-only reference. */
export async function learnLook(input:string,o:{name:string;confirm?:boolean;section?:string}){
 const name=lookName.parse(o.name);let file:string,source:Look['source'];
 if(/^https?:\/\//i.test(input)){
  const {referenceInfo,downloadReference}=await import('./sourcing/reference-video.js');
  const info=await referenceInfo(input);
  if(!o.confirm)return {status:'needs-confirmation' as const,info,next:`To study it, run again with --confirm (downloads about ${info.approxMB??'?'} MB for study only${o.section?'':'; --section 0-30 takes only part'}).`};
  const d=await downloadReference(input,{section:o.section});file=d.video;source={url:info.page,title:info.title,creator:info.creator};
 }else{file=path.resolve(input);await fs.access(file);source={file:path.basename(file)};}
 // Measure with the existing reference tool; its frames go to a temporary folder and are deleted.
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'dz-look-'));
 try{
  const r=await runPythonModule('media_tools.cli',['style',file,'--name','look','--out-dir',tmp],{label:'Look measurement',env:{FFMPEG_PATH:ffmpeg},timeoutMs:20*60*1000}) as {style:string};
  const style=JSON.parse(await fs.readFile(r.style,'utf8')) as {items:StyleItem[]};
  // The cut rhythm, measured here when the shot detector is not installed.
  for(const it of style.items)if(it.kind==='video'&&!(it.rhythm&&typeof it.rhythm.cutsPerMinute==='number'))it.rhythm=await cutRhythm(file,it.durationSeconds??0);
  const v=await runPythonModule('media_tools.cli',['look',file],{label:'Look text and layout',env:{FFMPEG_PATH:ffmpeg},timeoutMs:10*60*1000}).catch(()=>null) as {text?:TextMeasure;busy?:number}|null;
  const look=lookFromMeasurements(style.items,name,source,{text:v?.text,busy:v?.busy??null,audio:await audioOf(file,tmp)});
  await fs.mkdir(looksDir(),{recursive:true});let target=path.join(looksDir(),name+'.json'),k=2;
  while(await exists(target)){look.name=`${name}-${k}`;target=path.join(looksDir(),look.name+'.json');k++;}
  await fs.writeFile(target,JSON.stringify(look,null,1)+'\n',{flag:'wx'});
  return {status:'learned' as const,look,file:target};
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
}

/** The look's own colours as a piece theme, used only when the user asks to copy them. */
export function copiedTheme(l:Look){
 if(!l.palette)throw new Error(`The look "${l.name}" has no measured colours to copy`);
 const bg=l.palette.background,lumOf=(c:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));return (r!*299+g!*587+b!*114)/1000;};
 const dark=lumOf(bg)<110,mix=(a:string,b:string,t:number)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
 const text=l.palette.text??(dark?'#F5F5F5':'#111111'),accent=l.palette.accent??text;
 return {primary:accent,accent,background:bg,surface:mix(bg,dark?'#FFFFFF':'#FFFFFF',dark?.1:.65),text,muted:mix(text,bg,.4),radius:18,exact:true as const};
}
