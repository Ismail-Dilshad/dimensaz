// Edit by text: footage as its transcript (strike a sentence, it is cut), fillers, pauses and
// repeated takes with the strongest kept, the best openings ranked, the frame following the speaker,
// and b-roll from the user's own clips.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-text-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,'backups')},before={...process.env};
let closeDb:()=>void;
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

/** What is said in the talk, sentence by sentence, with when. */
const SAID:[string,number,number][]=[
 ['Hi everyone, welcome back.',.2,1.6],['So today we talk about cold brew.',1.8,3.6],
 ['Most people brew it the',5.2,6.4],['Most people um brew it the wrong way.',7.4,9.6],['Most people brew it the wrong way.',10,11.8],
 ['Why does your coffee taste bitter?',12.2,14],['It takes 18 hours, and it is worth it.',14.4,16.6],['Pouring it over ice makes it smooth.',17,19]];
const transcript=()=>({language:'en' as const,words:SAID.flatMap(([s,a,b])=>{const ws=s.split(' '),d=(b-a)/ws.length;return ws.map((w,i)=>({text:w,start:+(a+i*d).toFixed(3),end:+(a+(i+.85)*d).toFixed(3),type:'word' as const}));})});
function finishSteps(st:typeof import('../src/engine/studio.js'),job:string,upTo:string){
 const p=st.readPlan(job);
 for(const t of p.tasks){if(t.id===upTo)break;t.status='done';if(t.produces){t.output=path.join(st.jobDir(job),t.produces);fs.writeFileSync(t.output,t.id);}}
 fs.writeFileSync(path.join(st.jobDir(job),'plan.json'),JSON.stringify(p));
}
const talk=async(name:string,size='640x360')=>{const f=path.join(tmp,name);await run(ffmpeg,['-v','error','-y','-f','lavfi','-i',`testsrc2=s=${size}:d=20:r=25`,'-f','lavfi','-i','sine=f=220:d=20','-shortest','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast','-c:a','aac',f]);return f;};

describe('the speech, read as text',()=>{
 it('finds the takes of a line said again and keeps the strongest, with why',async()=>{
  const S=await import('../src/editor/speech.js');
  const words=S.spokenWords(transcript().words,'en'),sentences=S.sentencesOf(words);
  expect(sentences.map(s=>s.text)).toEqual(SAID.map(x=>x[0]));
  // A restart without a pause or a full stop is still two takes.
  const run_=S.spokenWords('Most people brew it the Most people um brew it the wrong way.'.split(' ').map((t,i)=>({text:t,start:i*.3,end:i*.3+.25,type:'word' as const})),'en');
  expect(S.sentencesOf(run_).map(s=>s.text)).toEqual(['Most people brew it the','Most people um brew it the wrong way.']);
  const takes=S.findTakes(sentences,words);
  expect(takes).toHaveLength(1);expect(takes[0]).toMatchObject({sentences:[3,4,5],best:5});
  expect(takes[0]!.why).toMatch(/^Take 3 of 3 kept: complete, clean and clear \(take 1: stops mid-sentence.*take 2: 1 filler/);
 });
 it('ranks the openings: a question to the viewer first, a greeting never',async()=>{
  const S=await import('../src/editor/speech.js');
  const words=S.spokenWords(transcript().words,'en'),hooks=S.findHooks(S.sentencesOf(words),words);
  expect(hooks[0]).toMatchObject({rank:1,sentences:[6],why:expect.arrayContaining(['asks a question','speaks to the viewer'])});
  expect(hooks.some(h=>h.sentences.includes(1)&&h.sentences.length===1)).toBe(false);
  expect(hooks.find(h=>h.sentences[0]===7)?.why).toContain('needs what came before');
 });
});

describe('following the speaker',()=>{
 it('holds while the face stays near the middle and glides after it, inside the frame',async()=>{
  const F=await import('../src/editor/follow.js');
  const track=[...Array.from({length:12},(_,i)=>({time:i*.25,face:true,x:.3+(i%2)*.01,y:.4})),...Array.from({length:12},(_,i)=>({time:3+i*.25,face:true,x:.75,y:.4})),{time:6,face:false}];
  const p=F.followPath(track,{crop:{w:.316,h:1},duration:6});
  const at=(t:number)=>p.filter(x=>x.t<=t).at(-1)!.x;
  expect(at(2.5)).toBeCloseTo(.3,1);expect(at(5.9)).toBeGreaterThan(.65);
  // It glides: no step between two points bigger than its speed allows.
  for(let i=1;i<p.length;i++)expect(Math.abs(p[i]!.x-p[i-1]!.x)).toBeLessThanOrEqual(.3*(p[i]!.t-p[i-1]!.t)+1e-6);
  expect(p.every(x=>x.x>=.158-1e-6&&x.x<=1-.158+1e-6)).toBe(true);
  const cmds=F.followCommands(p,{fps:10,duration:6,width:640,height:360,cw:202,ch:360});
  expect(cmds.split('\n').filter(Boolean)).toHaveLength(60);expect(cmds).toMatch(/^0\.0000 crop x \d+, crop y 0;/);
 });
});

describe('an edit by text',()=>{
 it('reads footage into words, cuts, takes and openings, and changes with the words',async()=>{
  const T=await import('../src/editor/text-edit.js');
  const d=await T.createDoc(await talk('talk.mp4'),{transcript:transcript(),title:'Cold brew talk'});
  let v=T.docView(d.id);
  expect(v.counts.take).toEqual({on:2,all:2});expect(v.counts.pause.on).toBeGreaterThan(0);expect(v.counts.end.on).toBe(1);
  expect(v.sentences.find(s=>s.n===4)!.words.find(w=>w.text==='um')).toMatchObject({filler:true,cut:'take'});
  expect(v.hooks[0]).toMatchObject({rank:1,at:'0:12'});
  const before=v.seconds;
  // Strike the greeting: it is cut; bring it back: it plays again.
  v=T.cutSentence(d.id,1,true) as typeof v;expect(v.sentences[0]!.struck).toBe(true);expect(v.seconds).toBeLessThan(before-1);
  v=T.cutSentence(d.id,1,false) as typeof v;expect(v.seconds).toBeCloseTo(before,2);
  // Keep the first take instead: the other two are cut.
  v=T.pickTake(d.id,'take-1',3) as typeof v;
  expect(v.removals.filter(r=>r.kind==='take'&&r.on).map(r=>r.sentence)).toEqual([4,5]);expect(v.takes[0]!.why).toBe('You chose take 1 of 3');
  T.pickTake(d.id,'take-1',5);
  // Every filler back at once, then cut again.
  v=T.toggleKind(d.id,'pause',false) as typeof v;expect(v.counts.pause.on).toBe(0);T.toggleKind(d.id,'pause',true);
  // A few words, struck inside a sentence.
  const s7=v.sentences[6]!;v=T.cutWords(d.id,s7.words[2]!.i,s7.words[4]!.i+1) as typeof v;
  expect(v.removals.find(r=>r.kind==='words')).toMatchObject({text:'18 hours, and',on:true});
  // The best opening plays first, and still in its place.
  v=T.setHook(d.id,1) as typeof v;expect(v.segments[0]!.start).toBeCloseTo(12.12,1);expect(v.segments.length).toBeGreaterThan(2);
  const plain=T.compile(T.readDoc(d.id));
  expect(plain.edl.operations.map(o=>o.op)).toEqual(['arrange','captions','loudness']);
  const cap=plain.edl.operations.find(o=>o.op==='captions') as {cues:{text:string;start:number}[]};
  expect(cap.cues[0]!.text).toMatch(/^Why does your/);expect(cap.cues.map(c=>c.text).join(' ')).not.toMatch(/\bum\b/);
 },60000);
 it('suggests b-roll from the user\'s own clips for what is said, and makes the edit',async()=>{
  const T=await import('../src/editor/text-edit.js'),B=await import('../src/editor/broll.js'),{validateVideo}=await import('../src/renderer/ffmpeg-encoder.js');
  const clip=path.join(tmp,'pouring-cold-brew-over-ice.mp4');
  await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','color=c=navy:s=480x270:d=2:r=25','-f','lavfi','-i','color=c=white:s=480x270:d=2:r=25','-filter_complex','[0][1]concat=n=2:v=1:a=0','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',clip]);
  const added=await B.addClips([clip]);expect(added.added[0]).toMatchObject({shots:2});
  const lib=B.library()[0]!;expect(lib.shots[0]).toMatchObject({description:'pouring cold brew over ice',by:'name'});expect(fs.existsSync(lib.shots[0]!.sheet)).toBe(true);
  B.describe(lib.id,2,'Ice cubes falling into a glass, slow motion');
  const d=await T.createDoc(await talk('talk2.mp4'),{transcript:transcript(),title:'With b-roll'});
  let v=T.docView(d.id);
  const pour=v.broll.find(b=>b.sentence===8)!;expect(pour).toMatchObject({clip:lib.id,on:false});expect(pour.shared).toEqual(expect.arrayContaining(['pouring','ice']));
  expect(v.broll.find(b=>b.sentence===2)?.shared).toEqual(expect.arrayContaining(['cold','brew']));
  T.setBroll(d.id,8,true);
  // A vertical result that follows the speaker (a face track as media reframe gives it).
  const track=Array.from({length:81},(_,i)=>({time:i*.25,face:true,x:i<40?.35:.65,y:.45}));
  v=await T.setShape(d.id,'9:16',{track}) as typeof v;expect(v.shape).toMatchObject({aspect:'9:16',following:true});
  const r=await T.render(d.id);
  const info=await validateVideo(r.output);expect(info).toMatchObject({width:1080,height:1920});
  expect(info.duration).toBeCloseTo(T.docView(d.id).seconds,0);expect(r.notes.join(' ')).toMatch(/follows the speaker.*1 b-roll shot/s);
  const edl=JSON.parse(fs.readFileSync(r.edl,'utf8')) as {operations:{op:string;follow?:unknown[]}[]};
  expect(edl.operations.map(o=>o.op)).toEqual(['reframe','arrange','overlays','captions','loudness']);expect(edl.operations[0]!.follow!.length).toBeGreaterThan(3);
  expect(T.docView(d.id).renders[0]).toMatchObject({exists:true});
  // Removing the text edit keeps the video made from it.
  const gone=T.removeDoc(d.id);expect(gone.kept.some(f=>f.endsWith('edit.mp4'))).toBe(true);expect(fs.existsSync(r.output)).toBe(true);
 },180000);
 it('is on the Studio page, and the studio\'s cutter plans from it',async()=>{
  const T=await import('../src/editor/text-edit.js'),st=await import('../src/engine/studio.js'),R=await import('../src/engine/studio-requests.js'),{serve}=await import('../src/teach/server.js');
  const job=st.plan('An edit of my talk',{type:'footage-edit',job:'talk-edit'}).job;
  const d=await T.createDoc(await talk('talk3.mp4'),{transcript:transcript(),job});
  finishSteps(st,job,'cut-plan');
  expect((st.start(job,'cut-plan') as {editByText?:string}).editByText).toMatch(/edit text FOOTAGE --job talk-edit/);
  expect(R.jobView(st.readPlan(job)).textEdits).toEqual([{id:d.id,title:'talk3.mp4',made:0}]);
  const key=process.env.ELEVENLABS_API_KEY;delete process.env.ELEVENLABS_API_KEY;
  const s=await serve({port:0});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key,'content-type':'application/json'};
   expect((await fetch(base+'/text.js')).status).toBe(200);
   const list=await (await fetch(base+'/api/text',{headers:h})).json() as {edits:{id:string}[];can:{speech:boolean}};
   expect(list.can.speech).toBe(false);expect(list.edits.map(e=>e.id)).toContain(d.id);
   expect((await fetch(base+'/api/text/upload?name=a.mp4',{method:'POST',headers:{'x-teach-key':s.key},body:'xx'})).status).toBe(400);
   const v=await (await fetch(`${base}/api/text/${d.id}`,{method:'POST',headers:h,body:JSON.stringify({action:'cut',sentence:1,on:true})})).json() as {sentences:{struck:boolean}[]};
   expect(v.sentences[0]!.struck).toBe(true);
   expect((await fetch(`${base}/api/text/${d.id}`,{method:'POST',headers:h,body:JSON.stringify({action:'nope'})})).status).toBe(400);
   const src=await fetch(`${base}/text-file/${d.id}/source`,{headers:{'x-teach-key':s.key,range:'bytes=0-99'}});expect(src.status).toBe(206);
   expect((await fetch(`${base}/api/text/no-such-edit`,{headers:h})).status).toBe(404);
  }finally{await s.close();if(key)process.env.ELEVENLABS_API_KEY=key;}
 },60000);
});
