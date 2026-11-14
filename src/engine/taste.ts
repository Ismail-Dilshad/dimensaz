// The taste profile: one readable page of what the user likes, built from what they taught
// (patterns and lessons), their rules and their ratings, and edited by them. A profile can
// switch a line off, add its own lines, set its own targets, and be based on only some of the
// taught videos (a client, a brand). New videos start from it and are checked against it.
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {brainDir,allKnowledge,type Knowledge} from './brain/db.js';
import {confidence} from './brain/brain.js';
import {patterns,videos,metricValue,METRIC_INFO,TEACH_TOPICS,TOPIC_LABEL,type Topic} from './teach/teach.js';
import type {Measured} from './teach/measure.js';
import {change as record,touch,adapter} from './history.js';

export const METRIC_LABEL:Record<string,{label:string;low:string;high:string;role:string}>={
 'shot-length':{label:'Shot length',low:'Shots are shorter than you like: hold each one longer.',high:'Shots are longer than you like: cut more often.',role:'scenes'},
 'first-cut':{label:'First cut',low:'The first cut comes earlier than you like: hold the opening longer.',high:'The opening holds longer than you like: cut sooner.',role:'scenes'},
 'motion-energy':{label:'Motion energy',low:'It moves less than you like: add motion inside the shots.',high:'It is busier than you like: calm the motion.',role:'scenes'},
 'still-time':{label:'Still time',low:'It never rests: let the picture hold a little.',high:'The picture stands still too much: keep something moving.',role:'scenes'},
 brightness:{label:'Brightness',low:'Frames are darker than you like.',high:'Frames are brighter than you like.',role:'style'},
 saturation:{label:'Colour strength',low:'Colours are more muted than you like.',high:'Colours are more vivid than you like.',role:'style'},
 'cuts-on-beat':{label:'Cuts on the beat',low:'Fewer cuts land on the beat than you like: move cuts onto beats.',high:'More cuts land on the beat than in your examples (that is fine).',role:'sound'},
 tempo:{label:'Music tempo',low:'The music is slower than you like.',high:'The music is faster than you like.',role:'sound'},
 loudness:{label:'Loudness',low:'It is quieter than you like: raise the mix.',high:'It is louder than you like: lower the mix.',role:'sound'},
 detail:{label:'Frame detail',low:'Frames are emptier than you like.',high:'Frames are denser than you like: simplify.',role:'scenes'}};

/** The reasons a step can be rated bad for (the same words the Studio page offers). */
export const REASON_LABELS=['too slow','too fast','too busy','too empty','wrong colours','hard to read','boring, not enough motion','off-brand','wrong words','the sound is wrong','the captions are wrong','the cuts are wrong','too long'];
const id=z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/,'A profile name uses lowercase letters, digits and dashes');
const profileSchema=z.object({id,name:z.string().trim().min(1).max(60),
 /** Only these taught videos count for its patterns (null: all of them). */
 videos:z.array(z.string()).nullable().default(null),
 /** Lines switched off, by their reference (a knowledge id). */
 off:z.array(z.string()).default([]),
 added:z.array(z.object({id:z.string(),topic:z.string(),text:z.string().trim().min(8).max(400)}).strict()).default([]),
 /** The user's own targets, replacing or adding to the measured ones. */
 targets:z.record(z.string(),z.object({lo:z.number(),hi:z.number()}).strict().refine(t=>t.hi>=t.lo,'The upper value must not be below the lower one')).default({}),
 notes:z.string().max(2000).default('')}).strict();
export type Profile=z.infer<typeof profileSchema>;
const fileSchema=z.object({version:z.literal(1),profiles:z.array(profileSchema)}).strict();
export const tasteFile=()=>path.join(brainDir(),'taste.json');
const MAIN:Profile={id:'main',name:'My taste',videos:null,off:[],added:[],targets:{},notes:''};
function read():Profile[]{
 let list:Profile[]=[];try{list=fileSchema.parse(JSON.parse(fs.readFileSync(tasteFile(),'utf8'))).profiles;}catch{/* none yet */}
 // A copy: a change to the main profile must never change the starting one.
 return list.some(p=>p.id==='main')?list:[structuredClone(MAIN),...list];
}
function write(list:Profile[]){
 // The change history remembers each profile this write changes (Undo on the History page).
 let old:Profile[]=[];try{old=fileSchema.parse(JSON.parse(fs.readFileSync(tasteFile(),'utf8'))).profiles;}catch{/* none yet */}
 const was=new Map(old.map(p=>[p.id,p])),now=new Map(list.map(p=>[p.id,p]));
 for(const pid of new Set([...was.keys(),...now.keys()]))if(JSON.stringify(was.get(pid)??null)!==JSON.stringify(now.get(pid)??null))
  touch('profile',pid,()=>was.get(pid)??(pid==='main'?structuredClone(MAIN):null),(now.get(pid)??was.get(pid))!.name);
 writeFile(list);
}
function writeFile(list:Profile[]){fs.mkdirSync(brainDir(),{recursive:true});const tmp=tasteFile()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({version:1,profiles:list},null,1)+'\n');fs.renameSync(tmp,tasteFile());}
export const profiles=()=>read().map(p=>({id:p.id,name:p.name}));
export function profile(pid='main'):Profile{const p=read().find(x=>x.id===pid);if(!p)throw new Error(`No taste profile "${pid}". Profiles: ${read().map(x=>x.id).join(', ')}`);return p;}
const change=(pid:string,f:(p:Profile)=>void,what:string)=>{const list=read(),p=list.find(x=>x.id===pid);if(!p)throw new Error(`No taste profile "${pid}"`);
 record({kind:'taste',title:`${p.name}: ${what}`},()=>{f(p);write(list.map(x=>profileSchema.parse(x)));});return build(pid);};

export function create(name:string,o:{videos?:string[]|null}={}){return record({kind:'taste',title:`New taste profile: ${name.trim().slice(0,60)}`},()=>createNow(name,o));}
function createNow(name:string,o:{videos?:string[]|null}={}){
 const list=read(),pid=id.parse(name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'profile');
 if(list.some(p=>p.id===pid))throw new Error(`A profile called "${pid}" already exists`);
 const known=new Set(videos().map(v=>v.id)),vids=o.videos?.filter(v=>known.has(v))??null;
 write([...list,profileSchema.parse({id:pid,name:name.trim(),videos:vids&&vids.length?vids:null})]);return build(pid);
}
export function remove(pid:string){if(pid==='main')throw new Error('The main profile stays; switch its lines off instead');const list=read(),gone=list.find(p=>p.id===pid);if(!gone)throw new Error(`No taste profile "${pid}"`);
 record({kind:'taste',title:`Taste profile removed: ${gone.name}`},()=>write(list.filter(p=>p.id!==pid)));return {removed:pid};}
const short=(t:string)=>t.length>70?t.slice(0,67)+'…':t;
export const rename=(pid:string,name:string)=>change(pid,p=>{p.name=name.trim();},`renamed to ${name.trim()}`);
export const setVideos=(pid:string,v:string[]|null)=>change(pid,p=>{p.videos=v&&v.length?v:null;},v&&v.length?`based on ${v.length} taught video${v.length>1?'s':''}`:'based on every taught video');
export const setLine=(pid:string,ref:string,on:boolean)=>change(pid,p=>{p.off=on?p.off.filter(x=>x!==ref):[...new Set([...p.off,ref])];},`line switched ${on?'on':'off'} (${short(lineText(ref))})`);
export const addLine=(pid:string,topic:Topic,text:string)=>change(pid,p=>{p.added.push({id:'own-'+Date.now().toString(36),topic,text:text.trim()});},`own line added (${short(text.trim())})`);
export const dropLine=(pid:string,lineId:string)=>change(pid,p=>{p.added=p.added.filter(a=>a.id!==lineId);},'own line removed');
export const setTarget=(pid:string,metric:string,t:{lo:number;hi:number}|null)=>change(pid,p=>{if(!METRIC_LABEL[metric])throw new Error('Unknown measurement: '+metric);if(t)p.targets[metric]=t;else delete p.targets[metric];},`${METRIC_LABEL[metric]?.label??metric} target ${t?`set to ${t.lo} to ${t.hi}`:'cleared'}`);
export const setNotes=(pid:string,notes:string)=>change(pid,p=>{p.notes=notes;},'notes changed');
const lineText=(ref:string)=>{const k=allKnowledge().find(x=>x.id===ref);return k?(k.source==='feedback'?k.title:k.body):ref;};
// The change history reads and writes one profile at a time (Undo).
adapter('profile',{
 read:pid=>{try{return fileSchema.parse(JSON.parse(fs.readFileSync(tasteFile(),'utf8'))).profiles.find(p=>p.id===pid)??(pid==='main'?structuredClone(MAIN):null);}catch{return pid==='main'?structuredClone(MAIN):null;}},
 write:(pid,v)=>{const list=read(),i=list.findIndex(p=>p.id===pid);if(v===null){if(pid!=='main'&&i>=0)list.splice(i,1);}else if(i>=0)list[i]=profileSchema.parse(v);else list.push(profileSchema.parse(v));writeFile(list);},
 label:(pid,v)=>`Taste profile ${String((v as Profile|null)?.name??pid)}`,sets:{off:null,added:'id'}});

export type Line={ref:string;topic:Topic|'general';text:string;source:'pattern'|'lesson'|'rule'|'you';strength:number;on:boolean;avoid:boolean};
export type Target={metric:string;label:string;unit:string;lo:number;hi:number;from:'your examples'|'you';videos:number;about:string};
const topicOf=(k:Knowledge):Topic|'general'=>(k.tags.find(t=>(TEACH_TOPICS as readonly string[]).includes(t)) as Topic|undefined)??'general';
/** The profile as the user reads it: lines by topic, targets, and what they reject most. */
export function build(pid='main'){
 const p=profile(pid),off=new Set(p.off),pat=patterns(p.videos??undefined),ks=allKnowledge();
 const mine=p.videos?new Set(p.videos.map(v=>'teach:'+v)):null;
 const lines:Line[]=[];
 // Lessons the user kept or that jobs proved (for a profile based on some videos: lessons seen in those).
 for(const k of ks.filter(k=>k.tags.includes('taught')&&!k.tags.includes('pattern')&&['approved','proven'].includes(k.status)&&(!mine||k.tags.includes('mine')||k.evidence.some(e=>mine.has(e)))))
  lines.push({ref:k.id,topic:topicOf(k),text:k.body,source:k.tags.includes('mine')?'you':'lesson',strength:Math.round(confidence(k)*100),on:!off.has(k.id),avoid:k.kind==='avoid'});
 // The user's own rules from feedback and ratings.
 for(const k of ks.filter(k=>k.source==='feedback'&&['approved','proven'].includes(k.status)))
  lines.push({ref:k.id,topic:topicOf(k),text:k.title,source:'rule',strength:Math.round(confidence(k)*100),on:!off.has(k.id),avoid:k.kind==='rule'&&/^(avoid|never|no |do not|don't)/i.test(k.title)});
 for(const a of p.added)lines.push({ref:a.id,topic:((TEACH_TOPICS as readonly string[]).includes(a.topic)?a.topic:'general') as Topic|'general',text:a.text,source:'you',strength:100,on:true,avoid:/^(avoid|never|no |do not|don't)/i.test(a.text)});
 const targets:Target[]=METRIC_INFO.map(m=>{const own=p.targets[m.id],found=pat.found.find(f=>f.metric===m.id),L=METRIC_LABEL[m.id]!;
  if(own)return {metric:m.id,label:L.label,unit:m.unit.trim(),lo:own.lo,hi:own.hi,from:'you' as const,videos:found?.videos.length??0,about:m.about};
  if(found&&!off.has(found.id))return {metric:m.id,label:L.label,unit:m.unit.trim(),lo:found.lo,hi:found.hi,from:'your examples' as const,videos:found.videos.length,about:m.about};
  return null;}).filter((t):t is Target=>!!t);
 // What the user rejects most, from the reasons of their bad ratings.
 const reasons=new Map<string,number>();
 for(const k of ks.filter(k=>k.source==='feedback'))for(const label of REASON_LABELS)if(k.body.includes(label))reasons.set(label,(reasons.get(label)??0)+1);
 const rejects=[...reasons].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([reason,n])=>({reason,times:n}));
 const order=['general',...TEACH_TOPICS] as const;
 return {id:p.id,name:p.name,videos:p.videos,notes:p.notes,basedOn:{videos:pat.from.good+pat.from.bad,good:pat.from.good,bad:pat.from.bad},
  topics:order.map(t=>({id:t,label:t==='general'?'In general':TOPIC_LABEL[t as Topic],lines:lines.filter(l=>l.topic===t).sort((a,b)=>b.strength-a.strength)})).filter(t=>t.lines.length),
  targets,untargeted:METRIC_INFO.filter(m=>!targets.some(t=>t.metric===m.id)).map(m=>({metric:m.id,label:METRIC_LABEL[m.id]!.label,unit:m.unit.trim(),about:m.about,offRef:pat.found.find(f=>f.metric===m.id)?.id??null})),
  rejects,profiles:profiles(),topicList:TEACH_TOPICS.map(t=>({id:t,label:TOPIC_LABEL[t]})),allVideos:videos().filter(v=>v.status==='learned').map(v=>({id:v.id,title:v.title,verdict:v.verdict}))};
}
export type Built=ReturnType<typeof build>;
/** The profile as text, for the agent and for export. */
export function markdown(pid='main'){
 const b=build(pid);
 return `# Taste profile: ${b.name}\n\nBuilt from ${b.basedOn.good} good and ${b.basedOn.bad} bad examples, the lessons that were kept, and the user's rules.\n`+
  (b.notes?`\n${b.notes}\n`:'')+
  b.topics.map(t=>`\n## ${t.label}\n\n${t.lines.filter(l=>l.on).map(l=>`- ${l.avoid&&!/^(avoid|never|no |do not|don't)/i.test(l.text)?'Avoid: ':''}${l.text}`).join('\n')}\n`).filter(x=>x.includes('- ')).join('')+
  (b.targets.length?`\n## Targets (measured on every preview)\n\n${b.targets.map(t=>`- ${t.label}: ${t.lo} to ${t.hi}${t.unit?' '+t.unit:''} (${t.from})`).join('\n')}\n`:'')+
  (b.rejects.length?`\n## Most often rejected\n\n${b.rejects.map(r=>`- ${r.reason} (${r.times}×)`).join('\n')}\n`:'');
}
/** The lines of a profile for some topics, short, for a role starting a task. */
export function forTopics(pid:string,topics:string[],limit=8){
 let b:Built;try{b=build(pid);}catch{return null;}
 const lines=b.topics.filter(t=>t.id==='general'||topics.includes(t.id)).flatMap(t=>t.lines.filter(l=>l.on)).slice(0,limit).map(l=>l.text);
 const targets=b.targets.map(t=>`${t.label}: ${t.lo} to ${t.hi}${t.unit?' '+t.unit:''}`);
 return lines.length||targets.length?{profile:b.name,lines,targets,full:`pnpm tempoloom taste show ${b.id}`}:null;
}

export type Check={metric:string;label:string;value:number;unit:string;lo:number;hi:number;verdict:'pass'|'near'|'off';fix:string|null;role:string};
/** A measured video against a profile's targets: inside the range passes; just outside is near;
 *  further is off, with what to change and whose step fixes it. */
export function check(m:Measured,pid='main'):{profile:string;checks:Check[];off:number;near:number;passed:number}{
 const b=build(pid),tol=new Map(METRIC_INFO.map(x=>[x.id,x.tolerance]));
 const checks:Check[]=[];
 for(const t of b.targets){
  const raw=metricValue(t.metric,m);if(raw===null)continue;
  const slack=(tol.get(t.metric)??0)/2,L=METRIC_LABEL[t.metric]!;
  const below=raw<t.lo,above=raw>t.hi,far=raw<t.lo-slack||raw>t.hi+slack;
  // More cuts on the beat than the examples is never a problem.
  const verdict=t.metric==='cuts-on-beat'&&above?'pass':far?'off':below||above?'near':'pass';
  checks.push({metric:t.metric,label:L.label,value:Math.round(raw*10)/10,unit:t.unit,lo:t.lo,hi:t.hi,verdict,fix:verdict==='pass'?null:`${below?L.low:L.high} It is ${Math.round(raw*10)/10}${t.unit?' '+t.unit:''}; you like ${t.lo} to ${t.hi}.`,role:L.role});
 }
 return {profile:b.name,checks,off:checks.filter(c=>c.verdict==='off').length,near:checks.filter(c=>c.verdict==='near').length,passed:checks.filter(c=>c.verdict==='pass').length};
}
