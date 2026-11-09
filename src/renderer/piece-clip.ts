// Renders designed visuals (scene pieces) as transparent clips (QuickTime Animation .mov with
// alpha), to lay over footage with the editor's overlay operation. Same builder, styles, fonts
// and timing as the motion renderer; frames are captured with a transparent background.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {ROOT,LATIN_FALLBACK} from '../engine/config.js';
import {chromiumExecutable} from './browser-path.js';
import {ffmpeg,run} from './ffmpeg-encoder.js';
import {skinFor} from '../components/pieces/skins.js';
import type {Piece,PieceTheme} from '../engine/scene-pieces-schema.js';

let bundled:ReturnType<typeof build>|undefined;
const clipBundle=()=>bundled??=build({entryPoints:[path.join(ROOT,'src/components/pieces/clip-entry.ts')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'}).catch(e=>{bundled=undefined;throw e;});
const fontFace=async(family:string,file:string)=>`@font-face{font-family:${family};src:url(data:font/ttf;base64,${(await fs.readFile(path.resolve(ROOT,file))).toString('base64')});font-weight:100 900;font-display:block;}`;

export type Clip={piece:Piece;duration:number;out:string};
/** Renders each clip to its .mov (w×h pixels, fps frames a second), sharing one browser. */
export async function renderPieceClips(clips:Clip[],o:{theme:PieceTheme;width:number;height:number;fps:number;font:string;dir:'ltr'|'rtl'}){
 if(!clips.length)return [];
 const sk=skinFor(o.theme.genome);
 const css=[await fontFace('VideoPrimary',o.font),await fontFace('VideoFallback0',LATIN_FALLBACK),
  ...(sk.fonts.display?[await fontFace('PieceDisplay-'+sk.id,sk.fonts.display)]:[]),...(sk.fonts.numbers??sk.fonts.display?[await fontFace('PieceNumbers-'+sk.id,(sk.fonts.numbers??sk.fonts.display)!)]:[])].join('');
 const bundle=(await clipBundle()).outputFiles![0]!.text;
 const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
 const out:string[]=[];
 try{
  for(const c of clips){
   const page=await browser.newPage({viewport:{width:o.width,height:o.height},deviceScaleFactor:1});
   const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'dz-clip-'));
   try{
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}html,body{margin:0;background:transparent;overflow:hidden;font-family:VideoPrimary,VideoFallback0,sans-serif}</style></head><body></body></html>`);
    await page.addScriptTag({content:bundle});
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(x=>window.setupClip(x),{piece:c.piece,theme:o.theme,w:o.width,h:o.height,dir:o.dir,duration:c.duration});
    const frames=Math.max(1,Math.round(c.duration*o.fps));
    for(let f=0;f<frames;f++){await page.evaluate(t=>window.renderClip(t),f/o.fps);await page.screenshot({path:path.join(tmp,String(f).padStart(5,'0')+'.png'),omitBackground:true});}
    await fs.mkdir(path.dirname(c.out),{recursive:true});
    await run(ffmpeg,['-v','error','-y','-framerate',String(o.fps),'-i',path.join(tmp,'%05d.png'),'-c:v','qtrle','-pix_fmt','argb',c.out]);
    out.push(c.out);
   }finally{await page.close();await fs.rm(tmp,{recursive:true,force:true});}
  }
 }finally{await browser.close();}
 return out;
}
