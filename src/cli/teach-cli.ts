// `pnpm tempoloom teach`: teach the brain with videos. The user uploads on the Teach page (or
// the agent adds a file); the agent looks at the frames and writes lessons; the video is deleted.
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
import * as T from '../engine/teach/teach.js';
import {sync} from '../engine/brain/brain.js';

const usage=`Usage: tempoloom teach <command>

  open [--port 4747] [--no-browser]
                     Open the Teach page on this computer: upload a video, trim and crop it, mark
                     moments, tick what to learn, write a prompt, say if it is a good or bad example
  add FILE|URL --topics pacing,motion [--bad] [--title T] [--prompt "..."] [--start S --end S]
               [--crop x,y,w,h] [--mark "3.2:this transition"]... [--no-sound] [--speech] [--confirm]
                     The same without the page (a link is downloaded only with --confirm)
  next [ID]          The next video waiting to be studied: prompt, measurements, frame sheets to open
  learn ID --topic TOPIC "THE LESSON" [--at SECONDS] [--title T]
                     Save one lesson (vague ones and repeats are filtered; opposites are flagged)
  finish ID          Learning is done: delete the video and frames, keep lessons and numbers
  list | show ID     Taught videos, their measurements and lessons
  similar ID|FILE    Taught videos most like this one (pacing, motion, colour, sound, layout)
  patterns           What your good examples have in common
  keep LESSON | remove LESSON | forget ID
                     Keep or remove a lesson; forget a video and what only it taught

Topics: ${T.TEACH_TOPICS.join(', ')}
The video is copied to a temporary folder (workspace/teach/), studied, and deleted. Your original
file is never touched. Only numbers and lessons go to the brain.`;

const {values:v,positionals}=parseArgs({allowPositionals:true,options:{port:{type:'string'},'no-browser':{type:'boolean'},topics:{type:'string'},topic:{type:'string',multiple:true},bad:{type:'boolean'},good:{type:'boolean'},
 title:{type:'string'},prompt:{type:'string'},start:{type:'string'},end:{type:'string'},crop:{type:'string'},mark:{type:'string',multiple:true},'no-sound':{type:'boolean'},speech:{type:'boolean'},confirm:{type:'boolean'},at:{type:'string'},limit:{type:'string'}}});
const [cmd,...rest]=positionals;
const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
const num=(s:string|undefined,name:string)=>{if(s===undefined)return undefined;const n=Number(s);if(!Number.isFinite(n))throw new Error(`${name} must be a number`);return n;};

async function main(){
 if(!cmd||cmd==='help'||cmd==='--help')return console.log(usage);
 switch(cmd){
  case 'open':{
   sync();
   const {serve}=await import('../teach/server.js');
   const s=await serve({...(v.port?{port:num(v.port,'--port')!}:{})});
   console.log(`\nTeach page: ${s.url}\n\nOpen this link in your browser (it works on this computer only). Keep this terminal open; press Ctrl+C to stop.\nWhen videos are waiting, your agent studies them with: pnpm tempoloom teach next\n`);
   if(!v['no-browser']){const [exe,args]=process.platform==='win32'?['cmd',['/c','start','',s.url]]:process.platform==='darwin'?['open',[s.url]]:['xdg-open',[s.url]];
    try{spawn(exe as string,args as string[],{stdio:'ignore',detached:true,windowsHide:true}).on('error',()=>undefined).unref();}catch{/* the link is printed */}}
   await new Promise<void>(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
   await s.close();return;
  }
  case 'add':{
   const input=rest[0];if(!input)throw new Error('add FILE|URL --topics a,b');
   if(!v.topics)throw new Error(`Say what to learn: --topics ${T.TEACH_TOPICS.slice(0,3).join(',')} (all: ${T.TEACH_TOPICS.join(', ')})`);
   sync();
   let d:T.Taught;
   if(/^https?:\/\//i.test(input)){const r=await T.draftFromLink(input,!!v.confirm);if(r.status==='needs-confirmation')return out({...r,next:'To download it for study (deleted after learning), run again with --confirm'});d=r.video;}
   else d=await T.draftFromFile(input);
   const crop=v.crop?.split(',').map(Number);if(crop&&(crop.length!==4||crop.some(n=>!Number.isFinite(n))))throw new Error('--crop x,y,w,h as fractions of the frame, for example 0,0.1,1,0.8');
   const start=num(v.start,'--start'),end=num(v.end,'--end');
   try{
    const t=await T.teach(d.id,{title:v.title??d.title,verdict:v.bad?'bad':'good',prompt:v.prompt??'',topics:v.topics.split(',').map(s=>s.trim()).filter(Boolean) as T.Topic[],
     marks:(v.mark??[]).map(m=>{const i=m.indexOf(':'),t=Number(i<0?m:m.slice(0,i));if(!Number.isFinite(t))throw new Error('--mark SECONDS:note');return {t,note:i<0?'':m.slice(i+1)};}),
     segment:start!==undefined||end!==undefined?{start:start??0,end:end??d.media!.seconds}:null,crop:crop?{x:crop[0]!,y:crop[1]!,w:crop[2]!,h:crop[3]!}:null,sound:!v['no-sound'],speech:!!v.speech});
    return out({id:t.id,status:t.status,next:`Study it: pnpm tempoloom teach next ${t.id}`});
   }catch(e){await T.discard(d.id).catch(()=>undefined);throw e;}
  }
  case 'next':return out(T.next(rest[0]));
  case 'learn':{const [id,...words]=rest;if(!id||!words.length)throw new Error('learn ID --topic TOPIC "THE LESSON"');
   const r=T.learn(id,{text:words.join(' '),topics:(v.topic??[]).flatMap(t=>t.split(',')),...(v.title?{title:v.title}:{}),...(v.at!==undefined?{at:num(v.at,'--at')!}:{})});
   return out(r);}
  case 'finish':if(!rest[0])throw new Error('finish ID');return out(await T.finish(rest[0]));
  case 'list':return out(T.videos().map(x=>({id:x.id,title:x.title,example:x.verdict,status:x.status,topics:x.topics,lessons:x.lessons.length,taught:x.created.slice(0,10)})));
  case 'show':if(!rest[0])throw new Error('show ID');return out(T.show(rest[0]));
  case 'similar':{if(!rest[0])throw new Error('similar ID|FILE');const limit=num(v.limit,'--limit')??5;
   return out(T.videos().some(x=>x.id===rest[0])?{similar:T.similar(rest[0],limit)}:await T.similarToFile(rest[0],limit));}
  case 'patterns':return out(T.updatePatterns());
  case 'keep':if(!rest[0])throw new Error('keep LESSON');return out(T.review(rest[0],'both'));
  case 'remove':if(!rest[0])throw new Error('remove LESSON');return out(T.review(rest[0],'remove'));
  case 'forget':if(!rest[0])throw new Error('forget ID');return out(await T.forget(rest[0]));
 }
 console.error(usage);process.exitCode=1;
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
