import fs from 'node:fs/promises';
import type {BrowserContext} from 'playwright';
export async function contactSheet(context:BrowserContext,files:string[],times:number[],output:string){
 const columns=Math.min(3,files.length);
 const data=await Promise.all(files.map(f=>fs.readFile(f).then(b=>Buffer.from(b).toString('base64'))));
 const page=await context.newPage();
 await page.setViewportSize({width:columns*286,height:Math.min(16000,Math.ceil(files.length/columns)*530)});
 try{
 const figures=data.map((src,i)=>'<figure><img src="data:image/png;base64,'+src+'"><figcaption>'+times[i].toFixed(2)+'s</figcaption></figure>').join('');
 await page.setContent('<!doctype html><style>body{margin:0;padding:8px;background:#e9edf5;display:grid;grid-template-columns:repeat('+columns+',270px);gap:16px;align-items:start}figure{margin:0}img{width:270px;display:block}figcaption{padding:5px;font:13px sans-serif}</style>'+figures);
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 await page.screenshot({path:output,fullPage:true});
 }finally{await page.close();}
}


