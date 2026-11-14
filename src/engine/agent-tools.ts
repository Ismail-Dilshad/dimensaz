// One set of tools for every agent that drives the studio: the terminal agents call them over MCP
// (`pnpm tempoloom mcp`), and the browser studio's agents call the same functions. Each tool is a
// typed function over the studio, the brain and the free sources. Files are read only inside the
// project (never secrets) and written only inside the job's own folder.
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {ROOT} from './config.js';
import * as St from './studio.js';
import {say,FACES} from './studio-events.js';
import {recall} from './brain/brain.js';
import {providers,defaultProviders,providerFor} from './sourcing/providers.js';
import {kinds,type Kind} from './sourcing/core.js';

export type Tool={name:string;description:string;input:z.ZodObject<z.ZodRawShape>;run:(input:any)=>Promise<unknown>|unknown};
const job=z.string().regex(/^[a-z0-9][a-z0-9-]{0,60}$/).describe('The studio job name');
const task=z.string().regex(/^[a-z][a-z-]{1,30}$/).describe('The task id in the job');
const MAX_READ=200_000;
/** Paths an agent may never read: secrets, local state, dependencies, version control. */
const PRIVATE=/(^|[\\/])(\.env[^\\/]*|\.tempoloom|\.git|node_modules|\.ssh)([\\/]|$)/i;

/** A project file an agent may read: inside the project, not a secret, text, not too big. */
export function readable(file:string){
 const abs=path.resolve(ROOT,file),rel=path.relative(ROOT,abs);
 if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error('Only files inside the project can be read');
 if(PRIVATE.test(rel))throw new Error('That file is private and cannot be read by an agent');
 const st=fs.statSync(abs,{throwIfNoEntry:false});if(!st?.isFile())throw new Error('No such file: '+rel);
 // A link inside the project must not lead out of it, or to a private file.
 const real=path.relative(fs.realpathSync(ROOT),fs.realpathSync(abs));if(real.startsWith('..')||path.isAbsolute(real)||PRIVATE.test(real))throw new Error('That file is private and cannot be read by an agent');
 if(st.size>MAX_READ)throw new Error(`The file is ${Math.round(st.size/1024)} KB; agents read files up to ${MAX_READ/1000} KB`);
 const buf=fs.readFileSync(abs);if(buf.includes(0))throw new Error('Not a text file: '+rel);
 return {file:rel,text:buf.toString('utf8')};
}
/** A file inside the job's own folder, the only place an agent writes. */
export function writable(jobName:string,name:string){
 const dir=St.jobDir(jobName);St.readPlan(jobName);
 if(!/^[\w][\w .()-]{0,80}\.(md|txt|json|srt|vtt|csv|svg|html)$/i.test(name)||name.includes('..'))throw new Error('Write a text file by name only (letters, numbers, dots, dashes), ending .md, .txt, .json, .srt, .vtt, .csv, .svg or .html');
 return path.join(dir,name);
}

export const TOOLS:Tool[]=[
 {name:'studio_next',description:'What can be done now in a job: the ready tasks, and the approvals waiting for the user.',input:z.object({job}),run:i=>St.next(i.job)},
 {name:'studio_status',description:'Every task of a job, its owner and its state.',input:z.object({job}),run:i=>St.status(i.job)},
 {name:'studio_start',description:'Start a task: returns the role\'s playbook, the task\'s inputs, the lessons the brain has for this role, the user\'s taste and feedback, and where to write the output.',
  input:z.object({job,task}),run:i=>St.start(i.job,i.task)},
 {name:'studio_say',description:'One line for the user\'s Live studio page about what you are doing now, with a face for the mascot. Say it when the work changes.',
  input:z.object({job,task,text:z.string().min(3).max(300).describe('What you are doing, in one plain sentence'),face:z.enum(FACES).optional()}),
  run:i=>{const t=St.readPlan(i.job).tasks.find(x=>x.id===i.task);if(!t||t.gate)throw new Error(`No step "${i.task}" in ${i.job}`);const e=say(i.job,t.id,t.role!,i.text,i.face);return {said:e.text,face:e.face??null};}},
 {name:'studio_done',description:'Finish a task: its output file, the lesson ids it used (or ["none"]), what it learned, a note for the next role, files to show the user, or two versions to choose between.',
  input:z.object({job,task,output:z.string().optional().describe('The output file (the writeTo path from studio_start)'),applied:z.array(z.string()).optional(),learned:z.array(z.string()).optional(),
   note:z.string().max(300).optional(),show:z.array(z.string()).optional(),choices:z.array(z.string()).optional().describe('"A: NAME|SAMPLE_FILE|LESSON_ID,LESSON_ID", at least two'),anyway:z.boolean().optional()}),
  run:i=>St.done(i.job,i.task,{...(i.output?{output:i.output}:{}),...(i.applied?{applied:i.applied}:{}),...(i.learned?{learned:i.learned}:{}),...(i.note?{note:i.note}:{}),...(i.show?{show:i.show}:{}),...(i.choices?{choices:i.choices}:{}),...(i.anyway?{anyway:true}:{})})},
 {name:'studio_check',description:'Watch your own video before the user does: measures it against the user\'s taste and returns frame sheets to look at. Needed before finishing the preview step.',
  input:z.object({job,task,video:z.string(),accept:z.string().max(300).optional()}),run:i=>St.check(i.job,i.task,i.video,{...(i.accept?{accept:i.accept}:{})})},
 {name:'studio_prompt',description:'A complete brief of one task as plain text, for another AI to do it.',input:z.object({job,task}),run:i=>St.prompt(i.job,i.task)},
 {name:'read_file',description:'Read a text file of the project (a guide, a playbook, an earlier task\'s output). Secrets and local state cannot be read.',
  input:z.object({file:z.string().describe('Path relative to the project root, or an absolute path inside it')}),run:i=>readable(i.file)},
 {name:'write_job_file',description:'Write a text file into the job\'s own folder (a script, a plan, a storyboard). Returns its path for studio_done.',
  input:z.object({job,name:z.string().describe('File name only, for example style.md'),text:z.string().max(400_000)}),
  run:i=>{const f=writable(i.job,i.name);fs.writeFileSync(f,i.text);return {file:f,bytes:Buffer.byteLength(i.text)};}},
 {name:'brain_recall',description:'What the studio knows that fits a brief: the user\'s rules and preferences, proven techniques, and lessons on trial.',
  input:z.object({brief:z.string().min(3),limit:z.number().int().min(1).max(30).optional()}),run:i=>recall(i.brief,{limit:i.limit??12}).items.map(k=>({id:k.id,title:k.title,use:k.use,kind:k.kind,status:k.status,always:k.always}))},
 {name:'source_search',description:'Search free, licence-checked sources: images, video, icons, sounds, music, 3D models, textures. Every result carries its licence and whether it may appear in a final video.',
  input:z.object({query:z.string().min(2),kind:z.enum(kinds),provider:z.string().optional(),limit:z.number().int().min(1).max(20).optional()}),
  run:async i=>{const ids=i.provider?[providerFor(i.provider).id]:defaultProviders[i.kind as Kind];const out=[],skipped=[];
   for(const id of ids){const p=providers.find(x=>x.id===id)!;if(!p.kinds.includes(i.kind)){continue;}
    try{out.push(...(await p.search({query:i.query,kind:i.kind,limit:i.limit??8})).map(x=>({provider:x.provider,id:x.id,title:x.title,page:x.page,preview:x.preview,licence:x.license.name,usage:x.license.usage,credit:x.attribution})));}
    catch(e){skipped.push({provider:id,why:(e as Error).message});}}
   return {results:out.slice(0,(i.limit??8)*ids.length),...(skipped.length?{skipped}:{})};}},
];

/** A tool's input as JSON Schema, for MCP and for model providers. */
export const schemaOf=(t:Tool)=>{const s=z.toJSONSchema(t.input) as Record<string,unknown>;delete s.$schema;return s;};
export async function callTool(name:string,args:unknown){
 const t=TOOLS.find(x=>x.name===name);if(!t)throw new Error('No tool '+name);
 const input=t.input.safeParse(args??{});if(!input.success)throw new Error(`${name}: ${input.error.issues.map(x=>`${x.path.join('.')||'input'} ${x.message}`).join('; ')}`);
 return await t.run(input.data);
}
