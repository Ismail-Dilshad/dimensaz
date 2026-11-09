// Talking-head footage edited automatically from one file: pauses and fillers cut, punch-ins that
// alternate the framing (hiding the jump cuts), visuals designed from zero for the moments worth
// showing (a figure, a list, a change, a quotation, the call to action) laid over the speaker as
// the words are said, captions, and music under the voice. It is planned from the speech's word
// timings and written as an ordinary edit list (edl.ts), so every step can be reviewed or changed
// and run again with `pnpm dimensaz edit --edl`.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from '../engine/config.js';
import {mediaInfo,runEdl} from './editor.js';
import {planTighten,timeMap,tightenEdl} from './tighten.js';
import {captionsFromWords} from './caption-builder.js';
import type {Word} from '../engine/transcribe.js';
import type {Operation} from './edl.js';
import {detectLanguage,isRtl,type Language} from '../engine/languages.js';

export type AutoEditOptions={transcript?:string;language?:Language;visuals?:boolean;zooms?:boolean;captions?:boolean;music?:'auto'|'off';brand?:boolean;
 like?:string;maxPause?:number;plan?:boolean;out?:string;onStep?:(s:string)=>void};
type Sentence={text:string;start:number;end:number;words:{text:string;start:number;end:number}[]};

const exists=(f:string)=>fs.access(f).then(()=>true,()=>false);
async function free(dir:string){for(let i=1;;i++){const d=i===1?dir:`${dir}-${i}`;if(!await exists(d))return d;}}

/** Sentences of the kept speech, on the edited timeline. */
function sentences(words:Word[],map:(t:number)=>number|null,removed:(w:Word)=>boolean):Sentence[]{
 const out:Sentence[]=[];let cur:Sentence|null=null,lastEnd=-1;
 for(const w of words.filter(x=>x.type==='word'&&x.text.trim())){
  if(removed(w))continue;const s=map(w.start),e=map(w.end);if(s===null||e===null)continue;
  if(cur&&s-lastEnd>.9){out.push(cur);cur=null;}
  cur??={text:'',start:s,end:e,words:[]};cur.words.push({text:w.text.trim(),start:s,end:e});cur.text=cur.words.map(x=>x.text).join(' ');cur.end=e;lastEnd=e;
  if(/[.!?؟…]["'”»)]*$/u.test(w.text.trim())){out.push(cur);cur=null;}
 }
 if(cur)out.push(cur);return out;
}

/** Which sentences deserve a visual: a figure, a list, a change, a quotation or the call to action;
 *  spaced so the speaker stays the main picture (one visual per ~7 s at most). */
async function moments(list:Sentence[],total:number){
 const {numbersIn,listIn,classifyRole}=await import('../engine/storyboard.js');
 const scored=list.map((s,i)=>{const role=classifyRole(s.text,i,list.length);let score=0;
  if(numbersIn(s.text).length)score+=3;if(listIn(s.text).length>=2)score+=2;if(/\b(into|becomes?|from .+ to)\b|→/i.test(s.text))score+=2;
  if(/["“«]/.test(s.text))score+=1;if(role==='cta'&&i===list.length-1)score+=2;if(['problem','compare','map','calendar'].includes(role))score+=1;
  return {s,i,score:score/(1+Math.abs(s.end-s.start-3)/4)};}).filter(x=>x.score>0&&x.s.end-x.s.start>=1.4);
 const chosen:typeof scored=[];const max=Math.max(1,Math.floor(total/7));
 for(const x of scored.sort((a,b)=>b.score-a.score)){if(chosen.length>=max)break;if(chosen.every(c=>Math.abs(c.s.start-x.s.start)>=5.5))chosen.push(x);}
 return chosen.sort((a,b)=>a.s.start-b.s.start);
}

export async function autoEdit(file:string,o:AutoEditOptions={}){
 const step=o.onStep??(()=>{});
 const input=path.resolve(file);const info=await mediaInfo(input);
 if(!info.hasAudio)throw new Error('This video has no sound; an automatic edit follows the speech.');
 // 1. The speech, word by word (a saved transcript, or ElevenLabs speech-to-text).
 step('Reading the speech');
 let words:Word[],language:Language;
 if(o.transcript){const raw=JSON.parse(await fs.readFile(path.resolve(o.transcript),'utf8')) as Word[]|{words:Word[];language?:Language};words=Array.isArray(raw)?raw:raw.words;
  language=o.language??(!Array.isArray(raw)&&raw.language?raw.language:detectLanguage(words.map(w=>w.text).join(' ')));}
 else{const {transcribe}=await import('../engine/transcribe.js');const t=await transcribe(input,{language:o.language??'auto'});words=t.words;language=t.language;}
 const text=words.filter(w=>w.type==='word').map(w=>w.text).join(' ');
 // 2. Cut pauses and fillers.
 const tight=planTighten(words,info.duration,language,{maxPause:o.maxPause});
 // A word is gone when its middle falls inside a cut (fillers, and words trimmed with the pauses).
 const removed=(w:Word)=>{const m=(w.start+w.end)/2;return tight.cuts.some(c=>m>c.start&&m<c.end);};
 const map=timeMap(tight.cuts),total=tight.resultSeconds,list=sentences(words,map,removed);
 const name=path.basename(input,path.extname(input)).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,40)||'edit';
 const dir=await free(path.resolve(o.out??path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','edits',name)));await fs.mkdir(dir,{recursive:true});
 const seed=createHash('sha256').update(input+':'+text).digest('hex').slice(0,12);
 // Captions from the words that stay (fillers and anything inside a cut are left out).
 const kept=words.filter(w=>!removed(w));
 const caps=o.captions===false?undefined:{cues:captionsFromWords(kept,{script:undefined,language}).cues,language};
 const base=tightenEdl(input,tight.cuts,caps);
 const ops:Operation[]=base.operations.filter(x=>x.op==='cut');
 // Captions sit low and compact (two short lines), leaving the band above them for the visuals.
 const found=base.operations.find(x=>x.op==='captions');const captionOp=found&&found.op==='captions'?{...found,size:.036,margin:.07,maxWidth:.9}:undefined;
 const vertical=info.height>=info.width,plan:string[]=[];
 // 3. Visuals for the moments worth showing, designed from zero in a new style for this video.
 const picked=o.visuals===false?[]:await moments(list,total);
 if(picked.length){
  step(`Designing ${picked.length} visual${picked.length>1?'s':''} for what is said`);
  const {designStyle,styleKnowledge,usedGenomes,learnedTraits,rememberStyle}=await import('../engine/style-choice.js');
  const {brandProfile}=await import('../engine/brand.js');const b=(await brandProfile()).colors;
  const brand={primary:b.primary??'#4F46E5',accent:b.accent??'#F97316',surface:'#FFFFFF',background:b.background??'#F6F7FB',text:b.text??'#111827',muted:'#6B7280',radius:18};
  const look=o.like?await (await import('../engine/looks.js')).readLook(o.like):undefined;
  const style=designStyle({seed,brief:text,used:await usedGenomes(),knowledge:await styleKnowledge(text),learned:await learnedTraits(),brand,...(look?{like:{name:look.name,steer:look.steer,summary:look.summary}}:{})});
  await rememberStyle(style.genome.name,'edit-'+seed,style.genome);
  const {designScenes}=await import('../engine/storyboard.js');const {speechTimed}=await import('../components/pieces/timing.js');
  const plans=designScenes(picked.map(p=>p.s.text),{seed,genome:style.genome,learned:await learnedTraits()});
  // Over the speaker: the lower middle of a vertical frame (face above, captions below), the right side of a wide one.
  const geo=vertical?{w:.72,h:.3,x:.5,y:.58}:{w:.38,h:.58,x:.75,y:.44};
  const W=Math.round(info.width*geo.w/2)*2,H=Math.round(info.height*geo.h/2)*2;
  const clips=picked.map((p,k)=>{const start=Math.max(0,p.s.start-.15),duration=Math.min(5.5,Math.max(2.4,p.s.end-start+.5));
   // The visual's parts enter on their words (same timing as voiced motion videos).
   let at=0;const cues=p.s.words.map(w=>{const from=at;at+=w.text.length+1;return {from,to:from+w.text.length,start:Math.max(0,w.start-start),end:Math.max(.01,w.end-start)};});
   const piece=speechTimed({...plans[k]!.piece,placement:'center' as const,size:.75,transition:'none' as const},{text:p.s.words.map(w=>w.text).join(' '),duration,wordCues:cues});
   return {piece,duration,start,out:path.join(dir,'visuals',`visual-${String(k+1).padStart(2,'0')}.mov`),sentence:p.s.text,composition:plans[k]!.piece.designed?.archetype};});
  if(!o.plan){
   step('Rendering the visuals');
   const {renderPieceClips}=await import('../renderer/piece-clip.js');const {defaultFontPath}=await import('../engine/font-catalog.js');
   await renderPieceClips(clips,{theme:{...brand,genome:style.genome},width:W,height:H,fps:Math.min(30,Math.round(info.fps)||30),font:await defaultFontPath(language,text),dir:isRtl(language,text)?'rtl':'ltr'});
  }
  ops.push({op:'overlays',items:clips.map(c=>({file:c.out,start:Number(c.start.toFixed(3)),end:Number((c.start+c.duration).toFixed(3)),x:geo.x,y:geo.y,width:geo.w}))});
  plan.push(`Style: ${style.genome.name} (${style.why.join('; ')}).`,'',...clips.map((c,k)=>`- Visual ${k+1} at ${c.start.toFixed(1)} s (${c.duration.toFixed(1)} s, ${c.composition}): "${c.sentence}"`));
 }
 // 4. Punch-ins: alternate framings on sentences without a visual (hide the jump cuts).
 if(o.zooms!==false&&list.length>1){
  const scales=[1.12,1,1.2,1];const ranges=list.map((s,i)=>({s,i})).filter(({s})=>!picked.some(p=>p.s===s)).map(({s,i})=>({start:Number(s.start.toFixed(3)),end:Number((list[i+1]?.start??total).toFixed(3)),scale:scales[i%scales.length]!})).filter(r=>r.scale>1&&r.end>r.start);
  if(ranges.length){ops.splice(1,0,{op:'punch',ranges,focusX:.5,focusY:.38});plan.unshift(`Punch-ins: ${ranges.length} (alternating framing on sentences without a visual).`);}
 }
 if(captionOp)ops.push(captionOp);
 // 5. Music under the voice: a library track of the talk's mood, else an original score; ducked while speaking.
 if(o.music!=='off'){
  step('Choosing music');
  const {musicFor}=await import('../engine/music/library.js');
  const look=o.like?await (await import('../engine/looks.js')).readLook(o.like):undefined;
  const m=await musicFor({script:text,duration:total,seed,cuts:list.map(s=>s.start),underVoice:true,...(look?{mood:look.music.mood,bpm:look.music.bpm}:{}),out:path.join(dir,'music.m4a')});
  ops.push({op:'music',file:m.file,start:0,gainDb:-18,duck:true,duckDb:12,fadeIn:1,fadeOut:2,loop:false,offset:0});
  plan.push('',`Music: ${m.title} (${m.license})${m.credit?'; credit: '+m.credit:''}.`);
 }
 if(o.brand)ops.push({op:'brand',watermark:true,position:'top-right',width:.16,opacity:.85,margin:.05,logo:'primary',endCard:true,endCardDuration:2.5});
 ops.push({op:'loudness',target:-14,truePeak:-1.5,lra:11});
 const edl={version:1 as const,input,operations:ops,export:{preset:'social' as const}};
 await fs.writeFile(path.join(dir,'edit.json'),JSON.stringify(edl,null,1)+'\n');
 const summary=[`# Automatic edit: ${path.basename(input)}`,'',`Removed ${tight.removedSeconds.toFixed(1)} s of pauses and ${tight.fillerCount} fillers: ${info.duration.toFixed(1)} s → ${total.toFixed(1)} s.`,
  `Captions: ${captionOp?'yes':'no'} · Language: ${language} · Sentences: ${list.length}`,'',...plan,'','Change anything in edit.json, then: pnpm dimensaz edit --edl '+path.join(dir,'edit.json')].join('\n');
 await fs.writeFile(path.join(dir,'plan.md'),summary+'\n');
 if(o.plan)return {status:'planned' as const,dir,edl:path.join(dir,'edit.json'),plan:path.join(dir,'plan.md'),removedSeconds:tight.removedSeconds,visuals:picked.length};
 step('Editing the video');
 const r=await runEdl(edl,dir);
 return {status:'done' as const,dir,output:r.output,receipt:r.receipt,edl:path.join(dir,'edit.json'),plan:path.join(dir,'plan.md'),removedSeconds:tight.removedSeconds,visuals:picked.length,seconds:Number(r.info.duration.toFixed(2))};
}
