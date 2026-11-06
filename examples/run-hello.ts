// Smoke example: detect the language, choose a font by style through the recommender
// (Kurdish: only the existing Kurdish fonts; others: open fonts), then render a short
// text-only kinetic video and approve its preview.
// Usage: pnpm example:hello en|ckb [--final]
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from '../src/engine/config.js';
import {detectLanguage} from '../src/engine/languages.js';
import {recommendFonts} from '../src/engine/font-catalog.js';
import {produce} from '../src/engine/production.js';

const name=process.argv[2]==='ckb'?'hello-ckb':'hello-en';
const base=path.join(ROOT,'examples',name);
const script=await fs.readFile(path.join(base,'script.txt'),'utf8');
const brief=JSON.parse(await fs.readFile(path.join(base,'brief.json'),'utf8')) as {title:string;style:string;format:'9:16'|'1:1'|'16:9'};
const language=detectLanguage(script);
const fonts=await recommendFonts(script,brief.style,language);
const font=fonts.fonts.find(f=>f.missing.length===0);
if(!font)throw new Error('No allowed font covers this script: '+JSON.stringify(fonts.fonts.map(f=>({id:f.id,missing:f.missing}))));
console.log(`Language ${language}; style "${brief.style}" -> font ${font.id} (${font.origin})`);
const final=process.argv.includes('--final');
const request={schemaVersion:1,title:brief.title,script,language:'auto',fontPreset:font.id,aspectRatio:brief.format,preset:'kinetic',exportCategory:'examples',
 ...(final?{}:{resolution:{width:360,height:640},fps:12})};
const dir=path.join(ROOT,'workspace','requests');await fs.mkdir(dir,{recursive:true});
const manifest=path.join(dir,`${name}-${Date.now()}.json`);
await fs.writeFile(manifest,JSON.stringify(request,null,2));
const first=await produce({manifest}) as {job?:string;status?:string;error?:string};
if(!first.job)throw new Error('Job not created: '+JSON.stringify(first).slice(0,500));
console.log('Preview ready for '+first.job+'; approving the example preview.');
const done=await produce({resume:first.job,approve:true}) as Record<string,unknown>;
console.log(JSON.stringify({job:first.job,status:done.status,file:done.file??done.output,font:font.id,language},null,2));
