// Publish kit: covers and titles to choose from, a post package checked against each platform's
// limits, and a timeline other editors open (Premiere Pro and DaVinci Resolve, Final Cut Pro, an EDL).
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-publish-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'local'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_BACKUP_DIR:path.join(tmp,'backups'),VIDEO_OUTPUT:path.join(tmp,'out')},before={...process.env};
let closeDb:()=>void;
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});fs.mkdirSync(env.VIDEO_OUTPUT,{recursive:true});
 closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();});
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

const media=async()=>{const d=path.join(tmp,'media');if(fs.existsSync(path.join(d,'talk.mp4')))return d;fs.mkdirSync(d,{recursive:true});
 await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=1280x720:r=30:d=10','-f','lavfi','-i','sine=d=10','-shortest','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast','-c:a','aac',path.join(d,'talk.mp4')]);
 await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc=s=1280x720:r=30:d=4','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',path.join(d,'broll.mp4')]);
 await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','sine=f=330:d=20','-c:a','aac',path.join(d,'music.m4a')]);
 await run(ffmpeg,['-v','error','-y','-f','lavfi','-i','color=red:s=200x100','-frames:v','1',path.join(d,'logo.png')]);
 return d;};
const edit={version:1,input:'talk.mp4',operations:[{op:'steady'},{op:'arrange',segments:[{start:6,end:7.5},{start:.5,end:3},{start:4,end:9}]},
 {op:'overlays',items:[{file:'broll.mp4',start:2,end:4,x:.5,y:.5,width:1},{file:'logo.png',start:0,end:3,x:.85,y:.1,width:.12}]},
 {op:'captions',cues:[{start:.2,end:1.4,text:'First, the end'},{start:1.6,end:3.5,text:'Then the start'}]},{op:'music',file:'music.m4a',gainDb:-18},{op:'loudness'}]};

describe('a timeline for another editor',()=>{
 it('follows the edit list: the parts in order, what lies on top moved with them, and what only a render makes',async()=>{
  const X=await import('../src/editor/timeline-export.js'),d=await media();
  const tl=await X.timelineOf(edit,d);
  expect(tl.segments.map(s=>[path.basename(s.file),s.in,s.out])).toEqual([['talk.mp4',6,7.5],['talk.mp4',.5,3],['talk.mp4',4,9]]);
  expect(tl.items.map(i=>[path.basename(i.file),i.start,i.end])).toEqual([['broll.mp4',2,4],['logo.png',0,3],['music.m4a',0,9]]);
  expect(tl.cues).toHaveLength(2);expect(tl.renderOnly).toEqual(['the steady picture','the loudness levelling']);
  // A cut moves what lay after it; a part played twice brings its overlay twice.
  const t2=await X.timelineOf({version:1,input:'talk.mp4',operations:[{op:'overlay',file:'logo.png',start:4,end:6},{op:'cut',ranges:[{start:1,end:3}]},{op:'arrange',segments:[{start:2,end:4},{start:2,end:4}]}]},d);
  expect(t2.items.map(i=>[i.start,i.end])).toEqual([[0,2],[2,4]]);
  expect(X.cutList(t2)[0]).toBe('1. 0:00.00 to 0:02.00: talk.mp4 from 0:04.00 to 0:06.00');
 },60000);
 it('writes Premiere and Resolve XML, FCPXML, an EDL and the captions, into a new folder',async()=>{
  const X=await import('../src/editor/timeline-export.js'),d=await media(),f=path.join(d,'talk.edit.json');fs.writeFileSync(f,JSON.stringify(edit));
  const r=await X.exportTimeline(f,{to:['premiere','resolve','fcp','edl','capcut']});
  expect(path.basename(r.folder)).toBe('talk-timeline');expect(Object.keys(r.files).sort()).toEqual(['captions','edl','fcp','premiere','resolve']);
  const xml=fs.readFileSync(r.files.premiere!,'utf8');
  expect(xml.match(/<clipitem /g)).toHaveLength(9); // 3 picture, their 3 sounds, the b-roll, the logo and the music
  expect(xml).toMatch(/<in>180<\/in><out>225<\/out>/);expect(xml).toMatch(/<pathurl>file:\/\/localhost\//);
  const edl=fs.readFileSync(r.files.edl!,'utf8');expect(edl).toMatch(/^001  R001     AA\/V  C        00:00:06:00 00:00:07:15 00:00:00:00 00:00:01:15$/m);
  expect(fs.readFileSync(r.files.captions!,'utf8')).toMatch(/00:00:00,200 --> 00:00:01,400\nFirst, the end/);
  const readme=fs.readFileSync(path.join(r.folder,'README.txt'),'utf8');expect(readme).toMatch(/CapCut cannot open a timeline/);expect(readme).toMatch(/Made only in the render.*steady picture/);
  // Never over an earlier export.
  expect(path.basename((await X.exportTimeline(f,{to:['edl']})).folder)).toBe('talk-timeline-2');
  // FCPXML against Apple's own document type, when it is at hand (TEMPOLOOM_FCPXML_DTD).
  const dtd=process.env.TEMPOLOOM_FCPXML_DTD;if(dtd)execFileSync('xmllint',['--noout','--dtdvalid',dtd,r.files.fcp!]);
 },90000);
 it.skipIf(!process.env.TEMPOLOOM_OTIO_PYTHONPATH)('reads back in OpenTimelineIO the way an editor would',async()=>{
  const X=await import('../src/editor/timeline-export.js'),d=await media(),f=path.join(d,'otio.edit.json');
  fs.writeFileSync(f,JSON.stringify({version:1,input:'talk.mp4',operations:[{op:'arrange',segments:[{start:6,end:7.5},{start:.5,end:3}]},{op:'overlays',items:[{file:'broll.mp4',start:2,end:4,width:1}]},{op:'music',file:'music.m4a',duck:false}]}));
  const r=await X.exportTimeline(f,{to:['premiere','fcp','edl']});
  const py=`import sys,json,opentimelineio as o
out={}
for f,kw in [(sys.argv[1],{}),(sys.argv[2],{}),(sys.argv[3],{'rate':30})]:
  t=o.adapters.read_from_file(f,**kw)
  if not isinstance(t,o.schema.Timeline): t=list(t.find_children(descended_from_type=o.schema.Timeline))[0] if hasattr(t,'find_children') else t[0]
  out[f.rsplit('.',1)[1]]=[[tr.kind,[[c.name,round(c.source_range.start_time.to_seconds(),2),round(c.source_range.duration.to_seconds(),2),round(c.range_in_parent().start_time.to_seconds(),2)] for c in tr if isinstance(c,o.schema.Clip)]] for tr in t.tracks]
print(json.dumps(out))`;
  const got=JSON.parse(execFileSync('python3',['-c',py,r.files.premiere!,r.files.fcp!,r.files.edl!],{env:{...process.env,PYTHONPATH:process.env.TEMPOLOOM_OTIO_PYTHONPATH},cwd:os.tmpdir()}).toString()) as Record<string,[string,[string,number,number,number][]][]>;
  const picture=[['talk.mp4',6,1.5,0],['talk.mp4',.5,2.5,1.5]];
  for(const k of ['xml','fcpxml','edl'])expect(got[k]!.find(t=>t[0]==='Video')![1].map(c=>[k==='edl'?'talk.mp4':c[0],c[1],c[2],c[3]])).toEqual(picture);
  for(const k of ['xml','fcpxml']){expect(got[k]!.flatMap(t=>t[1]).some(c=>c[0]==='broll.mp4'&&c[3]===2&&c[2]===2)).toBe(true);expect(got[k]!.flatMap(t=>t[1]).some(c=>c[0]==='music.m4a'&&c[2]===4)).toBe(true);}
 },90000);
});

describe('an edit by text, in another editor',()=>{
 it('exports its cuts as a timeline, from the terminal and the page',async()=>{
  const T=await import('../src/editor/text-edit.js'),d=await media(),{serve}=await import('../src/teach/server.js');
  const words=['First','line','here.','Second','line','there.'].map((w,i)=>({text:w,start:.4+i*.5+(i>2?1.5:0),end:.8+i*.5+(i>2?1.5:0),type:'word' as const}));
  const doc=await T.createDoc(path.join(d,'talk.mp4'),{transcript:{language:'en',words},title:'Two lines'});
  T.cutSentence(doc.id,1,true);T.setCaptions(doc.id,true);
  const r=await T.exportDoc(doc.id,['edl']);
  expect(r.clips).toBe(1);expect(fs.readFileSync(r.files.edl!,'utf8')).toMatch(/talk\.mp4/);expect(r.captions).toBeGreaterThan(0);
  const s=await serve({port:0});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key,'content-type':'application/json'};
   const v=await (await fetch(`${base}/api/text/${doc.id}`,{method:'POST',headers:h,body:JSON.stringify({action:'export',to:['premiere','resolve']})})).json() as {timeline:{files:string[]}};
   expect(v.timeline.files).toEqual(['Two-lines.xml','Two-lines.fcpxml','Two-lines.srt','README.txt']);
   expect((await fetch(`${base}/text-file/${doc.id}/timeline/Two-lines.xml`,{headers:{'x-teach-key':s.key}})).status).toBe(200);
   expect((await fetch(`${base}/text-file/${doc.id}/timeline/doc.json`,{headers:{'x-teach-key':s.key}})).status).toBe(404);
   expect((await fetch(`${base}/api/text/${doc.id}`,{method:'POST',headers:h,body:JSON.stringify({action:'export',to:['avid']})})).status).toBe(400);
  }finally{await s.close();}
 },90000);
});

describe('covers, titles and the post package',()=>{
 it('checks the words against each platform, warning before it refuses',async()=>{
  const P=await import('../src/editor/publish.js');
  expect(P.checkPost('youtube',{title:'x'.repeat(101)}).errors[0]).toMatch(/101 characters; YouTube allows 100/);
  expect(P.checkPost('shorts',{title:'A title that is clear but runs on well past the sixty characters shown'}).warnings[0]).toMatch(/cut short on phones/);
  expect(P.checkPost('reels',{caption:'Hi',tags:Array.from({length:31},(_,i)=>'t'+i)}).errors[0]).toMatch(/31 hashtags; Instagram Reels allows 30/);
  expect(P.checkPost('reels',{seconds:200}).errors[0]).toMatch(/up to 3 minutes/);
  expect(P.checkPost('tiktok',{caption:'Short and to the point #one',tags:['two']})).toMatchObject({ok:true,warnings:[],tags:['two','one'],text:'Short and to the point #one #two'});
 });
 it('suggests titles from the strongest lines, short enough to read at a glance',async()=>{
  const P=await import('../src/editor/publish.js');
  const ideas=P.titleIdeas('Hi everyone and welcome back. So today we talk cameras. Why do your shots look flat? Most people make three mistakes with a new camera and never notice. Anyway that is it.');
  expect(ideas[0]!.title).toBe('Why do your shots look flat?');expect(ideas[0]!.why).toContain('asks a question');
  expect(ideas.map(i=>i.title)).toContain('Most people make three mistakes with a new camera and never');
  expect(ideas.every(i=>[...i.title].length<=60)).toBe(true);
 });
 it('makes covers from different frames, each with each title, and a sheet to compare them',async()=>{
  const P=await import('../src/editor/publish.js'),d=await media();
  const r=await P.thumbnailSet(path.join(d,'talk.mp4'),{titles:['Five camera mistakes','Why it looks flat'],count:2});
  expect(r.covers.map(c=>c.name)).toEqual(['cover-1a','cover-1b','cover-2a','cover-2b']);
  expect(Math.abs(r.covers[0]!.at-r.covers[2]!.at)).toBeGreaterThanOrEqual(10/3);
  expect(new Set(r.covers.map(c=>c.layout)).size).toBeGreaterThan(1);
  for(const c of r.covers){expect(fs.statSync(c.jpg).size).toBeGreaterThan(5000);}
  expect(fs.existsSync(r.sheet)).toBe(true);
  expect(path.basename((await P.thumbnailSet(path.join(d,'talk.mp4'),{count:1,at:2})).folder)).toBe('talk-covers-2');
 },120000);
 it('packs the video in each platform\'s shape with its cover, captions and the checked words',async()=>{
  const P=await import('../src/editor/publish.js'),d=await media();
  const r=await P.postPackage(path.join(d,'talk.mp4'),{platforms:['tiktok','youtube'],title:'Five camera mistakes',caption:'Which one did you make?',tags:['camera'],cues:[{start:.5,end:2,text:'Five mistakes'}]});
  expect(Object.keys(r.videos).sort()).toEqual(['16:9','9:16']);
  const {mediaInfo}=await import('../src/editor/editor.js'),v=await mediaInfo(r.videos['9:16']!);expect(v.height/v.width).toBeCloseTo(16/9,1);expect(v.hasAudio).toBe(true);
  expect(fs.readFileSync(r.captions!,'utf8')).toMatch(/Five mistakes/);
  expect(r.ready).toBe(true);const md=fs.readFileSync(r.post,'utf8');expect(md).toMatch(/## TikTok[\s\S]*Which one did you make\? #camera[\s\S]*## YouTube[\s\S]*Title: Five camera mistakes/);
 },180000);
 it('is on the gallery page: the checks as you type, covers, and the package to download',async()=>{
  const d=await media();fs.copyFileSync(path.join(d,'talk.mp4'),path.join(env.VIDEO_OUTPUT,'talk-final.mp4'));
  const G=await import('../src/engine/gallery.js'),{serve}=await import('../src/teach/server.js'),id=(await G.gallery()).items.find(i=>i.file.endsWith('talk-final.mp4'))!.id;
  const s=await serve({port:0});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key,'content-type':'application/json'},post=(w:string,b:object)=>fetch(`${base}/api/gallery/${id}/${w}`,{method:'POST',headers:h,body:JSON.stringify(b)});
   const checks=await (await post('check',{platforms:['youtube'],title:'x'.repeat(120)})).json() as {ok:boolean}[];expect(checks[0]!.ok).toBe(false);
   const c=await (await post('covers',{titles:['One title'],count:1})).json() as {key:string;covers:{file:string}[]};
   const img=await fetch(`${base}/publish-file/${c.key}/${c.covers[0]!.file}`,{headers:{'x-teach-key':s.key}});expect(img.status).toBe(200);
   expect((await fetch(`${base}/publish-file/${c.key}/..%2F..%2Fstate.json`,{headers:{'x-teach-key':s.key}})).status).toBe(404);
  }finally{await s.close();}
 },120000);
});
