// A render that stopped (a crash, a closed laptop, a full disk) continues from its last finished
// scene. Each scene is rendered into its own piece, kept under render-cache/scenes/FINGERPRINT until
// the whole video is done; the pieces join without encoding again. The fingerprint covers the whole
// project and the renderer, so a piece is only reused for exactly the same video.
import fs from 'node:fs/promises';
import path from 'node:path';
import type {Page} from 'playwright';
import type {Project,Config} from '../engine/schema.js';
import {frames} from './frame-renderer.js';
import {frameCount} from './performance.js';
import {ffmpeg,run} from './ffmpeg-encoder.js';

const exists=(f:string)=>fs.access(f).then(()=>true,()=>false);
/** Where each scene's frames start and end, covering every frame of the video once. */
export function sceneRanges(p:Pick<Project,'scenes'>,c:Pick<Config,'fps'>,duration:number){
 const total=frameCount(duration,c.fps);
 const starts=[...new Set(p.scenes.map(s=>Math.max(0,Math.min(total,Math.round(s.start*c.fps)))))].sort((a,b)=>a-b);
 if(starts[0]!==0)starts.unshift(0);
 return starts.map((from,i)=>({scene:i+1,from,to:i+1<starts.length?starts[i+1]!:total})).filter(r=>r.to>r.from);
}
export const sceneDir=(projectDir:string,fingerprint:string,codec:string)=>path.join(projectDir,'render-cache','scenes',`${fingerprint.slice(0,32)}-${codec}`);

/** Renders the video scene by scene into `file`, reusing the scenes a stopped render finished. */
export async function renderByScene(pages:Page[],p:Project,c:Config,duration:number,file:string,o:{projectDir:string;fingerprint:string}){
 const dir=sceneDir(o.projectDir,o.fingerprint,c.codec),ranges=sceneRanges(p,c,duration);
 await fs.mkdir(dir,{recursive:true});
 const piece=(i:number)=>path.join(dir,String(i).padStart(3,'0')+'.mp4'),done=(i:number)=>piece(i)+'.done.json';
 let reused=0;
 const finished=await Promise.all(ranges.map(async(_,i)=>await exists(piece(i))&&await exists(done(i))));
 const first=finished.indexOf(false);
 if(first>0||(first<0&&ranges.length))console.error(first<0?`Every scene was rendered before; joining them.`:`Continuing from scene ${first+1} of ${ranges.length}: scene${first>1?'s 1 to '+first:' 1'} finished before.`);
 const stats:Record<string,unknown>[]=[];
 for(const [i,r] of ranges.entries()){
  if(finished[i]){try{const d=JSON.parse(await fs.readFile(done(i),'utf8')) as {from:number;to:number};if(d.from===r.from&&d.to===r.to){reused++;continue;}}catch{/* rendered again below */}}
  const part=piece(i)+'.part.mp4';await fs.rm(part,{force:true});
  stats.push(await frames(pages,c,duration,part,{from:r.from,to:r.to}));
  await fs.rename(part,piece(i));await fs.rm(part+'.performance.json',{force:true});
  await fs.writeFile(done(i),JSON.stringify({scene:r.scene,from:r.from,to:r.to,at:new Date().toISOString()}));
 }
 const list=path.join(dir,'pieces.txt');
 await fs.writeFile(list,ranges.map((_,i)=>`file '${piece(i).replace(/'/g,"'\\''")}'`).join('\n')+'\n');
 await run(ffmpeg,['-v','error','-n','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',file]);
 return {scenes:ranges.length,reused,rendered:ranges.length-reused,dir,stats};
}
/** Removes the pieces of a finished render. */
export const dropPieces=(dir:string)=>fs.rm(dir,{recursive:true,force:true});
/** Removes pieces kept for videos that changed since (they can never be reused). */
export async function dropStalePieces(projectDir:string,keep:string){
 const base=path.join(projectDir,'render-cache','scenes');let names:string[]=[];try{names=await fs.readdir(base);}catch{return [];}
 const gone=names.filter(n=>!n.startsWith(keep.slice(0,32)));for(const n of gone)await fs.rm(path.join(base,n),{recursive:true,force:true});return gone;
}
/** What a stopped render left: how many scenes are finished, for `--resume` messages. */
export async function piecesLeft(projectDir:string,fingerprint:string,codec:string){
 const dir=sceneDir(projectDir,fingerprint,codec);try{return (await fs.readdir(dir)).filter(n=>n.endsWith('.done.json')).length;}catch{return 0;}
}
