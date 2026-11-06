// First-run setup: default language, brand profile, .env, then a health check.
// Interactive in a terminal; agents pass flags (or --yes for defaults).
// Never overwrites: existing files are only updated with values you explicitly give.
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import {parseArgs} from 'node:util';
import {ROOT} from '../src/engine/config.js';
import {languageSchema} from '../src/engine/languages.js';
import {brandProfile,brandSchema,BRAND_FILE} from '../src/engine/brand.js';
import {runDoctor,formatChecks} from '../src/engine/doctor.js';

const {values:v}=parseArgs({options:{
 language:{type:'string'},name:{type:'string'},logo:{type:'string'},primary:{type:'string'},accent:{type:'string'},background:{type:'string'},text:{type:'string'},
 'auto-motion':{type:'string'},yes:{type:'boolean',short:'y'},'skip-doctor':{type:'boolean'},
}});
const interactive=process.stdin.isTTY&&!v.yes;
const rl=interactive?readline.createInterface({input:process.stdin,output:process.stdout}):null;
async function ask(question:string,current:string|undefined,given:string|undefined){
 if(given!==undefined)return given;
 if(!rl)return current;
 const answer=(await rl.question(`${question}${current?` [${current}]`:''}: `)).trim();
 return answer||current;
}
const hex=(s:string|undefined,label:string)=>{if(s===undefined)return undefined;if(!/^#[0-9a-f]{6}$/i.test(s))throw new Error(label+' must be a hex color like #0B3B3C');return s.toUpperCase();};

try{
 // 1. Default language (used when the script's language cannot be detected).
 const defaultsFile=path.join(ROOT,'config/defaults.json');
 const defaults=JSON.parse(await fs.readFile(defaultsFile,'utf8'));
 const language=languageSchema.parse(await ask('Default language (en, ckb, kmr, badini, ar, fa)',defaults.language??'en',v.language));
 if(language!==defaults.language){defaults.language=language;await fs.writeFile(defaultsFile,JSON.stringify(defaults,null,2)+'\n');}

 // 2. Brand profile.
 const existing=await fs.access(BRAND_FILE).then(()=>true,()=>false);
 const brand=await brandProfile();
 const name=await ask('Brand name',brand.name,v.name);
 const logo=await ask('Logo file (SVG or PNG, path from the project root)',brand.logo.primary,v.logo);
 if(logo)await fs.access(path.resolve(ROOT,logo)).catch(()=>{throw new Error('Logo not found: '+logo);});
 const colors={
  primary:hex(await ask('Primary color',brand.colors.primary,v.primary),'Primary color'),
  accent:hex(await ask('Accent color',brand.colors.accent,v.accent),'Accent color'),
  background:hex(await ask('Background color',brand.colors.background,v.background),'Background color'),
  text:hex(await ask('Text color',brand.colors.text,v.text),'Text color'),
 };
 const motion=await ask('Automatic subtle motion (on/off)',brand.preferences.autoMotion?'on':'off',v['auto-motion']);
 const raw=JSON.parse(await fs.readFile(BRAND_FILE,'utf8').catch(()=>'{"version":1}'));
 const next=brandSchema.parse({...raw,version:1,name:name||'My brand',
  logo:{...raw.logo,...(logo?{primary:logo}:{})},
  colors:{...raw.colors,...Object.fromEntries(Object.entries(colors).filter(([,c])=>c))},
  preferences:{...raw.preferences,autoMotion:motion!=='off'}});
 if(!existing||JSON.stringify(next)!==JSON.stringify(brandSchema.parse(raw))){
  await fs.mkdir(path.dirname(BRAND_FILE),{recursive:true});
  await fs.writeFile(BRAND_FILE,JSON.stringify({...raw,...next},null,2)+'\n');
  console.log((existing?'Updated ':'Created ')+path.relative(ROOT,BRAND_FILE));
 }

 // 3. .env from the example (never overwritten).
 const env=path.join(ROOT,'.env');
 if(await fs.access(env).then(()=>false,()=>true)){await fs.copyFile(path.join(ROOT,'.env.example'),env);console.log('Created .env from .env.example (all values optional)');}

 // 4. Health check.
 if(!v['skip-doctor']){const checks=await runDoctor();console.log('\n'+formatChecks(checks));if(checks.some(c=>c.required&&!c.ok))process.exitCode=1;}
 console.log(`\nReady. Default language: ${language}. Open this folder in Claude Code (/reelwright) or Codex and describe your video.`);
}finally{rl?.close();}
