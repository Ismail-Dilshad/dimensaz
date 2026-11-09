// The quality harness: a fixed set of test scripts (tests/fixtures/quality, or your own) rendered
// with visuals and styles designed from zero, scored the same way the preview is scored. Each run is saved, compared with
// the previous run, and (with learn) teaches the brain which style traits fail.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {ROOT} from './config.js';
import {create,save,dir as projectDir} from './project.js';
import {planProject} from './timeline-builder.js';
import {storyboard} from './storyboard.js';
import {designStyle,usedGenomes} from './style-choice.js';
import {frameFor} from '../components/pieces/frame.js';
import {skinFor} from '../components/pieces/skins.js';
import {traits,type Genome} from '../components/pieces/genome.js';
import {openRenderer} from '../renderer/browser-renderer.js';
import {previewWorkers} from '../renderer/performance.js';
import {checkFrame,spread,sceneScore,summarize,type SceneQuality,type Quality} from '../renderer/visual-qa.js';
import {planPieceSounds,kitSource,renderSoundBed,cueSounds} from './piece-sounds.js';
import {readSfxIndex} from './sfx.js';
import {pieceSchema,type PieceTheme} from './scene-pieces-schema.js';

export type HarnessRow={script:string;style:string;genome:string;traits:string[];score:number;passed:boolean;hard:number;soft:number;worst:string[];
 sound:{bedLufs:number|null;peak:number|null;cuesPerSecond:number;issues:string[]}};
export type HarnessReport={at:string;version:string;styles:number;scripts:string[];rows:HarnessRow[];
 summary:{score:number;passRate:number;hard:number;soft:number;byScript:Record<string,number>;failingTraits:{trait:string;failRate:number;uses:number}[]};
 previous?:{at:string;score:number;passRate:number;delta:number;regression:boolean}};

const BRAND:PieceTheme={primary:'#4F46E5',accent:'#F97316',surface:'#FFFFFF',background:'#F6F7FB',text:'#111827',muted:'#6B7280',radius:18};
const outRoot=()=>path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','quality');

/** Scores one project's scenes once they have settled (shared with the preview checks). */
export async function scoreProject(p:import('./schema.js').Project):Promise<Quality>{
 const r=await openRenderer(p,.5);const out:(SceneQuality|undefined)[]=[];
 const pages=[r,...await Promise.all(Array.from({length:previewWorkers(p.scenes.length*2)-1},()=>openRenderer(p,.5,undefined,r.browser)))];
 try{await Promise.all(pages.map(async(w,k)=>{for(let i=k;i<p.scenes.length;i+=pages.length){const s=p.scenes[i]!;
  const t=s.start+Math.min(s.duration-1/p.config.fps,Math.max(s.duration*.82,s.duration-.45));
  await w.page.evaluate(x=>window.render(x),t);const dom=await checkFrame(w.page);const sp=await spread(w.page,await w.page.screenshot({type:'jpeg',quality:80}));
  const issues=[...dom.issues];if(sp<3.5)issues.push({kind:'empty',detail:`almost nothing on screen (spread ${sp.toFixed(1)})`,severity:'hard'});
  out[i]={scene:s.id,time:Number(t.toFixed(2)),score:sceneScore(issues),issues,stats:{...dom.stats,spread:Number(sp.toFixed(1))}};}}));
 }finally{await Promise.all(pages.slice(1).map(w=>w.close()));await r.close();}
 return summarize(out.filter((x):x is SceneQuality=>!!x));
}

const loudness=async(file:string)=>(await import('./sound-quality.js')).measureLoudness(file);

export async function runHarness(o:{styles?:number;scripts?:string[];seed?:string;learn?:boolean;onProgress?:(s:string)=>void}={}):Promise<{report:HarnessReport;dir:string}>{
 const n=Math.max(1,Math.min(12,o.styles??4));const dir=path.join(ROOT,'tests','fixtures','quality');
 const files=(o.scripts?.length?o.scripts:(await fs.readdir(dir)).filter(f=>f.endsWith('.txt')).map(f=>path.join(dir,f))).sort();
 const sounds=cueSounds(await readSfxIndex());const used:Genome[]=[...await usedGenomes()];const rows:HarnessRow[]=[];
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'dz-quality-'));
 try{
  for(const file of files){
   const script=await fs.readFile(file,'utf8'),name=path.basename(file,'.txt');
   for(let k=0;k<n;k++){
    const g=designStyle({seed:`${o.seed??'harness'}:${name}:${k}`,brief:script,used}).genome;used.push(g);
    const sb=storyboard(script,{genome:g,seed:`${o.seed??'harness'}:${name}:${k}`});
    const p=await create('quality-'+name+'-'+k,sb.request.script,{width:1080,height:1920,fps:30,renderPurpose:'test'});
    p.scenes=planProject(p);
    for(const [i,v] of sb.request.sceneVisuals.entries()){const sc=p.scenes[i];if(sc)sc.piece=pieceSchema.parse(v.piece);}
    p.config.pieces={...BRAND,genome:g};const f=frameFor(g,BRAND);
    p.config.frame=f;p.config.background='solid';p.config.white=f.background;p.config.ink=f.text;p.config.primary=f.highlight;p.config.muted=f.muted;
    for(const s of p.scenes)s.motion={duration:.55,easing:f.easing,intensity:f.intensity};
    await save(p);o.onProgress?.(`${name} ${k+1}/${n}: ${g.name}`);
    const q=await scoreProject(p);
    await fs.rm(projectDir(p.id,p.config),{recursive:true,force:true}); // sample projects are not kept
    // Sound: the piece sounds alone, in the style's kit and tuning.
    const cues=planPieceSounds(p.scenes,await kitSource(skinFor(g).sound,sounds),{quiet:g.sound.kit==='minimal',pitch:g.sound.pitch,bright:g.sound.bright});
    const duration=p.scenes.reduce((m,s)=>Math.max(m,s.start+s.duration),0);const issues:string[]=[];let bed={lufs:null as number|null,peak:null as number|null};
    if(cues.length){const wav=await renderSoundBed(cues,duration,path.join(tmp,`${g.id}.wav`));bed=await loudness(wav);await fs.rm(wav,{force:true});}
    const cps=Number((cues.length/(duration||1)).toFixed(2));
    if(bed.lufs!==null&&bed.lufs<-38)issues.push(`effects very quiet (${bed.lufs} LUFS)`);if(bed.lufs!==null&&bed.lufs>-16)issues.push(`effects loud (${bed.lufs} LUFS)`);
    if(bed.peak!==null&&bed.peak>-.5)issues.push(`effects peak at ${bed.peak} dBFS`);if(cps>3.2)issues.push(`busy (${cps} cues a second)`);
    rows.push({script:name,style:g.name,genome:g.id,traits:traits(g),score:q.score,passed:q.passed&&!issues.length,hard:q.hard,soft:q.soft,
     worst:[...q.scenes.flatMap(s=>s.issues.filter(i=>i.severity==='hard').map(i=>`${s.scene}: ${i.kind}: ${i.detail}`)),...q.scenes.flatMap(s=>s.issues.filter(i=>i.severity==='soft').map(i=>`${s.scene}: ${i.kind} (soft): ${i.detail}`))].slice(0,5),sound:{bedLufs:bed.lufs,peak:bed.peak,cuesPerSecond:cps,issues}});
   }
  }
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
 // Summary, failing traits and comparison with the previous run.
 const avg=(xs:number[])=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length*10)/10:0;
 const byScript=Object.fromEntries([...new Set(rows.map(r=>r.script))].map(s=>[s,avg(rows.filter(r=>r.script===s).map(r=>r.score))]));
 const tr=new Map<string,{uses:number;fails:number}>();for(const r of rows)for(const t of r.traits){const e=tr.get(t)??{uses:0,fails:0};e.uses++;if(r.hard)e.fails++;tr.set(t,e);}
 const failingTraits=[...tr].map(([trait,e])=>({trait,failRate:Number((e.fails/e.uses).toFixed(2)),uses:e.uses})).filter(x=>x.failRate>0&&x.uses>=2).sort((a,b)=>b.failRate-a.failRate).slice(0,8);
 const pkg=JSON.parse(await fs.readFile(path.join(ROOT,'package.json'),'utf8')) as {version:string};
 const report:HarnessReport={at:new Date().toISOString(),version:pkg.version,styles:n,scripts:files.map(f=>path.basename(f)),rows,
  summary:{score:avg(rows.map(r=>r.score)),passRate:Number((rows.filter(r=>r.passed).length/(rows.length||1)).toFixed(2)),hard:rows.reduce((a,r)=>a+r.hard,0),soft:rows.reduce((a,r)=>a+r.soft,0),byScript,failingTraits}};
 const prevDirs=(await fs.readdir(outRoot()).catch(()=>[] as string[])).sort();
 for(const d of prevDirs.reverse()){try{const prev=JSON.parse(await fs.readFile(path.join(outRoot(),d,'report.json'),'utf8')) as HarnessReport;
  // Only a run of the same scripts and number of styles is comparable.
  if(prev.styles!==report.styles||prev.scripts.join()!==report.scripts.join())continue;
  const delta=Number((report.summary.score-prev.summary.score).toFixed(1));report.previous={at:prev.at,score:prev.summary.score,passRate:prev.summary.passRate,delta,regression:delta<-3||report.summary.passRate<prev.summary.passRate-.1};break;}catch{/* next */}}
 if(o.learn){try{const brain=await import('./brain/brain.js');const {registerTraits}=await import('./style-choice.js');
  for(const r of rows.filter(x=>x.worst.some(w=>/contrast|empty/.test(w)))){const g=used.find(u=>u.id===r.genome);if(g)brain.nudge((await registerTraits(g)).filter(id=>/pt-(tone|fill|accent|shadow|backdrop)-/.test(id)),false,'quality-harness:'+r.genome);}}catch{/* optional */}}
 const out=path.join(outRoot(),report.at.replace(/[:.]/g,'-'));await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,1)+'\n');await fs.writeFile(path.join(out,'report.md'),markdown(report));
 return {report,dir:out};
}

export function markdown(r:HarnessReport){
 const p=r.previous;
 return `# Quality report (${r.at.slice(0,16).replace('T',' ')}, version ${r.version})

Score **${r.summary.score}** · Passed **${Math.round(r.summary.passRate*100)}%** of ${r.rows.length} videos · Hard issues ${r.summary.hard} · Soft issues ${r.summary.soft}${p?` · Previous run ${p.score} (${p.delta>=0?'+':''}${p.delta})${p.regression?' **REGRESSION**':''}`:''}

By script: ${Object.entries(r.summary.byScript).map(([k,v])=>`${k} ${v}`).join(' · ')}

${r.summary.failingTraits.length?`Traits most often in failing styles: ${r.summary.failingTraits.map(t=>`${t.trait} (${Math.round(t.failRate*100)}% of ${t.uses})`).join(', ')}\n`:''}
| Script | Style | Score | Hard | Soft | Effects (LUFS, cues/s) | Worst |
| --- | --- | --- | --- | --- | --- | --- |
${r.rows.map(x=>`| ${x.script} | ${x.style} | ${x.score} | ${x.hard} | ${x.soft} | ${x.sound.bedLufs??'-'}, ${x.sound.cuesPerSecond}${x.sound.issues.length?' ('+x.sound.issues.join('; ')+')':''} | ${(x.worst[0]??'').replace(/\|/g,'/')} |`).join('\n')}
`;
}
