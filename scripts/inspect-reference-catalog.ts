import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../renderer/browser-path.js';
const b=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
try{
 const page=await b.newPage({viewport:{width:1400,height:1000}});
 await page.setContent(await fs.readFile('workspace/reference-production-assets/asset-catalog.html','utf8'));
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 const result=await page.evaluate(()=>({images:[...document.images].map(i=>({width:i.naturalWidth,height:i.naturalHeight})),audio:document.querySelectorAll('audio').length,overflow:document.documentElement.scrollWidth>innerWidth}));
 if(result.images.length!==7||result.audio!==8||result.overflow)throw new Error(JSON.stringify(result));
 await page.screenshot({path:'workspace/reference-production-assets/catalog-preview.png'});
 console.log(result);
}finally{await b.close();}
