// The gallery: every video the agent made, from studio steps, finished jobs and the export folder.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-gallery-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),VIDEO_OUTPUT:path.join(tmp,'out'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know')},before={...process.env};
const clip=async(f:string,color:string)=>{fs.mkdirSync(path.dirname(f),{recursive:true});await run(ffmpeg,['-v','error','-y','-f','lavfi','-i',`color=c=${color}:s=180x320:d=2:r=25`,'-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',f]);return f;};
let closeDb:()=>void;
beforeAll(async()=>{Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();},60000);
afterAll(()=>{closeDb();for(const k of Object.keys(env))before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

describe('the gallery',()=>{
 it('lists what the studio showed, what jobs recorded and the export folder, each file once',async()=>{
  const st=await import('../src/engine/studio.js'),G=await import('../src/engine/gallery.js'),brain=await import('../src/engine/brain/brain.js');
  const job=st.plan('A 30 second ad for cold brew',{type:'script-to-motion',job:'g1'}).job;
  const out=(n:string)=>{const f=path.join(st.jobDir(job),n);fs.writeFileSync(f,'x');return f;};
  const preview=await clip(path.join(env.VIDEO_OUTPUT,'previews','cold-brew-preview.mp4'),'0x0B3B3C'),final=await clip(path.join(env.VIDEO_OUTPUT,'cold-brew.mp4'),'0xFF6B4A');
  const loose=await clip(path.join(env.VIDEO_OUTPUT,'older','holiday-ad.mp4'),'0x334455');fs.writeFileSync(path.join(env.VIDEO_OUTPUT,'notes.txt'),'not a video');
  for(const t of ['intake','brief','research','style','storyboard','sound','design']){const s=st.start(job,t) as {writeTo?:string};st.done(job,t,{applied:['none'],output:out(path.basename(s.writeTo!))});}
  st.approve(job,'design-ok');st.start(job,'build');st.done(job,'build',{applied:['none'],output:out('preview.md'),show:[preview]});
  await st.rate(job,'build',{rating:'good'});
  for(const t of ['review']){const s=st.start(job,t) as {writeTo?:string};st.done(job,t,{applied:['none'],output:out(path.basename(s.writeTo!))});}
  st.approve(job,'preview-ok');st.start(job,'final');st.done(job,'final',{applied:['none'],output:out('delivery.md'),show:[final]});
  brain.recordJob({id:'made-by-make',kind:'video',title:'Cold brew, the make command',output:final});
  const g=await G.gallery();
  expect(g.items).toHaveLength(3);expect(g.totals).toMatchObject({all:3,finals:1,previews:1,exports:1});
  const f=g.items.find(i=>i.name==='cold-brew.mp4')!,p=g.items.find(i=>i.name==='cold-brew-preview.mp4')!,l=g.items.find(i=>i.name==='holiday-ad.mp4')!;
  expect(f).toMatchObject({kind:'final',mode:'motion',job:'g1',step:'final',width:180,height:320}); // the studio's record wins over the bare job output
  expect(f.seconds).toBeCloseTo(2,0);expect(p).toMatchObject({kind:'preview',rating:'good',job:'g1'});expect(l).toMatchObject({kind:'export',job:null,title:'holiday ad'});
  // Stars and hiding are kept; hiding never touches the file.
  G.star(f.id,true);G.hide(l.id,true);
  const g2=await G.gallery();expect(g2.items.map(i=>i.name).sort()).toEqual(['cold-brew-preview.mp4','cold-brew.mp4']);expect(g2.hidden).toBe(1);expect(g2.items.find(i=>i.id===f.id)!.starred).toBe(true);
  expect(fs.existsSync(loose)).toBe(true);expect((await G.gallery({hidden:true})).items).toHaveLength(3);
  expect(await G.galleryFile(f.id)).toBe(final);await expect(G.galleryFile('0000000000000000')).rejects.toThrow(/No such video/);
  const thumb=await G.galleryThumb(f.id);expect(fs.statSync(thumb).size).toBeGreaterThan(300);expect(await G.galleryThumb(f.id)).toBe(thumb);
 },120000);

 it('sorts videos by itself, keeps your rating, and deletes only inside the project',async()=>{
  const G=await import('../src/engine/gallery.js'),C=await import('../src/engine/categories.js'),brain=await import('../src/engine/brain/brain.js');
  // The kind of video comes from the words of the brief or the name, then from how it was made.
  expect(C.videoKind('A 30 second ad for cold brew')).toBe('ad');expect(C.videoKind('launch teaser final')).toBe('teaser');expect(C.videoKind('how to brew tutorial')).toBe('explainer');
  expect(C.videoKind('interview podcast cut')).toBe('talk');expect(C.videoKind('my clip',{mode:'edit'})).toBe('talk');expect(C.videoKind('clip 7',{seconds:12,shape:'vertical'})).toBe('short');expect(C.videoKind('clip 7',{seconds:80,shape:'horizontal'})).toBe('other');
  expect(C.groupOfTopic('pacing')).toBe('edit');expect(C.groupOfTopics(['color','typography','script'])).toBe('motion');expect(C.groupOfTopics(['captions'])).toBe('story');
  expect(C.lengthTag(12)).toBe('Under 20 s');expect(C.shapeOf(180,320)).toBe('vertical');expect(C.styleTags(null)).toEqual([]);
  const outside=await clip(path.join(tmp,'elsewhere','client-talk.mp4'),'0x223344');brain.recordJob({id:'made-elsewhere',kind:'video',title:'Client interview',output:outside});
  const g=await G.gallery({hidden:true});
  const f=g.items.find(i=>i.name==='cold-brew.mp4')!,l=g.items.find(i=>i.name==='holiday-ad.mp4')!,o=g.items.find(i=>i.name==='client-talk.mp4')!;
  expect(f.category).toBe('ad');expect(l.category).toBe('ad');expect(o.category).toBe('talk');expect(f.tags).toContain('Vertical');
  expect(g.categories.find(c=>c.id==='ad')!.count).toBeGreaterThanOrEqual(2);
  expect(l.canDelete).toBe(true);expect(o.canDelete).toBe(false);
  // A rating is kept with the gallery; a bad one needs a reason.
  await expect(G.rateVideo(l.id,'bad','')).rejects.toThrow(/what is wrong/);await expect(G.rateVideo('0000000000000000','good')).rejects.toThrow(/No such video/);
  await G.rateVideo(l.id,'bad','The cuts are too slow.');
  let again=(await G.gallery({hidden:true})).items.find(i=>i.id===l.id)!;expect(again).toMatchObject({rating:'bad',ratedHere:true,note:'The cuts are too slow.'});
  await G.rateVideo(l.id,'good');expect((await G.gallery({hidden:true})).totals.good).toBeGreaterThanOrEqual(1);
  G.clearRating(l.id);again=(await G.gallery({hidden:true})).items.find(i=>i.id===l.id)!;expect(again.rating).toBeNull();expect(again.ratedHere).toBe(false);
  // Deleting removes the file for good, but never one outside the export folder and workspace.
  await expect(G.deleteVideo(o.id)).rejects.toThrow(/outside/);expect(fs.existsSync(outside)).toBe(true);
  const loose=path.join(env.VIDEO_OUTPUT,'older','holiday-ad.mp4');await G.galleryThumb(l.id);
  expect(await G.deleteVideo(l.id)).toMatchObject({deleted:'holiday-ad.mp4'});expect(fs.existsSync(loose)).toBe(false);
  const after=await G.gallery({hidden:true});expect(after.items.some(i=>i.id===l.id)).toBe(false);expect(after.hidden).toBe(0);
  await expect(G.deleteVideo(l.id)).rejects.toThrow(/No such video/);
 },120000);
 it('serves the gallery: list, play, thumbnail, star, and teach from a video',async()=>{
  const {serve}=await import('../src/teach/server.js');const s=await serve({port:0});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key},jh={...h,'content-type':'application/json'};
   expect((await fetch(base+'/gallery.js')).status).toBe(200);expect((await fetch(base+'/api/gallery')).status).toBe(403);
   const g=await (await fetch(base+'/api/gallery',{headers:h})).json() as {items:{id:string;name:string;starred:boolean}[]};
   const v=g.items.find(i=>i.name==='cold-brew.mp4')!;
   const play=await fetch(base+`/gallery/file/${v.id}`,{headers:{...h,range:'bytes=0-9'}});expect(play.status).toBe(206);expect(play.headers.get('content-type')).toBe('video/mp4');
   expect((await fetch(base+`/gallery/thumb/${v.id}`,{headers:h})).headers.get('content-type')).toBe('image/jpeg');
   expect((await fetch(base+`/gallery/file/${v.id}?dl=1`,{headers:h})).headers.get('content-disposition')).toContain('attachment');
   expect((await fetch(base+'/gallery/file/ffffffffffffffff',{headers:h})).status).toBe(404);
   expect((await fetch(base+`/api/gallery/${v.id}/star`,{method:'POST',headers:jh,body:JSON.stringify({on:false})})).status).toBe(200);
   expect((await fetch(base+'/learned.js')).status).toBe(200);
   const rate=(id:string,body:object)=>fetch(base+`/api/gallery/${id}/rate`,{method:'POST',headers:jh,body:JSON.stringify(body)});
   const p=g.items.find(i=>i.name==='cold-brew-preview.mp4')!;
   expect((await rate(p.id,{rating:'bad'})).status).toBe(400);expect((await rate('ffffffffffffffff',{rating:'good'})).status).toBe(404);
   expect(await (await rate(p.id,{rating:'ok'})).json()).toMatchObject({rating:'ok'});expect(await (await rate(p.id,{rating:null})).json()).toMatchObject({rating:null});
   const extra=await clip(path.join(env.VIDEO_OUTPUT,'spare-promo.mp4'),'0x556677');
   const sp=(await (await fetch(base+'/api/gallery',{headers:h})).json() as {items:{id:string;name:string}[]}).items.find(i=>i.name==='spare-promo.mp4')!;
   expect((await fetch(base+`/api/gallery/${sp.id}`,{method:'DELETE'})).status).toBe(403);expect(fs.existsSync(extra)).toBe(true);
   expect((await fetch(base+`/api/gallery/${sp.id}`,{method:'DELETE',headers:h})).status).toBe(200);expect(fs.existsSync(extra)).toBe(false);
   expect((await fetch(base+`/api/gallery/${sp.id}`,{method:'DELETE',headers:h})).status).toBe(404);
   const d=await (await fetch(base+`/api/gallery/${v.id}/teach`,{method:'POST',headers:jh,body:'{}'})).json() as {id:string;status:string;source:{kind:string}};
   expect(d).toMatchObject({status:'draft',source:{kind:'file'}});expect(fs.existsSync(path.join(env.VIDEO_OUTPUT,'cold-brew.mp4'))).toBe(true);
  }finally{await s.close();}
 },60000);
});
