import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import type {Page} from 'playwright';
import type {Project} from '../engine/schema.js';
import {dir,writeJSON} from '../engine/project.js';
import {assertExplainer,duplicateReport,themeContrast} from '../engine/explainer-design.js';
import {ffmpeg,run} from './ffmpeg-encoder.js';
import {contactSheet} from './contact-sheet.js';

type Box={kind:string;name?:string;x:number;y:number;w:number;h:number};
type Frame={time:number;scene:string;fontReady:boolean;fontSize:number;sourceExact:boolean;textOverflow:boolean;direction:string;directionCorrect?:boolean;focalCentered?:boolean;boxes:Box[];zones:{text:Box;icons:Box}};
export function checkGeometry(frame:Frame,width:number,height:number){
 const failures:string[]=[];
 if(!frame.fontReady)failures.push('Font unavailable');if(!frame.sourceExact)failures.push('Displayed source text changed');if(frame.textOverflow)failures.push('Text overflows its fixed zone');
 if(frame.directionCorrect===false)failures.push('Arabic-script direction is not RTL');if(frame.focalCentered===false)failures.push('Focal icon is off the shared center anchor');
 if(frame.fontSize<Math.min(width,height)*.044)failures.push('Text below mobile font floor');
 const intersect=(a:Box,b:Box)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>2;
 for(const [i,b] of frame.boxes.entries()){
  if(b.x<width*.045||b.y<height*.045||b.x+b.w>width*.955||b.y+b.h>height*.94)failures.push('Unsafe/clipped '+b.kind+' '+(b.name??i));
  for(const other of frame.boxes.slice(i+1))if(intersect(b,other))failures.push('Overlapping '+b.kind+' / '+other.kind);
  if(b.kind==='text'&&intersect(b,frame.zones.icons))failures.push('Text entered icon zone');
  if(b.kind==='icon'&&intersect(b,frame.zones.text))failures.push('Icon entered text zone');
 }
 return [...new Set(failures)];
}
export function qaTimes(p:Project){
 const duration=p.scenes.at(-1)!.start+p.scenes.at(-1)!.duration,times:number[]=[];
 for(let t=0;t<duration;t+=.5)times.push(t);
 for(const s of p.scenes){times.push(s.start,s.start+s.duration-1/p.config.fps);for(const at of [...s.explainer!.phrases.map(x=>x.at),...s.explainer!.icons.map(x=>x.at),s.duration-p.config.explainer!.duration])for(const delta of [0,.25,.5])times.push(Math.min(s.start+s.duration-1/p.config.fps,s.start+at+delta));}
 return [...new Set(times.map(t=>Math.round(t*1e6)/1e6))].filter(t=>t>=0&&t<duration).sort((a,b)=>a-b);
}
export async function explainerPreflight(p:Project,page:Page,folder:string){
 assertExplainer(p);await fs.mkdir(folder,{recursive:true});const samples:({time:number;scene:string;failures:string[]})[]=[];
 for(const time of qaTimes(p)){await page.evaluate(t=>window.render(t),time);const frame=await page.evaluate(()=>window.qa) as Frame;samples.push({time,scene:frame.scene,failures:checkGeometry(frame,p.config.width,p.config.height)});}
 const stills:string[]=[];
 for(const s of p.scenes){const time=s.start+Math.min(s.duration-.51,Math.max(...s.explainer!.phrases.map(x=>x.at))+p.config.explainer!.duration);await page.evaluate(t=>window.render(t),time);const file=path.join(folder,s.id+'.png');await page.screenshot({path:file});stills.push(file);}
 const rows=p.scenes.map((s,i)=>({section:s.id,template:s.explainer!.template,copy:s.text,icons:s.explainer!.icons,position:p.config.width>p.config.height?'icon left / text right':'icon upper / text lower',motion:{duration:p.config.explainer!.duration,easing:'cubic-out',entrances:s.explainer!.icons.map(x=>({symbol:x.name,start:x.at,end:x.at+p.config.explainer!.duration,reason:x.meaning})),transition:s.explainer!.transition,reason:s.explainer!.transitionReason},duration:s.duration,still:stills[i]}));
 const safe=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const html=`<!doctype html><meta charset="utf-8"><title>${safe(p.title)} storyboard</title><style>body{font:16px system-ui;background:#f7f7f5;color:#222;margin:32px}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #ddd;vertical-align:top}img{width:150px}td.copy{direction:rtl;white-space:pre-wrap;min-width:240px}</style><h1>${safe(p.title)}</h1><p>${safe(p.config.explainer!.rationale.join(' '))}</p><table><tr><th>Section</th><th>Copy</th><th>Icons</th><th>Position</th><th>Motion</th><th>Duration</th><th>Still</th></tr>${rows.map(r=>`<tr><td>${safe(r.section)}<br>${r.template}</td><td class="copy">${safe(r.copy)}</td><td>${r.icons.map(i=>safe(i.name+': '+i.meaning+(i.callback?' Callback: '+i.callback:''))).join('<br>')}</td><td>${r.position}</td><td>${safe(JSON.stringify(r.motion))}</td><td>${r.duration.toFixed(2)}s</td><td><img src="${path.basename(r.still)}"></td></tr>`).join('')}</table>`;
 await fs.writeFile(path.join(folder,'storyboard.html'),html);await writeJSON(path.join(folder,'storyboard.json'),rows);
 const readingWarnings=p.scenes.flatMap(s=>s.explainer!.phrases.map((phrase,i)=>{const words=s.text.slice(phrase.from,phrase.to).match(/\S+/gu)?.length??0;const visible=s.duration-phrase.at;return words/Math.max(.1,visible)>3?`${s.id} phrase ${i+1}: ${words} words / ${visible.toFixed(2)}s; inspect comfort without changing speech timings.`:null;}).filter((x):x is string=>!!x));
 const failures=samples.flatMap(s=>s.failures.map(f=>`${s.scene}@${s.time.toFixed(3)}: ${f}`));
 const report={passed:failures.length===0,checkedSamples:samples.length,failures,samples,contrast:themeContrast(p.config.explainer!),duplicates:duplicateReport(p.scenes),readingWarnings,stills,storyboard:path.join(folder,'storyboard.html'),limits:['DOM boxes are conservative geometry checks, not optical centering.','Complete phrase nodes, exact text, font coverage and direction do not prove correct RTL shaping; inspect encoded pixels.','Semantic icon relevance, readable pacing and visual balance require an evidence-based editorial review.']};
 await writeJSON(path.join(folder,'preflight.json'),report);return report;
}
export async function encodedExplainerQA(p:Project,file:string,page:Page,folder:string){
 await fs.mkdir(folder,{recursive:true});
 await run(ffmpeg,['-v','error','-n','-i',file,'-vf',"select='isnan(prev_selected_t)+gte(t-prev_selected_t,0.499999)'",'-vsync','0',path.join(folder,'frame-%04d.png')]);
 const files=(await fs.readdir(folder)).filter(f=>/^frame-\d+\.png$/.test(f)).sort().map(f=>path.join(folder,f));
 // Exact decoded-frame hash repeats are diagnostic. Intentional static holds are exempt.
 const hashes=await Promise.all(files.map(async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex')));
 const repeated=hashes.flatMap((hash,i)=>i>0&&hash===hashes[i-1]?[{time:i*.5,previous:(i-1)*.5,note:'Identical encoded sample; check whether this is an intended hold.'}]:[]);
 const sheets:string[]=[];for(let n=0;n<files.length;n+=18){const sheet=path.join(folder,'sheet-'+String(n/18+1).padStart(2,'0')+'.png');await contactSheet(page.context(),files.slice(n,n+18),files.slice(n,n+18).map((_,i)=>(n+i)*.5),sheet);sheets.push(sheet);}
 const exportHash=createHash('sha256').update(await fs.readFile(file)).digest('hex');
 const report={exportHash,intervalSeconds:.5,frames:files,sheets,repeated,limits:'Pixel equality detects exact repeated samples, not semantic similarity or Arabic shaping. Pair with preflight geometry and inspect these encoded frames.',review:{reviewed:false,threshold:4,criteria:['clarity','repetition','smoothness','readability','visualBalance'].map(name=>({name,score:null,evidence:''})),limitations:[]}};
 await writeJSON(path.join(folder,'encoded-qa.json'),report);return report;
}
export async function exportExplainerExtras(p:Project,file:string){
 const stem=file.replace(/\.mp4$/i,''),srt=stem+'.srt',loop=stem+'.silent-preview.mp4';
 const stamp=(s:number)=>{const ms=Math.round(s*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
 const captions=p.scenes.flatMap(s=>s.explainer!.phrases.map((phrase,i,a)=>({text:s.text.slice(phrase.from,phrase.to).trim(),start:s.start+phrase.at,end:s.start+(a[i+1]?.at??s.duration)})));
 await fs.writeFile(srt,captions.map((v,i)=>`${i+1}\n${stamp(v.start)} --> ${stamp(v.end)}\n${v.text}\n`).join('\n'),'utf8');
 const duration=Math.min(6,p.scenes[0].duration+p.scenes[1].duration);
 await run(ffmpeg,['-v','error','-n','-i',file,'-t',String(duration),'-an','-vf',`scale=540:-2,fade=t=in:st=0:d=0.5,fade=t=out:st=${Math.max(0,duration-.5)}:d=0.5`,'-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',loop]);
 const receipt={captions:srt,silentPreview:loop,duration,note:'Silent preview has a half-second fade at the loop seam; the main video uses planned matched slides. Narrated captions use the authorized cue source; silent-demo caption times are authored display timing.'};
 await writeJSON(stem+'.deliverables.json',receipt);return receipt;
}
export function newQAFolder(p:Project){return path.join(dir(p.id,p.config),'explainer-qa',randomUUID());}
