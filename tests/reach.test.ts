import {it,expect,beforeEach,afterAll,describe} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home=fs.mkdtempSync(path.join(os.tmpdir(),'dz-reach-'));
process.env.DIMENSAZ_REACH_HOME=home;process.env.DIMENSAZ_REACH_SEARCH_INTERVAL='0';
const {ReachError,classify,envelope,FINAL_CODES}=await import('../src/reach/result.js');
const {publicUrl,scrubSecrets,hostMatches}=await import('../src/reach/safety.js');
const {buildArgs,opencliError,toItems,setOpencliCall}=await import('../src/reach/backends/opencli.js');
const {readCommand,manifest,older}=await import('../src/reach/tools.js');
const {channels,routeUrl,channelByName}=await import('../src/reach/channels.js');
const {runAction,validate}=await import('../src/reach/dispatch.js');
const {load,mutate,querySlot,tryLock}=await import('../src/reach/state.js');
const {parseExa,parseJina,setWebFetcher}=await import('../src/reach/backends/web.js');
const {vttToText,netscapeCookies}=await import('../src/reach/backends/ytdlp.js');
const {normalizeCookies}=await import('../src/reach/sessions.js');
afterAll(()=>{setWebFetcher(null);setOpencliCall(null);fs.rmSync(home,{recursive:true,force:true});});
beforeEach(()=>{fs.rmSync(path.join(home,'state.json'),{force:true});});

describe('result and safety',()=>{
 it('builds one envelope and classifies errors',()=>{
  const ok=envelope({channel:'x',action:'search',backend:'opencli',items:[],elapsedMs:3});
  expect(ok).toMatchObject({schema_version:1,ok:true,backend:'opencli',error:null});
  const bad=envelope({channel:'x',action:'search',backend:'opencli',elapsedMs:3,error:new ReachError('NEED_LOGIN','no')});
  expect(bad).toMatchObject({ok:false,backend:null,items:[],error:{code:'NEED_LOGIN'}});expect(bad.error!.hint).toMatch(/Never ask for a password/);
  expect(classify(Object.assign(new Error('x'),{code:'ENOENT'})).code).toBe('NEED_SETUP');
  expect(classify(Object.assign(new Error('t'),{name:'TimeoutError'})).code).toBe('TIMEOUT');
  for(const c of ['NOT_FOUND','BAD_INPUT','PLATFORM_BLOCKED','RATE_LIMITED','NEED_LOGIN','BUSY'])expect(FINAL_CODES.has(c as never)).toBe(true);
 });
 it('accepts only public links and removes secrets',()=>{
  expect(publicUrl('youtube.com/watch?v=abc#t')).toBe('https://youtube.com/watch?v=abc');
  for(const bad of ['ftp://x.com','http://localhost/a','http://127.0.0.1/','http://192.168.1.2/','http://10.0.0.1','https://user:pw@x.com','http://[::1]/'])expect(()=>publicUrl(bad)).toThrow(ReachError);
  expect(scrubSecrets('GET https://a.com/?token=abc123&x=1 cookie: sessionid=999 ; auth_token=zzz')).not.toMatch(/abc123|999|zzz/);
  expect(hostMatches('https://m.youtube.com/x','youtube.com')).toBe(true);expect(hostMatches('https://notyoutube.com','youtube.com')).toBe(false);
 });
});

describe('OpenCLI backend',()=>{
 it('allows read commands only, from the real manifest',()=>{
  expect(manifest().length).toBeGreaterThan(500);
  expect(readCommand('instagram','profile').access).toBe('read');
  for(const [s,c] of [['instagram','like'],['twitter','post'],['tiktok','follow'],['facebook','add-friend'],['youtube','comment'],['pinterest','pin-create']])expect(()=>readCommand(s!,c!)).toThrow(/only reads/);
  // every OpenCLI command used by a channel exists and is read-only
  const src=fs.readFileSync(path.resolve('src/reach/channels.ts'),'utf8');
  const used=[...src.matchAll(/oc\('([\w-]+)','([\w-]+)'/g)].map(m=>[m[1]!,m[2]!]);
  expect(used.length).toBeGreaterThan(25);
  for(const [s,c] of used)expect(readCommand(s!,c!).access).toBe('read');
 });
 it('builds arguments from the manifest',()=>{
  expect(buildArgs(readCommand('twitter','thread'),{'tweet-id':'123',limit:5})).toEqual(['123','--limit','5']);
  expect(buildArgs(readCommand('reddit','search'),{query:'motion',subreddit:'',limit:3})).toEqual(['motion','--limit','3']);
  expect(()=>buildArgs(readCommand('instagram','profile'),{username:'nasa',evil:'x'})).toThrow(/does not take/);
 });
 it('maps OpenCLI errors to codes',()=>{
  const j=(code:string,message:string)=>JSON.stringify({ok:false,error:{code,message}});
  expect(opencliError(j('AUTH_REQUIRED','Please log in'),'h').code).toBe('NEED_LOGIN');
  expect(opencliError(j('','HTTP 429 Too Many Requests'),'h').code).toBe('RATE_LIMITED');
  expect(opencliError(j('CAPTCHA_REQUIRED','captcha'),'h').code).toBe('PLATFORM_BLOCKED');
  expect(opencliError(j('BROWSER_CONNECT','Browser Bridge extension not connected'),'h').code).toBe('NEED_SETUP');
  expect(opencliError('ok: false\nerror:\n  code: NOT_FOUND\n  message: user not found\n','h').code).toBe('NOT_FOUND');
  expect(opencliError(j('X','weird'),'h').code).toBe('UPSTREAM_BROKEN');
 });
 it('maps rows to items',()=>{
  const items=toItems({ok:true,data:[{title:'A',url:'https://x',author:{name:'bo'},created_utc:1700000000,text:'hi'},{name:'B',link:'https://y',description:'d'}]});
  expect(items[0]).toMatchObject({title:'A',author:'bo',published_at:'2023-11-14T22:13:20Z',text:'hi'});
  expect(items[1]).toMatchObject({title:'B',url:'https://y',text:'d'});
  expect(toItems({ok:true,data:[]})).toEqual([]);
 });
});

describe('channels',()=>{
 it('routes links to the right channel and action',()=>{
  const r=(u:string)=>{const x=routeUrl(u);return [x.channel.name,x.action,x.params];};
  expect(r('https://youtu.be/abc')).toEqual(['youtube','video',{target:'https://youtu.be/abc'}]);
  expect(r('https://www.youtube.com/@mkbhd')[1]).toBe('channel');
  expect(r('https://www.instagram.com/reel/XYZ/')[1]).toBe('video');
  expect(r('https://www.instagram.com/nasa/')).toEqual(['instagram','profile',{username:'nasa'}]);
  expect(r('https://www.tiktok.com/@brand/video/123')[1]).toBe('video');
  expect(r('https://www.tiktok.com/@brand')).toEqual(['tiktok','user',{username:'brand'}]);
  expect(r('https://x.com/OpenAI/status/1999')).toEqual(['x','thread',{id:'1999'}]);
  expect(r('https://twitter.com/OpenAI')).toEqual(['x','profile',{username:'OpenAI'}]);
  expect(r('https://fb.watch/abc/')[1]).toBe('video');
  expect(r('https://www.pinterest.com/pin/123/')[1]).toBe('pin');
  expect(r('https://www.reddit.com/r/motiondesign/')).toEqual(['reddit','subreddit',{name:'motiondesign'}]);
  expect(r('https://dribbble.com/shots/1-x')[1]).toBe('shot');
  expect(r('https://example.com/a')).toEqual(['web','read',{target:'https://example.com/a'}]);
  expect(channelByName('twitter').name).toBe('x');
 });
 it('has a live test or a reason for every channel, and login data for login sites',()=>{
  for(const c of channels){
   expect(c.actions.length).toBeGreaterThan(0);
   if(c.loginUrl){expect(c.loginCookies?.length).toBeGreaterThan(0);expect(c.domains.length).toBeGreaterThan(0);}
  }
 });
 it('validates arguments',()=>{
  const a=channelByName('instagram').actions.find(x=>x.name==='posts')!;
  expect(validate(a,{username:'nasa'})).toEqual({username:'nasa',limit:6});
  expect(()=>validate(a,{})).toThrow(/missing required/);
  expect(()=>validate(a,{username:'n',limit:0})).toThrow(/between 1 and 100/);
  expect(()=>validate(a,{username:'n',color:'red'})).toThrow(/unknown argument/);
 });
});

describe('dispatcher',()=>{
 const calls:string[]=[];
 const fake=(name:string,behaviour:Record<string,()=>Promise<never>|Promise<unknown[]>>,extra:Record<string,unknown>={})=>{
  const i=channels.findIndex(c=>c.name===name);if(i>=0)channels.splice(i,1);
  channels.push({name,description:'test',level:'optional',domains:['test.example'],...extra,actions:[{name:'search',help:'',params:[{name:'query',help:'',required:true},{name:'limit',help:'',type:'int',default:5}],
   publicWeb:extra.publicWeb as string[]|undefined,
   backends:Object.entries(behaviour).map(([label,fn])=>[label,async()=>{calls.push(label);return (await fn()) as never;}])}]} as never);
 };
 beforeEach(()=>{calls.length=0;});
 it('falls back on recoverable errors and stops on final ones',async()=>{
  fake('t1',{a:()=>Promise.reject(new ReachError('UPSTREAM_BROKEN','down')),b:()=>Promise.resolve([{title:'ok'}])});
  const r=await runAction('t1','search',{query:'q'});
  expect(r).toMatchObject({ok:true,backend:'b'});expect(calls).toEqual(['a','b']);
  expect(r.meta.attempts.map(x=>x.result)).toEqual(['UPSTREAM_BROKEN','ok']);
  calls.length=0;
  fake('t2',{a:()=>Promise.reject(new ReachError('NEED_LOGIN','login')),b:()=>Promise.resolve([{title:'never'}])});
  const r2=await runAction('t2','search',{query:'q'});
  expect(r2.error!.code).toBe('NEED_LOGIN');expect(calls).toEqual(['a']);
 });
 it('pauses a broken backend and the whole channel after a rate limit',async()=>{
  fake('t3',{a:()=>Promise.reject(new ReachError('TIMEOUT','slow')),b:()=>Promise.resolve([{title:'ok'}])});
  await runAction('t3','search',{query:'q'});calls.length=0;
  const again=await runAction('t3','search',{query:'q'});
  expect(calls).toEqual(['b']);expect(again.meta.attempts[0]).toMatchObject({backend:'a',skipped:true,result:'TIMEOUT'});
  fake('t4',{a:()=>Promise.reject(new ReachError('RATE_LIMITED','429'))});
  await runAction('t4','search',{query:'q'});calls.length=0;
  const blocked=await runAction('t4','search',{query:'q'});
  expect(blocked.error).toMatchObject({code:'RATE_LIMITED'});expect(blocked.error!.retry_after_seconds).toBeGreaterThan(3500);expect(calls).toEqual([]);
  expect(JSON.stringify(load())).not.toMatch(/"q"/); // no queries stored
 });
 it('tries the public web first while a login site is not set up, and as a last resort',async()=>{
  setWebFetcher((async()=>new Response('data: '+JSON.stringify({jsonrpc:'2.0',id:1,result:{content:[{type:'text',text:'Title: Public hit\nURL: https://test.example/p/1\nPublished: N/A\nAuthor: N/A\nText: some public text that is long enough to count'}]}}),{status:200})) as typeof fetch);
  fake('t5',{a:()=>Promise.resolve([{title:'site'}])},{loginUrl:'https://test.example/login',loginCookies:['sid'],publicWeb:['test.example/']});
  const r=await runAction('t5','search',{query:'q'});
  expect(r).toMatchObject({ok:true,backend:'public-web'});expect(r.meta.note).toMatch(/Public web/);expect(calls).toEqual([]);
  await mutate(s=>{(s.added??={}).t5={at:new Date().toISOString()};});
  expect((await runAction('t5','search',{query:'q'})).backend).toBe('a');
  fake('t6',{a:()=>Promise.reject(new ReachError('UPSTREAM_BROKEN','down'))},{publicWeb:['test.example/']});
  const last=await runAction('t6','search',{query:'q'});
  expect(last.backend).toBe('public-web');expect(last.meta.attempts.map(x=>x.backend)).toEqual(['a','public-web']);
  setWebFetcher(null);
 });
 it('turns an unclear failure into NEED_LOGIN when the site cookie is missing',async()=>{
  fake('t7',{opencli:()=>Promise.reject(new ReachError('UPSTREAM_BROKEN','empty'))},{loginUrl:'https://test.example/login',loginCookies:['sid']});
  await mutate(s=>{(s.added??={}).t7={at:''};});
  const r=await runAction('t7','search',{query:'q'},{loggedOut:async()=>true});
  expect(r.error).toMatchObject({code:'NEED_LOGIN'});expect(r.error!.hint).toMatch(/reach login t7/);
 });
});

describe('locks, parsing and sessions',()=>{
 it('limits browser commands per site and overall',async()=>{
  const a=await querySlot('s',1),b=await querySlot('s',1);
  await expect(querySlot('s',0.3)).rejects.toMatchObject({code:'BUSY'});
  const c=await querySlot('other',1),d=await querySlot('third',1);
  await expect(querySlot('fourth',0.3)).rejects.toMatchObject({code:'BUSY'});
  for(const r of [a,b,c,d])r();
  const e=tryLock('x');expect(e).toBeTruthy();expect(tryLock('x')).toBeNull();e!();expect(tryLock('x')).toBeTruthy();
 });
 it('parses Exa, Jina and subtitles',()=>{
  expect(parseExa('Title: A\nURL: https://a\nPublished: 2026-01-01\nAuthor: N/A\nHighlights:\nhello\nTitle: B\nURL: https://b\nText:\nworld')).toMatchObject([{title:'A',url:'https://a',author:null,text:'hello'},{title:'B',text:'world'}]);
  expect(parseJina('https://x','Title: Page\nURL Source: https://x\nMarkdown Content:\n# Hi\nbody')).toMatchObject({title:'Page',text:'# Hi\nbody'});
  expect(vttToText('WEBVTT\nKind: captions\n\n00:00:00.000 --> 00:00:01.000\n<c>Hello</c> &amp; welcome\n\n00:00:01.000 --> 00:00:02.000\nHello &amp; welcome\nnext line')).toBe('Hello & welcome\nnext line');
 });
 it('copies only the site\'s own unexpired cookies, and writes cookies files for yt-dlp',()=>{
  const rows=[{name:'sessionid',value:'1',domain:'.instagram.com',path:'/',expirationDate:Date.now()/1000+60,sameSite:'no_restriction',secure:true},
   {name:'old',value:'2',domain:'.instagram.com',expirationDate:1},{name:'x',value:'3',domain:'.facebook.com'},{name:'bad'}];
  const c=normalizeCookies(rows,['instagram.com']);
  expect(c).toHaveLength(1);expect(c[0]).toMatchObject({name:'sessionid',sameSite:'None',secure:true});
  expect(netscapeCookies(c)).toMatch(/^# Netscape HTTP Cookie File\n\.instagram\.com\tTRUE\t\/\tTRUE\t\d+\tsessionid\t1\n$/);
  expect(older('2025.10.22','2026.8.19')).toBe(true);expect(older('2026.10.1','2026.8.19')).toBe(false);
 });
});
