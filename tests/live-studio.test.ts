// The Live studio, the shared tool layer (and its MCP server) and the Models and keys settings.
import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tl-live-'));
const env={VIDEO_WORKSPACE:path.join(tmp,'ws'),TEMPOLOOM_BRAIN_DIR:path.join(tmp,'brain'),TEMPOLOOM_BRAIN_DB:path.join(tmp,'brain.db'),TEMPOLOOM_KNOWLEDGE_DIR:path.join(tmp,'know'),
 TEMPOLOOM_SETTINGS_DIR:path.join(tmp,'settings'),TEMPOLOOM_STATE_FILE:path.join(tmp,'state.json'),TEMPOLOOM_ENV_FILE:path.join(tmp,'test.env'),TEMPOLOOM_KEYCHAIN:'off'},before={...process.env};
const KEYS=['OPENROUTER_API_KEY','ANTHROPIC_API_KEY','FAL_KEY','LOCAL_OLLAMA_API_KEY'];
let closeDb:()=>void;
beforeAll(async()=>{for(const k of KEYS)delete process.env[k];Object.assign(process.env,env);fs.mkdirSync(env.TEMPOLOOM_KNOWLEDGE_DIR,{recursive:true});
 closeDb=(await import('../src/engine/brain/db.js')).closeDb;(await import('../src/engine/brain/brain.js')).sync();});
afterAll(()=>{closeDb();for(const k of [...Object.keys(env),...KEYS])before[k]===undefined?delete process.env[k]:process.env[k]=before[k];fs.rmSync(tmp,{recursive:true,force:true});});

/** A pretend provider: answers each URL it knows with JSON, refuses a wrong key. */
const fake=(routes:Record<string,unknown>,key='sk-good-key-123456'):typeof fetch=>(async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=String(input),h=new Headers(init?.headers),auth=h.get('authorization')??h.get('x-api-key')??'';
 if(auth&&!auth.endsWith(key))return new Response('{}',{status:401});
 const hit=Object.entries(routes).find(([u])=>url.startsWith(u));
 return hit?new Response(JSON.stringify(hit[1]),{status:200,headers:{'content-type':'application/json'}}):new Response('{}',{status:404});}) as typeof fetch;
const openrouter={'https://openrouter.ai/api/v1/key':{data:{limit_remaining:4.5}},'https://openrouter.ai/api/v1/models':{data:[
 {id:'anthropic/claude-sonnet',name:'Claude Sonnet',context_length:200000,architecture:{input_modalities:['text','image'],output_modalities:['text']},supported_parameters:['tools'],pricing:{prompt:'0.000003',completion:'0.000015'}},
 {id:'google/gemini-image',name:'Gemini image',architecture:{input_modalities:['text','image'],output_modalities:['image','text']},supported_parameters:[],pricing:{prompt:'0',completion:'0'}},
 {id:'small/no-tools',name:'No tools',architecture:{input_modalities:['text'],output_modalities:['text']},supported_parameters:[]}]}};

describe('the Live studio',()=>{
 it('logs every step as an event and shows the team with the face of what each is doing',async()=>{
  const st=await import('../src/engine/studio.js'),ev=await import('../src/engine/studio-events.js'),L=await import('../src/engine/studio-live.js');
  const job=st.plan('A 20 second teaser for a coffee app',{type:'script-to-motion',job:'live-a'}).job;
  st.start(job,'intake');
  const said=ev.say(job,'intake','director','Reading your brief and what the studio knows','listening');
  expect(said).toMatchObject({type:'agent.say',face:'listening',role:'director'});
  expect(()=>ev.say(job,'intake','director','x','grinning')).toThrow(/Unknown face/);
  expect(ev.emit('no-such-job',{type:'tool',text:'x'})).toBeNull();
  let v=L.live(job);
  const director=v.team.find(m=>m.id==='director')!;
  expect(director).toMatchObject({face:'listening',state:'Reading your brief and what the studio knows',step:'intake'});
  expect(v.driver.state).toBe('working');
  const f=path.join(st.jobDir(job),'intake.md');fs.writeFileSync(f,'what the studio knows');
  st.done(job,'intake',{output:f,applied:['none']});
  v=L.live(job);
  expect(v.events.map(e=>e.type)).toEqual(['job.planned','step.started','agent.say','step.done']);
  expect(v.team.find(m=>m.id==='director')!.face).toBe('listening'); // its brief step is ready to start
  expect(L.live(job,3).events.map(e=>e.seq)).toEqual([4]);
  expect(L.liveJobs()[0]).toMatchObject({job,active:true,done:1,face:'done'});
  // One face for the agent: every step and every line said sets the file the old mascot viewer
  // and `tempoloom status` use, and the app's sidebar reads it.
  ev.say(job,'brief','director','Asking only what is missing','thinking');
  expect(JSON.parse(fs.readFileSync(env.TEMPOLOOM_STATE_FILE,'utf8'))).toMatchObject({state:'thinking',detail:'Asking only what is missing',job,role:'director'});
  expect(L.agentNow()).toMatchObject({face:'thinking',who:'Director',job,recent:true});
  fs.writeFileSync(env.TEMPOLOOM_STATE_FILE,JSON.stringify({state:'rendering',detail:'scene 3 of 7',updated:Math.floor(Date.now()/1000)-3*3600}));
  expect(L.agentNow()).toMatchObject({face:'idle',detail:'scene 3 of 7',recent:false});
  fs.writeFileSync(env.TEMPOLOOM_STATE_FILE,JSON.stringify({state:'rendering',detail:'old',updated:Math.floor(Date.now()/1000)-3*86400}));
  expect(L.agentNow().face).toBe('sleeping');
  expect((await import('../src/engine/home.js')).home().mascot.face).toBe('sleeping');
 });
});

describe('the shared tools and the MCP server',()=>{
 it('checks every input, keeps secrets out and writes only inside the job',async()=>{
  const T=await import('../src/engine/agent-tools.js');
  expect(T.TOOLS.every(t=>(T.schemaOf(t) as {type:string}).type==='object')).toBe(true);
  await expect(T.callTool('studio_next',{job:'Bad Name'})).rejects.toThrow(/studio_next: job/);
  expect(await T.callTool('studio_next',{job:'live-a'})).toMatchObject({job:'live-a',done:1});
  expect(()=>T.readable('.env')).toThrow(/private/);
  expect(()=>T.readable('.tempoloom/settings.json')).toThrow(/private/);
  expect(()=>T.readable('../outside.txt')).toThrow(/inside the project/);
  expect(T.readable('agent/policies.md').text).toContain('policies');
  await expect(T.callTool('write_job_file',{job:'live-a',name:'../escape.md',text:'x'})).rejects.toThrow(/by name only/);
  const w=await T.callTool('write_job_file',{job:'live-a',name:'notes.md',text:'hello'}) as {file:string};
  expect(path.dirname(w.file)).toBe(path.join(env.VIDEO_WORKSPACE,'studio','live-a'));
  expect((await T.callTool('studio_say',{job:'live-a',task:'brief',text:'Writing the brief now',face:'planning'}))).toMatchObject({face:'planning'});
 });
 it('answers MCP over stdio: initialize, list and call',async()=>{
  const child=spawn(process.execPath,['--import','tsx','src/cli/mcp-cli.ts'],{env:process.env,stdio:['pipe','pipe','pipe']});
  const lines:string[]=[];let buf='';child.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){lines.push(buf.slice(0,i));buf=buf.slice(i+1);}});
  const send=(m:object)=>child.stdin.write(JSON.stringify(m)+'\n');
  send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}});
  send({jsonrpc:'2.0',method:'notifications/initialized'});
  send({jsonrpc:'2.0',id:2,method:'tools/list'});
  send({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'studio_status',arguments:{job:'live-a'}}});
  send({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'read_file',arguments:{file:'.env'}}});
  send({jsonrpc:'2.0',id:5,method:'nope'});
  for(let i=0;i<200&&lines.length<5;i++)await new Promise(r=>setTimeout(r,50));
  child.kill();
  const by=Object.fromEntries(lines.map(l=>JSON.parse(l)).map(m=>[m.id,m]));
  expect(by[1].result).toMatchObject({protocolVersion:'2025-06-18',serverInfo:{name:'tempoloom'}});
  expect(by[2].result.tools.map((t:{name:string})=>t.name)).toContain('studio_start');
  expect(JSON.parse(by[3].result.content[0].text)).toMatchObject({job:'live-a'});
  expect(by[4].result).toMatchObject({isError:true});
  expect(by[5].error.code).toBe(-32601);
 },30000);
});

describe('Models and keys',()=>{
 it('saves a key out of sight, reads the model list and what each model can do',async()=>{
  const S=await import('../src/engine/models/settings.js');
  await expect(S.saveKey('OPENROUTER_API_KEY','short')).rejects.toThrow(/does not look like a key/);
  expect(await S.saveKey('OPENROUTER_API_KEY','sk-good-key-123456')).toMatchObject({stored:'env-file'});
  expect(fs.readFileSync(env.TEMPOLOOM_ENV_FILE,'utf8')).toBe('OPENROUTER_API_KEY=sk-good-key-123456\n');
  expect(fs.readFileSync(path.join(env.TEMPOLOOM_SETTINGS_DIR,'keys.json'),'utf8')).not.toContain('sk-good');
  expect(await S.test('openrouter',fake(openrouter))).toMatchObject({ok:true,count:2,note:'$4.50 left on this key'});
  const or=S.overview().services.find(s=>s.id==='openrouter')!;
  expect(or).toMatchObject({connected:true,hint:'…3456',stored:'env-file',models:{total:2,agents:1,vision:1,images:1}});
  expect(JSON.stringify(S.overview())).not.toContain('sk-good-key');
  expect(S.modelsFor('agents')).toEqual([{provider:'openrouter',model:'anthropic/claude-sonnet',name:'Claude Sonnet',price:{in:3,out:15},context:200000}]);
  // A wrong key is said plainly, and the old model list is kept.
  process.env.OPENROUTER_API_KEY='sk-wrong-key-999999';
  expect(await S.test('openrouter',fake(openrouter))).toMatchObject({ok:false,error:expect.stringMatching(/refused/)});
  expect(S.cachedModels('openrouter')!.models).toHaveLength(2);
  process.env.OPENROUTER_API_KEY='sk-good-key-123456';
 });
 it('checks every choice before saving it',async()=>{
  const S=await import('../src/engine/models/settings.js');
  const claude={provider:'openrouter',model:'anthropic/claude-sonnet'};
  expect(()=>S.update({model:{provider:'openrouter',model:'made-up'}})).toThrow(/not in the model list/);
  expect(S.update({model:claude}).settings.model).toEqual(claude);
  expect(S.update({roleModels:{reviewer:claude}}).warnings[0]).toMatch(/reviewer uses the same model/);
  expect(S.update({roleModels:{reviewer:null}}).settings.roleModels).toEqual({});
  expect(()=>S.update({roleModels:{janitor:claude}})).toThrow(/Unknown role/);
  expect(()=>S.update({makers:{images:'fal'}})).toThrow(/Connect fal first/);
  expect(()=>S.update({makers:{sfx:'pexels'}})).toThrow(/cannot make sound effects/);
  expect(()=>S.update({budget:{perJob:20,perDay:5}})).toThrow(/per job cannot be more/);
  expect(()=>S.update({driver:'browser'})).toThrow(/cannot drive a job yet/);
  expect(()=>S.update({secret:1})).toThrow();
  expect(S.update({share:'local'}).warnings.some(w=>/local models/.test(w))).toBe(true);
  S.update({share:'frames'});
 });
 it('adds a local model server and removes keys and servers cleanly',async()=>{
  const S=await import('../src/engine/models/settings.js');
  const l=S.addLocal('Ollama','http://localhost:11434/v1/');
  expect(l).toMatchObject({id:'local-ollama',baseURL:'http://localhost:11434/v1'});
  expect(()=>S.addLocal('Again','http://localhost:11434/v1')).toThrow(/already added/);
  expect(()=>S.addLocal('Bad','file:///etc')).toThrow();
  expect(await S.test(l.id,fake({'http://localhost:11434/v1/models':{data:[{id:'qwen3:14b'},{id:'nomic-embed-text'},{id:'llava:7b'}]}}))).toMatchObject({ok:true,count:2});
  S.update({roleModels:{scenes:{provider:l.id,model:'qwen3:14b'}}});
  S.removeLocal(l.id);expect(S.readSettings().roleModels).toEqual({});
  await S.removeKey('OPENROUTER_API_KEY');
  expect(fs.readFileSync(env.TEMPOLOOM_ENV_FILE,'utf8')).not.toContain('OPENROUTER');expect(process.env.OPENROUTER_API_KEY).toBeUndefined();
  process.env.ANTHROPIC_API_KEY='sk-from-the-shell-0000';
  await expect(S.removeKey('ANTHROPIC_API_KEY')).rejects.toThrow(/system's environment/);
  delete process.env.ANTHROPIC_API_KEY;
 });
});

describe('the page server',()=>{
 it('serves the Live studio, its stream, the mascots and Settings, and never sends a key back',async()=>{
  const {serve}=await import('../src/teach/server.js');
  const s=await serve({port:0,fetcher:fake(openrouter)});
  try{const base=`http://127.0.0.1:${s.port}`,h={'x-teach-key':s.key},jh={...h,'content-type':'application/json'};
   for(const f of ['/live.js','/settings.js','/mascot/thinking.svg'])expect((await fetch(base+f)).status).toBe(200);
   expect((await fetch(base+'/mascot/nope.svg')).status).toBe(403);
   expect((await fetch(base+'/api/studio/live')).status).toBe(403);
   const list=await (await fetch(base+'/api/studio/live',{headers:h})).json() as {jobs:{job:string}[]};expect(list.jobs[0]!.job).toBe('live-a');
   const one=await (await fetch(base+'/api/studio/live/live-a',{headers:h})).json() as {team:unknown[];lastSeq:number};expect(one.team.length).toBeGreaterThan(3);
   // The stream sends what happened after the given event, then each new one as it happens.
   const ctl=new AbortController(),r=await fetch(base+`/api/studio/live/live-a/stream?after=${one.lastSeq}&k=${s.key}`,{signal:ctl.signal});
   expect(r.headers.get('content-type')).toContain('text/event-stream');
   const reader=r.body!.getReader();let got='';
   (await import('../src/engine/studio-events.js')).say('live-a','brief','director','Asking only what is missing','thinking');
   for(let i=0;i<40&&!got.includes('Asking only');i++)got+=new TextDecoder().decode((await reader.read()).value);
   ctl.abort();expect(got).toMatch(/data: .*"Asking only what is missing"/);
   const saved=await (await fetch(base+'/api/settings/keys/openrouter',{method:'POST',headers:jh,body:JSON.stringify({key:'sk-good-key-123456'})})).text();
   expect(saved).not.toContain('sk-good');expect(JSON.parse(saved).test).toMatchObject({ok:true,count:2});
   const all=await (await fetch(base+'/api/settings',{headers:h})).text();expect(all).not.toContain('sk-good');expect(all).toContain('…3456');
   expect((await fetch(base+'/api/settings',{method:'PATCH',headers:jh,body:JSON.stringify({model:{provider:'openrouter',model:'made-up'}})})).status).toBe(400);
   expect((await (await fetch(base+'/api/settings/models?can=agents',{headers:h})).json() as {models:unknown[]}).models).toHaveLength(1);
   expect((await fetch(base+'/api/settings/keys/openrouter',{method:'DELETE',headers:h})).status).toBe(200);
  }finally{await s.close();}
 },30000);
});
