// Trend watch: a short list of your topics; each check searches the channels Reach can read and
// sorts the newest top results into formats (lists, how-tos, myths, before and after, versus,
// "I tried", stories, reviews, question hooks, secrets, big numbers). A format that shows up in
// several results becomes a suggestion with its links. You accept it (it becomes a lesson on trial
// for the scriptwriter) or ignore it (it is not suggested again for that topic). Nothing is posted,
// liked or followed: Reach only reads.
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {settingsDir} from './models/settings.js';
import {add as addKnowledge} from './brain/brain.js';

export const FORMATS=[
 {id:'list',label:'Lists and countdowns',about:'"5 ways to", "top 10": one point per beat, numbered on screen.',re:/\b(top\s*\d+|\d+\s+(ways|tips|things|reasons|mistakes|tools|ideas|apps|steps|hacks|signs|rules))\b/i},
 {id:'howto',label:'How-to and tutorials',about:'Show the steps in order; the result first, then how.',re:/\bhow to\b|tutorial|step[- ]by[- ]step|\bguide\b|چۆن|كيف|آموزش/i},
 {id:'mistakes',label:'Mistakes and myths',about:'"Stop doing X": name the mistake, then the fix.',re:/mistakes?|myths?|stop doing|you'?re doing it wrong|never do|don'?t do/i},
 {id:'before-after',label:'Before and after',about:'The change in one cut: the "before" for a second, then the "after".',re:/before (and|&|vs\.?) after|transformation|glow[- ]?up/i},
 {id:'versus',label:'Comparisons',about:'X versus Y on the same points, with a verdict at the end.',re:/\bvs\.?\b|versus|compared|better than/i},
 {id:'tried',label:'"I tried it" experiments',about:'A test with a time frame and an honest result.',re:/\bi (tried|tested)|for (\d+|a|one|seven|30) (days?|weeks?|months?)\b|challenge/i},
 {id:'story',label:'Stories and a day in the life',about:'A personal story with a turn; the lesson at the end.',re:/story ?time|day in (the|my) life|how i\b|my journey/i},
 {id:'review',label:'Reviews and first looks',about:'An honest verdict early, then the proof.',re:/\breview\b|unbox|first look|worth it|honest/i},
 {id:'question',label:'Question hooks',about:'Open with the question the viewer already has.',re:/^(why|what|how|is|are|do|does|can|should|would)\b[^?]*\?|\?\s*$/i},
 {id:'secret',label:'Secrets and hidden features',about:'"Nobody tells you": one surprising, useful thing.',re:/secrets?|hidden|nobody tells|no one tells|you didn'?t know|\bhacks?\b/i},
 {id:'numbers',label:'Big-number results',about:'A striking figure in the hook, explained after.',re:/[$€£]\s?\d|\b\d+(\.\d+)?\s?(k|m|%)(?![a-z])|\b\d{3,}\b/i},
] as const;
export type FormatId=typeof FORMATS[number]['id'];

const store=z.object({version:z.literal(1).default(1),
 topics:z.array(z.object({topic:z.string(),added:z.string()})).default([]),
 checks:z.array(z.object({topic:z.string(),at:z.string(),total:z.number(),counts:z.record(z.string(),z.number()),problems:z.record(z.string(),z.string())})).default([]),
 suggestions:z.array(z.object({id:z.string(),topic:z.string(),format:z.string(),label:z.string(),about:z.string(),seen:z.number(),of:z.number(),rising:z.boolean(),
  examples:z.array(z.object({title:z.string(),url:z.string(),channel:z.string()})),at:z.string(),status:z.enum(['new','accepted','ignored']),lesson:z.string().optional()})).default([])});
type Store=z.infer<typeof store>;
const file=()=>path.join(settingsDir(),'trends.json');
export function read():Store{try{return store.parse(JSON.parse(fs.readFileSync(file(),'utf8')));}catch{return store.parse({});}}
function write(s:Store){fs.mkdirSync(settingsDir(),{recursive:true});s.checks=s.checks.slice(-200);fs.writeFileSync(file(),JSON.stringify(s,null,1)+'\n');return s;}
const slug=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,40)||'topic';

export function addTopic(topic:string){
 const t=topic.trim().replace(/\s+/g,' ');if(t.length<2||t.length>80)throw new Error('A topic is a few words, for example "coffee shop marketing"');
 const s=read();if(s.topics.some(x=>x.topic.toLowerCase()===t.toLowerCase()))throw new Error('That topic is already watched');
 if(s.topics.length>=12)throw new Error('Watch at most 12 topics; remove one first');
 s.topics.push({topic:t,added:new Date().toISOString()});write(s);return {topic:t};
}
export function removeTopic(topic:string){const s=read();const n=s.topics.length;s.topics=s.topics.filter(x=>x.topic.toLowerCase()!==topic.trim().toLowerCase());if(s.topics.length===n)throw new Error('No such topic');
 s.suggestions=s.suggestions.filter(x=>x.topic.toLowerCase()!==topic.trim().toLowerCase()||x.status==='accepted');write(s);return {removed:topic};}

export type Found={title:string|null;url:string|null;text:string|null};
export type Search=(channel:string,query:string,limit:number)=>Promise<{ok:boolean;items:Found[];error?:string}>;
/** Reach's own search, read-only. */
const reachSearch:Search=async(channel,query,limit)=>{const {run}=await import('../reach/manage.js');const r=await run(channel,'search',{query,limit});
 return {ok:r.ok,items:r.items.map(i=>({title:i.title,url:i.url,text:i.text})),...(r.error?{error:`${r.error.message}${r.error.hint?'. '+r.error.hint:''}`}:{})};};

/** What formats a set of results use. */
export function formatsOf(items:Found[]){
 const counts:Record<string,number>={};const examples:Record<string,{title:string;url:string}[]>={};
 for(const it of items){const t=`${it.title??''} ${it.text?.slice(0,200)??''}`;
  for(const f of FORMATS)if(f.re.test(it.title??'')||(f.id!=='question'&&f.re.test(t))){counts[f.id]=(counts[f.id]??0)+1;if(it.title&&it.url)(examples[f.id]??=[]).push({title:it.title.slice(0,140),url:it.url});}}
 return {counts,examples};
}

/** Checks every watched topic (or one) and brings back formats that several top results share. */
export async function check(o:{topic?:string;channels?:string[];limit?:number;search?:Search}={}){
 const s=read(),topics=o.topic?s.topics.filter(t=>t.topic.toLowerCase()===o.topic!.toLowerCase()):s.topics;
 if(!topics.length)throw new Error(o.topic?'That topic is not watched: add it first':'Add a topic to watch first');
 const channels=o.channels?.length?o.channels:['youtube','tiktok'],limit=o.limit??12,search=o.search??reachSearch,at=new Date().toISOString();
 const report:{topic:string;results:number;problems:Record<string,string>;new:number}[]=[];
 for(const {topic} of topics){
  const items:(Found&{channel:string})[]=[],problems:Record<string,string>={};
  for(const ch of channels){try{const r=await search(ch,topic,limit);if(r.ok)items.push(...r.items.filter(i=>i.title).map(i=>({...i,channel:ch})));else problems[ch]=r.error??'did not answer';}catch(e){problems[ch]=(e as Error).message;}}
  const {counts}=formatsOf(items),prev=[...s.checks].reverse().find(c=>c.topic===topic&&c.total>0);
  s.checks.push({topic,at,total:items.length,counts,problems});
  let fresh=0;
  for(const f of FORMATS){const n=counts[f.id]??0;if(!items.length||n<2||n/items.length<.15)continue;
   const id=`trend-${slug(topic)}-${f.id}`,old=s.suggestions.find(x=>x.id===id);if(old&&old.status!=='new')continue;
   const share=n/items.length,before=prev?(prev.counts[f.id]??0)/prev.total:null;
   const ex=items.filter(i=>f.re.test(i.title??'')).slice(0,4).map(i=>({title:i.title!.slice(0,140),url:i.url??'',channel:i.channel})).filter(e=>e.url);
   const sug={id,topic,format:f.id,label:f.label,about:f.about,seen:n,of:items.length,rising:before!==null&&share>before+.05,examples:ex,at,status:'new' as const};
   if(old)Object.assign(old,sug);else{s.suggestions.push(sug);fresh++;}
  }
  report.push({topic,results:items.length,problems,new:fresh});
 }
 write(s);return {checked:at,topics:report,suggestions:s.suggestions.filter(x=>x.status==='new').length};
}
/** You accept a format: it becomes a lesson on trial for the scriptwriter, with its links. */
export function accept(id:string){
 const s=read(),x=s.suggestions.find(y=>y.id===id);if(!x)throw new Error('No such suggestion');if(x.status==='accepted')throw new Error('Already accepted');
 const r=addKnowledge({id,title:`${x.label} work for "${x.topic}" right now`,body:`${x.about} Seen in ${x.seen} of ${x.of} recent top results for "${x.topic}"${x.rising?', more than at the last check':''}. Examples: ${x.examples.map(e=>`${e.title} (${e.url})`).join('; ')}.`,
  domain:'both',kind:'trend',tags:['trend','script','format',x.format,...x.topic.toLowerCase().split(/\s+/).slice(0,4)],source:x.examples[0]?.url??'trend-watch',status:'trial'});
 x.status='accepted';x.lesson=r.knowledge.id;write(s);return {accepted:x.label,lesson:r.knowledge.id};
}
export function ignore(id:string){const s=read(),x=s.suggestions.find(y=>y.id===id);if(!x)throw new Error('No such suggestion');x.status='ignored';write(s);return {ignored:x.label};}
export function overview(){
 const s=read();
 return {topics:s.topics.map(t=>{const last=[...s.checks].reverse().find(c=>c.topic===t.topic);return {...t,checked:last?.at??null,results:last?.total??null,problems:last?.problems??{}};}),
  suggestions:s.suggestions.filter(x=>x.status==='new').sort((a,b)=>Number(b.rising)-Number(a.rising)||b.seen/b.of-a.seen/a.of),
  accepted:s.suggestions.filter(x=>x.status==='accepted'),ignored:s.suggestions.filter(x=>x.status==='ignored').length,formats:FORMATS.map(f=>({id:f.id,label:f.label}))};
}
