import {assertAcousticAlignment} from './acoustic-alignment.js';
import {sceneScoreFrames} from './reference-motion-schema.js';
import {retimeSpeechEvents,assertSpeechEvents} from './speech-events.js';
import {z} from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {words} from './rtl-layout.js';
import {dir} from './project.js';
import type {Project} from './schema.js';

export const voiceAlignmentSchema=z.object({
 audioSha256:z.string().regex(/^[a-f0-9]{64}$/i),
 method:z.enum(['provider','forced-aligner','manual-review']),
 source:z.string().min(1),
 reviewed:z.literal(true),
 words:z.array(z.object({text:z.string().min(1),start:z.number().nonnegative(),end:z.number().positive()})).min(1)
});
export type VoiceAlignment=z.infer<typeof voiceAlignmentSchema>;
export function validateWordAlignment(script:string,input:unknown,duration:number){
 if(!Number.isFinite(duration)||duration<=0)throw new Error('Invalid probed voice duration');
 const data=voiceAlignmentSchema.parse(input),tokens=words(script);
 if(tokens.length!==data.words.length)throw new Error('Alignment must cover every complete script word; do not interpolate missing timestamps.');
 let end=0;
 data.words.forEach((cue,i)=>{
  if(cue.text!==tokens[i].text)throw new Error('Aligned word differs from exact script at word '+(i+1));
  if(cue.start<end-.00001||cue.end<=cue.start||cue.end>duration+.001)throw new Error('Invalid, overlapping or out-of-range speech timestamps');
  end=cue.end;
 });
 return data;
}
export async function audioHash(p:Project){
 const voices=p.media.filter(m=>m.kind==='voice');
 if(voices.length!==1||voices[0].at!==0)throw new Error('Exact alignment currently requires one voiceover starting at zero.');
 return createHash('sha256').update(await fs.readFile(path.join(dir(p.id,p.config),voices[0].path))).digest('hex');
}
export async function applyWordAlignment(p:Project,input:unknown){
 const voice=p.media.find(m=>m.kind==='voice');
 const duration=Number(voice?.metadata?.format?.duration);
 if(!Number.isFinite(duration)||duration<=0)throw new Error('Missing probed voice duration');
 const data=validateWordAlignment(p.script,input,duration);
 if(data.audioSha256.toLowerCase()!==await audioHash(p))throw new Error('Alignment belongs to a different audio file.');
 const tokens=words(p.script);let offset=0;
 const groups=p.scenes.map(s=>{
  const cues=data.words.flatMap((cue,i)=>tokens[i].start>=offset&&tokens[i].end<=offset+s.text.length?[{...cue,from:tokens[i].start-offset,to:tokens[i].end-offset}]:[]);
  offset+=s.text.length;
  if(!cues.length)throw new Error('Each aligned scene needs at least one spoken word');
  return cues;
 });
 if(offset!==p.script.length||p.scenes.map(s=>s.text).join('')!==p.script)throw new Error('Scene/script mismatch');
 const tail=Math.ceil(duration*p.config.fps)/p.config.fps;
 p.scenes.forEach((scene,i)=>{
  scene.start=i===0?0:groups[i][0].start;
  const next=i===p.scenes.length-1?tail:groups[i+1][0].start;
  scene.duration=next-scene.start;
  if(scene.referenceMotion?.scoreFrames)scene.referenceMotion.scoreFrames=sceneScoreFrames(scene.start,next,p.config.fps);
  scene.wordCues=groups[i].map(c=>({from:c.from,to:c.to,start:c.start-scene.start,end:c.end-scene.start}));
  // Full-word speech following works for both cumulative and centered layouts.
  scene.animation=scene.animation==='center-word-swap'?'center-word-swap':'word-slide-up';
 });
 p.alignmentEvidence={audioSha256:data.audioSha256.toLowerCase(),method:data.method,source:data.source,reviewed:true};
 p.config.voiceTiming='required';p.config.textTreatment='kinetic';
 retimeSpeechEvents(p);
}
export async function assertVoiceAlignment(p:Project){
 if(p.config.voiceTiming==='acoustic'){await assertAcousticAlignment(p);return;}
 if(p.config.voiceTiming!=='required'||!p.media.some(m=>m.kind==='voice')){if(p.speechAnchors?.length)throw new Error('Speech anchors require exact voice timing');return;}
 if(!p.alignmentEvidence?.reviewed)throw new Error('Exact voice sync is blocked: reviewed word timestamps are missing. Generate a draft preview or provide genuine alignment; do not substitute estimated timings.');
 if(p.config.textTreatment!=='kinetic'||p.scenes.some(s=>!['word-slide-up','center-word-swap'].includes(s.animation)))throw new Error('Exact sync requires kinetic word-slide-up or center-word-swap scenes');
 if(p.alignmentEvidence.audioSha256!==await audioHash(p))throw new Error('Voice changed after alignment');
 assertSpeechEvents(p);
 const cues=p.scenes.flatMap(s=>(s.wordCues||[]).map(c=>({text:s.text.slice(c.from,c.to),start:s.start+c.start,end:s.start+c.end})));
 validateWordAlignment(p.script,{...p.alignmentEvidence,words:cues},Number(p.media.find(m=>m.kind==='voice')!.metadata.format.duration));
 for(const scene of p.scenes){
  if(scene.wordCues?.some(c=>c.end>scene.duration+.001))throw new Error('Spoken word exceeds its scene');
 }
}

// Provider character timing is accepted only when it matches the exact script.
// This adapter does not derive timing from character counts or reading speed.
export function fromCharacterAlignment(script:string,input:unknown,metadata:Omit<VoiceAlignment,'words'>):VoiceAlignment{
 const schema=z.object({characters:z.array(z.string().min(1)),character_start_times_seconds:z.array(z.number().nonnegative()),character_end_times_seconds:z.array(z.number().nonnegative())});
 const a=schema.parse(input);
 if(a.characters.length!==a.character_start_times_seconds.length||a.characters.length!==a.character_end_times_seconds.length||a.characters.join('')!==script)throw new Error('Provider characters must match the exact script and timing arrays');
 let offset=0;const chars=a.characters.map((char,i)=>{const item={from:offset,to:offset+char.length,start:a.character_start_times_seconds[i],end:a.character_end_times_seconds[i]};offset+=char.length;return item;});
 for(let i=0;i<chars.length;i++)if(chars[i].end<chars[i].start||(i&&chars[i].start<chars[i-1].start))throw new Error('Nonmonotonic provider character timestamps');
 return {...metadata,words:words(script).map(w=>{const group=chars.filter(c=>c.from>=w.start&&c.to<=w.end);if(!group.length)throw new Error('Missing character timing');return {text:w.text,start:group[0].start,end:group.at(-1)!.end};})};
}
