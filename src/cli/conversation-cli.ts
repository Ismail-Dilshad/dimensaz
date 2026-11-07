import fs from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {beginBrief,answerBrief,prepareBrief,finishBrief} from '../engine/conversation.js';
const {values:v}=parseArgs({args:process.argv.slice(3),options:{file:{type:'string'},session:{type:'string'},text:{type:'string'},'approve-preview':{type:'boolean'}}});
const cmd=process.argv[2];
(async()=>{
 if(cmd==='brief'){if(!v.file)throw new Error('--file required');return beginBrief(JSON.parse(await fs.readFile(v.file,'utf8')));}
 if(!v.session)throw new Error('--session required');
 if(cmd==='answer')return answerBrief(v.session,v.text||'');
 if(cmd==='prepare')return prepareBrief(v.session);
 if(cmd==='finish')return finishBrief(v.session,!!v['approve-preview']);
 throw new Error('Unknown conversational workflow command');
})().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(String(e));process.exitCode=1;});
