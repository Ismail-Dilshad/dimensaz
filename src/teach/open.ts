// Opens the local pages (Teach and Studio share one server on this computer).
import {spawn} from 'node:child_process';
import {sync} from '../engine/brain/brain.js';

export async function openPage(page:'teach'|'studio',o:{port?:number;browser?:boolean}={}){
 sync();
 const {serve}=await import('./server.js');
 const s=await serve({...(o.port?{port:o.port}:{})});
 const url=page==='studio'?s.url.replace('/?k=','/studio?k='):s.url;
 console.log(`\n${page==='studio'?'Studio':'Teach'} page: ${url}\n\nOpen this link in your browser (it works on this computer only). Keep this terminal open; press Ctrl+C to stop.\n`+
  (page==='studio'?'Your agent takes requests and continues jobs with: pnpm tempoloom studio inbox\n':'When videos are waiting, your agent studies them with: pnpm tempoloom teach next\n'));
 if(o.browser!==false){const [exe,args]=process.platform==='win32'?['cmd',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
  try{spawn(exe as string,args as string[],{stdio:'ignore',detached:true,windowsHide:true}).on('error',()=>undefined).unref();}catch{/* the link is printed */}}
 await new Promise<void>(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
 await s.close();
}
