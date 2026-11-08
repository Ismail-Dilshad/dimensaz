import {projectAssets} from '../engine/asset-locks.js';
import {chromiumExecutable} from './browser-path.js';
import {chromium,type Browser} from 'playwright';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from '../engine/config.js';
import {dir,inside} from '../engine/project.js';
import {assets} from '../engine/asset-selector.js';
import {checkGlyphs} from '../engine/text-shaper.js';
import type {Project} from '../engine/schema.js';
import {skinFor} from '../components/pieces/skins.js';
/** Fonts of the design styles the video's pieces use (bundled open fonts), added to the font list. */
async function pieceFontCss(p:Project,fontPaths:string[]){
 const used=new Set<string>();const base=p.config.pieces?.style;
 for(const s of p.scenes){if(!s.piece)continue;used.add(s.piece.style??base??'soft');}
 let css='';
 for(const id of used){const sk=skinFor(id);
  for(const [role,file] of [['Display',sk.fonts.display],['Numbers',sk.fonts.numbers??sk.fonts.display]] as const){if(!file)continue;
   fontPaths.push(path.resolve(ROOT,file));css+='@font-face{font-family:Piece'+role+'-'+sk.id+';src:url(http://video.local/font/'+(fontPaths.length-1)+');font-weight:100 900;font-display:block;}';}}
 return css;
}
export async function openRenderer(p:Project,scale=1,validatedEntries?:import('../engine/asset-selector.js').Asset[],sharedBrowser?:Browser){
 const glyphs=checkGlyphs(p.script,p.config),entries=validatedEntries??await projectAssets(p);
 const bundle=await build({entryPoints:[path.join(ROOT,'src/engine/compositor.ts')],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'});
 const fontPaths=[p.config.font,...p.config.fallbacks].map(f=>path.resolve(ROOT,f));
 const css=fontPaths.map((_,i)=>'@font-face{font-family:'+(i?'VideoFallback'+(i-1):'VideoPrimary')+';src:url(http://video.local/font/'+i+');font-weight:100 900;font-display:block;}').join('')+await pieceFontCss(p,fontPaths);
 const template=await fs.readFile(path.join(ROOT,'src/renderer/index.html'),'utf8');
 const data=JSON.stringify(p).replace(/</g,'\\u003c');
 const map=Object.fromEntries(entries.map(a=>[a.id,'http://video.local/asset/'+encodeURIComponent(a.id)]));
 const html=template.replace('<head>','<head><base href="http://video.local/">').replace('</head>','<style>'+css+'</style></head>').replace('</body>','<script>window.PROJECT='+data+';window.ASSETS='+JSON.stringify(map)+'</script><script src="http://video.local/bundle.js"></script></body>');
 const browser=sharedBrowser??await chromium.launch({headless:true,executablePath:chromiumExecutable(),args:['--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-breakpad','--disable-sync','--metrics-recording-only','--host-resolver-rules=MAP * ~NOTFOUND']});
 try{
 const context=await browser.newContext({viewport:{width:p.config.width,height:p.config.height},deviceScaleFactor:scale,offline:true});
 const page=await context.newPage();
 const resourceCache=new Map<string,Buffer>();
 const cachedRead=async(file:string)=>{let bytes=resourceCache.get(file);if(!bytes){bytes=await fs.readFile(file);resourceCache.set(file,bytes);}return bytes;};
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 // All resources are fulfilled from verified local files. No HTTP server,
 // localhost socket, remote asset request or network connection is needed.
 await page.route('**/*',async route=>{
  try{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname!=='video.local'){await route.abort('blockedbyclient');return;}
   let bytes:Buffer|Uint8Array|string;let type='application/octet-stream';
   const headers:Record<string,string>={'Access-Control-Allow-Origin':'*','Accept-Ranges':'bytes'};
   if(url.pathname==='/bundle.js'){bytes=bundle.outputFiles[0].contents;type='application/javascript';}
   else if(url.pathname.startsWith('/font/')){const n=Number(url.pathname.slice(6));if(!Number.isInteger(n)||!fontPaths[n])throw new Error('Unknown font');bytes=await cachedRead(fontPaths[n]);type='font/ttf';}
   else {
    let file:string|undefined;
    if(url.pathname.startsWith('/asset/')){const a=entries.find(a=>a.id===decodeURIComponent(url.pathname.slice(7)));if(a)file=path.resolve(ROOT,a.path);}
    if(url.pathname.startsWith('/media/')){const m=p.media.find(m=>m.id===decodeURIComponent(url.pathname.slice(7)));if(m)file=inside(dir(p.id,p.config),m.path);}
    if(!file){await route.fulfill({status:404,body:'Unknown local asset'});return;}
    const ext=path.extname(file).toLowerCase();type=({'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm'} as Record<string,string>)[ext]||type;
    const range=request.headers()['range'];
    if(range){const size=(await fs.stat(file)).size,match=/bytes=(\d+)-(\d*)/.exec(range);if(!match)throw new Error('Invalid range');
     const start=Number(match[1]),end=Math.min(match[2]?Number(match[2]):size-1,size-1,start+8*1024*1024-1);
     if(start>=size){await route.fulfill({status:416,headers:{'Content-Range':'bytes */'+size}});return;}
     const handle=await fs.open(file,'r');const chunk=Buffer.alloc(end-start+1);try{await handle.read(chunk,0,chunk.length,start);}finally{await handle.close();}
     await route.fulfill({status:206,contentType:type,headers:{...headers,'Content-Range':'bytes '+start+'-'+end+'/'+size},body:chunk});return;
    }
    bytes=await cachedRead(file);
   }
   await route.fulfill({status:200,contentType:type,headers,body:Buffer.from(bytes)});
  }catch(e){errors.push(String(e));await route.fulfill({status:500,body:'Local asset failed'});}
 });
 await page.setContent(html,{waitUntil:'load'});
 await page.evaluate(()=>window.ready);
 if(errors.length)throw new Error(errors.join('\n'));
 return {page,browser,glyphs,close:async()=>{await context.close();if(!sharedBrowser)await browser.close();}};
 }catch(e){if(!sharedBrowser)await browser.close();throw e;}
}



