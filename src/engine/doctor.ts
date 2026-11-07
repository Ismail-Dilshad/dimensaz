// Environment and project health checks shared by `video:doctor` and `dimensaz init`.
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {ROOT,defaults} from './config.js';
import {fontCatalog,defaultFontPath,locales} from './font-catalog.js';
import {languageSchema} from './languages.js';
import {brandProfile} from './brand.js';
import {ffmpeg,ffprobe,run} from '../renderer/ffmpeg-encoder.js';
import {chromiumExecutable} from '../renderer/browser-path.js';

export type Check={id:string;required:boolean;ok:boolean;detail:string;fix?:string};

async function check(id:string,required:boolean,fn:()=>Promise<string>,fix?:string):Promise<Check>{
 try{return {id,required,ok:true,detail:await fn()};}
 catch(e){return {id,required,ok:false,detail:e instanceof Error?e.message.split('\n')[0].slice(0,300):String(e),fix};}
}

export async function runDoctor(options:{browser?:boolean}={}):Promise<Check[]>{
 const checks:Check[]=[];
 checks.push(await check('node',true,async()=>{const major=Number(process.versions.node.split('.')[0]);if(major<22)throw new Error('Node '+process.version+' is too old');return process.version;},'Install Node.js 22 or newer'));
 checks.push(await check('ffmpeg',true,async()=>{const v=await run(ffmpeg,['-version']);return v.split('\n')[0];},'Run pnpm install, or set FFMPEG_PATH'));
 checks.push(await check('ffprobe',true,async()=>{const v=await run(ffprobe,['-version']);return v.split('\n')[0];},'Run pnpm install, or set FFPROBE_PATH'));
 if(options.browser!==false)checks.push(await check('chromium',true,async()=>{let exe:string|undefined;try{exe=chromiumExecutable();}catch{exe=undefined;}const b=await chromium.launch({executablePath:exe});const v=b.version();await b.close();return 'Chromium '+v;},'Run pnpm exec playwright install chromium, or set CHROMIUM_PATH'));
 checks.push(await check('config',true,async()=>{const c=await defaults();return `default language ${c.language}, font ${c.font}`;}));
 checks.push(await check('fonts',true,async()=>{
  const c=await fontCatalog();const bundled=c.fonts.filter(f=>f.origin!=='installed-system-font');const bad:string[]=[];
  for(const f of bundled){const file=path.resolve(ROOT,f.path);if(!fsSync.existsSync(file)){bad.push(f.id+' missing');continue;}if(createHash('sha256').update(await fs.readFile(file)).digest('hex')!==f.sha256)bad.push(f.id+' changed');}
  if(bad.length)throw new Error(bad.join(', '));
  const kurdish=bundled.filter(f=>f.origin==='existing-project-font').length,open=bundled.filter(f=>f.origin==='bundled-open-font').length;
  return `${kurdish} Kurdish fonts, ${open} open fonts, all unchanged`;
 },'Restore font files from git; never edit font bytes'));
 checks.push(await check('languages',true,async()=>{const loc=await locales();const langs=Object.keys(loc.languages);for(const l of langs)await defaultFontPath(languageSchema.parse(l));return langs.join(', ')+' have default fonts';}));
 checks.push(await check('brand',false,async()=>{const b=await brandProfile();return `${b.name}, automatic motion ${b.preferences.autoMotion?'on':'off'}`;},'Run pnpm dimensaz init to create config/brand.json'));
 checks.push(await check('knowledge',false,async()=>{const idx=JSON.parse(await fs.readFile(path.join(ROOT,'agent/knowledge/index.json'),'utf8'));const missing=idx.entries.filter((e:{path:string})=>!fsSync.existsSync(path.join(ROOT,e.path)));if(missing.length)throw new Error(missing.length+' indexed files missing');return idx.entries.length+' entries';},'Run pnpm dimensaz knowledge validate'));
 checks.push(await check('skill',false,async()=>{const r=spawnSync(process.execPath,[path.join(ROOT,'scripts/sync-skills.mjs'),'--check'],{cwd:ROOT,encoding:'utf8'});if(r.status!==0)throw new Error((r.stderr||r.stdout).trim());return 'Claude Code copy in sync';},'Run pnpm skills:sync'));
 checks.push(await check('workspace',true,async()=>{const dir=path.join(ROOT,process.env.VIDEO_WORKSPACE||'workspace');await fs.mkdir(dir,{recursive:true});const probe=path.join(dir,'.doctor-'+process.pid);await fs.writeFile(probe,'ok');await fs.rm(probe);return path.relative(ROOT,dir)||'.';}));
 checks.push(await check('env',false,async()=>{if(!fsSync.existsSync(path.join(ROOT,'.env')))throw new Error('.env not found (optional)');return '.env present';},'Run pnpm dimensaz init, or copy .env.example to .env'));
 checks.push(await check('elevenlabs',false,async()=>{if(!process.env.ELEVENLABS_API_KEY?.trim())throw new Error('No ELEVENLABS_API_KEY: transcription, captions from speech and pause removal are off');return 'API key set (transcription, captions, tighten)';},'Add ELEVENLABS_API_KEY to .env'));
 checks.push(await check('audio-pipeline',false,async()=>{
  const py=process.env.VIDEO_PYTHON||path.join(ROOT,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  if(!fsSync.existsSync(py))throw new Error('Optional local speech analysis is not installed');
  const r=spawnSync(py,['--version'],{encoding:'utf8'});if(r.status!==0)throw new Error('Python in .venv does not run');return (r.stdout||r.stderr).trim();
 },'Optional: pnpm audio:setup (asks before large downloads)'));
 checks.push(await check('media-tools',false,async()=>{
  const py=process.env.VIDEO_PYTHON||path.join(ROOT,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  if(!fsSync.existsSync(py))throw new Error('Optional media tools are not installed');
  const mods=['auto_editor','scenedetect','librosa','mediapipe','rembg','demucs','cv2'];
  const r=spawnSync(py,['-c','import importlib.util,json;print(json.dumps([m for m in '+JSON.stringify(mods)+' if importlib.util.find_spec(m) is None]))'],{encoding:'utf8',cwd:ROOT});
  if(r.status!==0)throw new Error('Python in .venv does not run');
  const missing=JSON.parse(r.stdout.trim()) as string[];
  if(missing.length)throw new Error('Not installed: '+missing.join(', '));
  return 'auto-editor, PySceneDetect, librosa, MediaPipe, rembg, Demucs, OpenCV';
 },'Optional: pnpm media:setup'));
 return checks;
}

export function formatChecks(checks:Check[]){
 return checks.map(c=>`${c.ok?'ok  ':c.required?'FAIL':'warn'}  ${c.id.padEnd(15)} ${c.detail}${!c.ok&&c.fix?'\n      fix: '+c.fix:''}`).join('\n');
}
