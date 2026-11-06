import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../renderer/browser-path.js';
const folder=path.resolve('workspace/reference-production-assets');
const files=await fs.readdir(folder);
const names=files.filter(n=>n.endsWith('.png')&&files.includes(n.slice(0,-4)+'.metadata.json'));
const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
try{
 const page=await browser.newPage({viewport:{width:960,height:names.length*250}});
 await page.route('**/*',r=>r.abort());
 const rows=await Promise.all(names.map(async name=>{
 const data=(await fs.readFile(path.join(folder,name))).toString('base64');
 return '<section><label>'+name+'</label>'+['#ffffff','#e8eafa','#0a0a0b'].map(color=>'<div style="background:'+color+'"><img src="data:image/png;base64,'+data+'"></div>').join('')+'</section>';
 }));
 await page.setContent('<style>body{margin:0;font:16px sans-serif}section{height:250px;display:flex;position:relative}label{position:absolute;z-index:2;background:white;padding:4px}section>div{width:320px;height:250px;display:grid;place-items:center}img{width:288px;height:225px;object-fit:contain}</style>'+rows.join(''));
 await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));});
 const file=path.join(folder,'asset-inspection.png');await page.screenshot({path:file});console.log(file);
}finally{await browser.close();}
