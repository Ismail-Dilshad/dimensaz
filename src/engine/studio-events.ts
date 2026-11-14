// What happens in a studio job, as it happens: every step started, finished, rated or approved, and
// what an agent says it is doing, is one line in the job's events.jsonl. The Live studio page reads
// it (and streams it), whoever is driving the job: the terminal agent or the browser.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './config.js';

/** The mascot's faces (assets/brand/expressions/svg/mascot-FACE.svg). */
export const FACES=['idle','listening','thinking','planning','creating','rendering','done','excited','confused','error','needs-approval','sleeping'] as const;
export type Face=typeof FACES[number];
export type EventType='job.planned'|'step.started'|'step.done'|'step.rated'|'step.picked'|'step.checked'|'step.held'|'step.reopened'|'gate.approved'|'feedback'|'verdict'|'agent.say'|'tool'|'asset';
export type StudioEvent={seq:number;at:string;type:EventType;task?:string;role?:string;face?:Face;text?:string;data?:Record<string,unknown>};

/** The face each role shows while it works on a step, until it says otherwise. */
export const WORKING_FACE:Record<string,Face>={director:'planning',researcher:'listening',scriptwriter:'planning',style:'creating',scenes:'planning',sound:'creating',voice:'creating',
 'motion-lead':'planning','editing-lead':'planning',producer:'rendering',analyst:'listening',cutter:'rendering',finisher:'rendering',reviewer:'thinking'};

const root=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','studio');
const file=(job:string)=>{if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(job))throw new Error('Not a studio job name: '+job);return path.join(root(),job,'events.jsonl');};
const MAX_TEXT=400;

/** Adds one event to a job. Never throws: a job must not fail because its log could not be written. */
export function emit(job:string,e:Omit<StudioEvent,'seq'|'at'>):StudioEvent|null{
 try{
  const f=file(job);if(!fs.existsSync(path.dirname(f)))return null;
  const seq=count(f)+1;
  const ev:StudioEvent={seq,at:new Date().toISOString(),type:e.type,...(e.task?{task:e.task}:{}),...(e.role?{role:e.role}:{}),...(e.face?{face:e.face}:{}),
   ...(e.text?{text:e.text.replace(/\s+/g,' ').trim().slice(0,MAX_TEXT)}:{}),...(e.data?{data:e.data}:{})};
  fs.appendFileSync(f,JSON.stringify(ev)+'\n');
  return ev;
 }catch{return null;}
}
const counts=new Map<string,{size:number;n:number}>();
function count(f:string){
 let size=0;try{size=fs.statSync(f).size;}catch{return 0;}
 const c=counts.get(f);if(c&&c.size===size)return c.n;
 const n=fs.readFileSync(f,'utf8').split('\n').filter(Boolean).length;counts.set(f,{size,n});return n;
}
/** The job's events after a sequence number (all of them by default), oldest first. */
export function events(job:string,after=0,limit=500):StudioEvent[]{
 let text='';try{text=fs.readFileSync(file(job),'utf8');}catch{return [];}
 const out:StudioEvent[]=[];
 for(const line of text.split('\n')){if(!line)continue;try{const e=JSON.parse(line) as StudioEvent;if(e.seq>after)out.push(e);}catch{/* a half-written line */}}
 return out.slice(-limit);
}
export const eventsFile=file;

/** What an agent working on a step says it is doing, from the terminal or the browser. */
export function say(job:string,task:string,role:string,text:string,face?:string){
 if(face&&!(FACES as readonly string[]).includes(face))throw new Error(`Unknown face "${face}". Faces: ${FACES.join(', ')}`);
 if(!text.trim())throw new Error('Say what you are doing, in one line');
 const ev=emit(job,{type:'agent.say',task,role,text,...(face?{face:face as Face}:{})});
 if(!ev)throw new Error(`No studio job "${job}"`);
 return ev;
}
