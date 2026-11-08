// Learning from the user's feedback. Every rejection, correction or "keep this" is recorded
// automatically: the raw words go to agent/knowledge/feedback.jsonl, and a short rule goes to
// the "Learned from your feedback" section of agent/knowledge/memory.md, merged with an
// existing rule on the same point (counted, newest wording wins). Before every new video the
// agent loads the rules that match the brief and applies them.
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from './config.js';

export const memoryFile=()=>path.join(process.env.DIMENSAZ_KNOWLEDGE_DIR??path.join(ROOT,'agent','knowledge'),'memory.md');
export const feedbackLog=()=>path.join(process.env.DIMENSAZ_KNOWLEDGE_DIR??path.join(ROOT,'agent','knowledge'),'feedback.jsonl');
export const SECTION='## Learned from your feedback';
const SECTION_INTRO='Written automatically from the user\'s feedback (`pnpm dimensaz feedback add`). Apply every\nrule that matches the brief; a rule seen 2× or more, or from a rejected video, always applies.\nRemove one with `pnpm dimensaz feedback forget ID`.';

export const verdicts=['reject','revise','approve'] as const;
export type Verdict=typeof verdicts[number];
export type Lesson={id:string;date:string;count:number;verdict:Verdict;job:string|null;rule:string;quote:string;topics:string[]};

const TOPICS:[string,RegExp][]=[
 ['motion',/\b(motion|animat\w*|static|still|moving|move|movement|dynamic|boring|empty|alive|flat)\b/i],
 ['pacing',/\b(pace|pacing|slow|fast|speed|rhythm|timing|too long|faster|slower|beat)\b/i],
 ['design',/\b(design\w*|layout|composition|ugly|clean|minimal|style|look|visual\w*|premium|cheap)\b/i],
 ['typography',/\b(font|fonts|typography|text size|letter\w*|bold|headline|title|text)\b/i],
 ['color',/\b(colou?rs?|palette|contrast|dark|light|background|gradient|tint)\b/i],
 ['captions',/\b(caption\w*|subtitle\w*|srt|lower third)\b/i],
 ['transitions',/\b(transition\w*|cut|cuts|wipe|fade|zoom)\b/i],
 ['audio',/\b(music|sound\w*|sfx|audio|volume|loud\w*|quiet|beat)\b/i],
 ['voice',/\b(voice|voice-?over|narrat\w*|speaker|accent|tone)\b/i],
 ['brand',/\b(brand\w*|logo|identity|watermark|end card)\b/i],
 ['cta',/\b(cta|call to action|button|sign ?up|download now|link)\b/i],
 ['assets',/\b(icon\w*|image\w*|3d|mockup\w*|screenshot\w*|ui|illustration\w*|asset\w*|stock|b-?roll)\b/i],
 ['kurdish',/\b(kurdish|sorani|kurmanji|badini|rtl|right-to-left|arabic script)\b|کورد|سۆرانی/i],
 ['length',/\b(length|duration|seconds|minutes|shorter|longer)\b|\d+\s?s\b/i],
 ['format',/\b(9:16|16:9|1:1|vertical|horizontal|square|reel|short|tiktok|youtube)\b/i],
 ['script',/\b(script|wording|words|copy|sentence\w*|grammar|spelling)\b/i],
 ['editing',/\b(edit\w*|trim|jump cut|filler|pause\w*|crop|reframe)\b/i],
];
export function topicsOf(...texts:string[]){const t=texts.join(' ');return TOPICS.filter(([,re])=>re.test(t)).map(([n])=>n);}

const words=(s:string)=>new Set(s.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2&&!STOP.has(w)));
const STOP=new Set(['the','and','for','with','that','this','not','are','was','you','your','every','always','never','use','make','more','less','too','very','its','from','into','than','then','but','all','each','when','should','must','have','has','had','one','any']);
const similarity=(a:string,b:string)=>{const A=words(a),B=words(b);if(!A.size||!B.size)return 0;let n=0;for(const w of A)if(B.has(w))n++;return n/Math.min(A.size,B.size);};
const slug=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').split('-').filter(w=>w&&!STOP.has(w)).slice(0,5).join('-').slice(0,48)||'lesson';
const clean=(s:string)=>s.replace(/\s+/g,' ').replace(/[“”]/g,'"').trim();

// ---------- memory.md section ----------
const ENTRY=/^- \*\*(fb-[a-z0-9-]+)\*\* · (Rule|Keep), (\d{4}-\d{2}-\d{2}), (\d+)×(?: \(([a-z]+)(?:, job ([^)]+))?\))?: (.*?) — you said: "(.*)"\. Topics: ([a-z, -]*)\.$/;
export function parseLessons(md:string):Lesson[]{
 const start=md.indexOf(SECTION);if(start<0)return [];
 const rest=md.slice(start+SECTION.length);const end=rest.search(/\n## /);
 const out:Lesson[]=[];
 for(const line of (end<0?rest:rest.slice(0,end)).split('\n')){
  const m=line.match(ENTRY);if(!m)continue;
  out.push({id:m[1]!,date:m[3]!,count:Number(m[4]),verdict:(m[5]??(m[2]==='Keep'?'approve':'revise')) as Verdict,job:m[6]??null,rule:m[7]!,quote:m[8]!.replace(/\\"/g,'"'),topics:m[9]!.split(',').map(s=>s.trim()).filter(Boolean)});
 }
 return out;
}
export const formatLesson=(l:Lesson)=>`- **${l.id}** · ${l.verdict==='approve'?'Keep':'Rule'}, ${l.date}, ${l.count}×${` (${l.verdict}${l.job?', job '+l.job.replace(/[)]/g,''):''})`}: ${clean(l.rule).replace(/ — you said:/g,' -')} — you said: "${clean(l.quote).replace(/"/g,'\\"')}". Topics: ${l.topics.join(', ')}.`;
export function writeLessons(md:string,lessons:Lesson[]){
 const block=`${SECTION}\n\n${SECTION_INTRO}\n\n${lessons.map(formatLesson).join('\n')}${lessons.length?'\n':''}`;
 const start=md.indexOf(SECTION);
 if(start<0)return md.replace(/\s*$/,'\n\n')+block;
 const rest=md.slice(start);const end=rest.slice(SECTION.length).search(/\n## /);
 return md.slice(0,start)+block+(end<0?'':'\n'+rest.slice(SECTION.length+end+1));
}

async function readMemory(){return fs.readFile(memoryFile(),'utf8').catch(()=>'# Production memory\n');}
async function writeMemory(md:string){const tmp=memoryFile()+'.tmp';await fs.writeFile(tmp,md);await fs.rename(tmp,memoryFile());}

export type FeedbackInput={said:string;rule?:string;verdict?:Verdict;job?:string;video?:string;topics?:string[];id?:string};
/** Records feedback and adds or strengthens the matching rule. Returns what was saved. */
export async function addFeedback(f:FeedbackInput){
 const said=clean(f.said);if(!said)throw new Error('Give the user\'s words: feedback add "what they said" --rule "what to do next time"');
 const rule=clean(f.rule||said);
 const verdict:Verdict=f.verdict??'revise';
 if(!verdicts.includes(verdict))throw new Error('verdict must be reject, revise or approve');
 const date=new Date().toISOString().slice(0,10);
 const topics=[...new Set([...(f.topics??[]),...topicsOf(said,rule)])].slice(0,6);
 const md=await readMemory();const lessons=parseLessons(md);
 const match=f.id?lessons.find(l=>l.id===f.id):lessons.map(l=>({l,s:Math.max(similarity(l.rule,rule),similarity(l.quote,said))})).filter(x=>x.s>=0.6&&(x.l.verdict==='approve')===(verdict==='approve')).sort((a,b)=>b.s-a.s)[0]?.l;
 let saved:Lesson,action:'added'|'strengthened';
 if(match){
  saved={...match,date,count:match.count+1,rule,quote:said,job:f.job??match.job,verdict:match.verdict==='reject'||verdict==='reject'?'reject':verdict,topics:[...new Set([...match.topics,...topics])].slice(0,6)};
  lessons[lessons.indexOf(match)]=saved;action='strengthened';
 }else{
  let id='fb-'+(f.id?.replace(/^fb-/,'')||slug(rule));const taken=new Set(lessons.map(l=>l.id));
  for(let n=2;taken.has(id);n++)id=id.replace(/-\d+$/,'')+'-'+n;
  saved={id,date,count:1,verdict,job:f.job??null,rule,quote:said,topics};lessons.push(saved);action='added';
 }
 await writeMemory(writeLessons(md,lessons));
 await fs.appendFile(feedbackLog(),JSON.stringify({at:new Date().toISOString(),verdict,job:f.job??null,video:f.video??null,said,rule,lesson:saved.id})+'\n');
 return {action,lesson:saved,line:formatLesson(saved)};
}

/** The rules to apply to a new brief: strong rules always, the rest when their topics or words match. */
export async function lessonsFor(brief='',limit=12){
 const lessons=parseLessons(await readMemory());
 const topics=new Set(topicsOf(brief));
 const scored=lessons.map(l=>{
  const strong=l.count>=2||l.verdict==='reject';
  const score=(strong?100:0)+l.topics.filter(t=>topics.has(t)).length*10+(brief?Math.round(similarity(brief,l.rule+' '+l.quote)*10):0)+l.count;
  return {l,strong,score};
 }).filter(x=>x.strong||!brief||x.score>x.l.count);
 return scored.sort((a,b)=>b.score-a.score||b.l.date.localeCompare(a.l.date)).slice(0,limit)
  .map(({l,strong})=>({id:l.id,apply:l.verdict==='approve'?`Keep: ${l.rule}`:l.rule,always:strong,seen:l.count,last:l.date,topics:l.topics,userSaid:l.quote}));
}
export async function listLessons(){return parseLessons(await readMemory());}
export async function forget(id:string){
 const md=await readMemory();const lessons=parseLessons(md);const keep=lessons.filter(l=>l.id!==id);
 if(keep.length===lessons.length)throw new Error('No lesson '+id+'. See: pnpm dimensaz feedback list');
 await writeMemory(writeLessons(md,keep));
 await fs.appendFile(feedbackLog(),JSON.stringify({at:new Date().toISOString(),forgot:id})+'\n');
 return {forgot:id};
}
