import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {z} from 'zod';import {dir,inside} from './project.js';import {words} from './rtl-layout.js';import type {Project} from './schema.js';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const acousticSchema=z.object({script:z.string(),audioSha256:z.string(),duration:z.number().positive(),reviewed:z.boolean(),backend:z.object({name:z.literal('ctc-forced-alignment'),language:z.literal('ckb'),model:z.string(),revision:z.string(),textAgreement:z.number().min(.9)}),errors:z.array(z.unknown()).length(0),words:z.array(z.object({index:z.number().int(),text:z.string(),from:z.number().int(),to:z.number().int(),start:z.number().nonnegative(),end:z.number().positive(),confidence:z.number().min(.15).max(1),flags:z.array(z.string())}))});
export function validateAcousticCandidate(script:string,input:unknown,duration:number){
 const a=acousticSchema.parse(input),tokens=words(script);if(a.script!==script||a.words.length!==tokens.length||Math.abs(a.duration-duration)>.02)throw new Error('Acoustic analysis does not cover this exact script/audio duration');let end=0;
 for(const [i,w] of a.words.entries()){const t=tokens[i];if(w.index!==i||w.text!==t.text||w.from!==t.start||w.to!==t.end||w.start<end-1e-6||w.end<=w.start||w.end>duration+.001)throw new Error('Invalid acoustic word, offset or timing at '+i);if(w.flags.some(f=>!['very-short','low-acoustic-score'].includes(f)))throw new Error('Unresolved acoustic evidence at '+i+': '+w.flags.join(', '));end=w.end;}
 return a;
}
export function hasAcousticTiming(p:Project){return p.config.voiceTiming==='acoustic'&&p.acousticAlignment?.authorization==='user-authorized-automatic-alignment';}
export async function assertAcousticAlignment(p:Project){
 if(!hasAcousticTiming(p))throw new Error('Automatic acoustic export requires explicit authorization and bound analysis');const e=p.acousticAlignment!,base=dir(p.id,p.config),analysis=await fs.readFile(inside(base,e.analysisPath));if(sha(analysis)!==e.analysisSha256)throw new Error('Acoustic analysis changed after validation');
 const voices=p.media.filter(m=>m.kind==='voice');if(voices.length!==1||voices[0].at!==0)throw new Error('Acoustic mode requires one voice starting at zero');const hash=sha(await fs.readFile(inside(base,voices[0].path)));if(hash!==e.sourceAudioSha256)throw new Error('Voice changed after acoustic validation');
 const a=validateAcousticCandidate(p.script,JSON.parse(analysis.toString('utf8')),Number(voices[0].metadata.format.duration));if(a.audioSha256!==hash)throw new Error('Acoustic model analyzed a different recording');
 if(e.wordConfidence.length!==a.words.length||e.wordConfidence.some((v,i)=>v!==a.words[i].confidence))throw new Error('Acoustic confidence evidence changed');
 const cues=p.scenes.flatMap(s=>(s.wordCues??[]).map(c=>({text:s.text.slice(c.from,c.to),start:s.start+c.start,end:s.start+c.end})));if(cues.length!==a.words.length)throw new Error('Acoustic cue coverage mismatch');
 for(let i=0;i<cues.length;i++)if(cues[i].text!==a.words[i].text||Math.abs(cues[i].start-a.words[i].start)>1e-6||Math.abs(cues[i].end-a.words[i].end)>1e-6)throw new Error('Rendered cues differ from acoustic evidence at '+i);
 return {method:'CTC forced alignment',reviewed:false,coverage:a.words.length,textAgreement:a.backend.textAgreement,flaggedWords:a.words.filter(w=>w.flags.length||w.confidence<.65),note:'Acoustic estimates checked for integrity, script coverage and timing validity; no human listening review or perfect synchronization claim.'};
}
export async function authorizeAcousticAlignment(p:Project,analysisFile:string){
 const bytes=await fs.readFile(analysisFile),a=validateAcousticCandidate(p.script,JSON.parse(bytes.toString('utf8')),Number(p.media.find(m=>m.kind==='voice')?.metadata.format.duration));
 const target=path.join('input','acoustic-alignment-'+sha(bytes).slice(0,12)+'.json');await fs.writeFile(inside(dir(p.id,p.config),target),bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});p.config.voiceTiming='acoustic';p.acousticAlignment={analysisPath:target,wordConfidence:a.words.map(w=>w.confidence),analysisSha256:sha(bytes),sourceAudioSha256:a.audioSha256,authorization:'user-authorized-automatic-alignment',accuracy:'machine-aligned-not-human-reviewed'};return assertAcousticAlignment(p);
}
