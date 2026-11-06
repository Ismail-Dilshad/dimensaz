// List the agent's tool registry.
import {parseArgs} from 'node:util';
import {readRegistry} from './tools-registry.js';
const {values:v}=parseArgs({options:{category:{type:'string'},status:{type:'string'},json:{type:'boolean'}}});
const tools=(await readRegistry()).tools.filter(t=>(!v.category||t.category===v.category)&&(!v.status||t.status===v.status));
if(v.json)console.log(JSON.stringify(tools,null,2));
else for(const category of [...new Set(tools.map(t=>t.category))]){
 console.log('\n'+category);
 for(const t of tools.filter(x=>x.category===category))console.log(`  ${t.status==='planned'?'(planned) ':''}${t.id.padEnd(22)} ${t.description}`);
}
