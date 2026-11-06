import fs from 'node:fs/promises';
import {download} from '../engine/asset-download.js';
const folder='workspace/reference-production-assets/providers';
await fs.mkdir(folder,{recursive:true});
for(const [name,url,hosts] of [
 ['kenney-ui','https://kenney.nl/assets/ui-audio',['kenney.nl','www.kenney.nl']],
 ['ambient-paper','https://ambientcg.com/api/v2/full_json?id=Paper001&include=downloadData',['ambientcg.com']],
] as const){
 try{const result=await download(url,[...hosts],{limit:2*1024*1024});
 await fs.writeFile(folder+'/'+name+'.txt',result.bytes);
 console.log(name,result.finalUrl,result.bytes.toString('utf8').startsWith('{')?result.bytes.toString('utf8'):[...result.bytes.toString('utf8').matchAll(/href="([^"]+)"/g)].map(m=>m[1]).filter(s=>/download|zip|license/i.test(s)));
 }catch(error){console.log(name,String(error));}
}
