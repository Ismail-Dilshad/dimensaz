import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../renderer/browser-path.js';
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';
import {contactSheet} from '../renderer/contact-sheet.js';
import {load,dir} from '../engine/project.js';
import {fingerprint} from '../renderer/render-controller.js';

const p=await load(process.argv[2]);
const latest=JSON.parse(await fs.readFile(path.join(dir(p.id,p.config),'latest-render.json'),'utf8'));
if(latest.fingerprint!==await fingerprint(p))throw new Error('Latest render is stale');
const folder=path.join(path.dirname(latest.file),'encoded-inspection');await fs.mkdir(folder,{recursive:true});
const times=[1.75,299/60,5,301/60,6.9,7.8,8.8,9.7];const files:string[]=[];
for(const t of times){
 const file=path.join(folder,t.toFixed(4)+'.png');
 await run(ffmpeg,['-v','error','-n','-ss',String(t),'-i',latest.file,'-frames:v','1',file]);files.push(file);
}
const b=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
try{const c=await b.newContext();await contactSheet(c,files,times,path.join(folder,'contact-sheet.png'));await c.close();}finally{await b.close();}
console.log(JSON.stringify({folder,...latest.validation},null,2));
