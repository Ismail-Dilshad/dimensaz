// dimensaz edit --edl EDIT.json [--output FILE] [--validate]
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {edlSchema} from './edl.js';
import {runEdl} from './editor.js';

const {values:v}=parseArgs({options:{edl:{type:'string'},output:{type:'string'},validate:{type:'boolean'}}});
if(!v.edl){console.log('Usage: dimensaz edit --edl EDIT.json [--output FILE] [--validate]\nSee src/editor/README.md for operations.');process.exit(1);}
const file=path.resolve(v.edl);
const raw=JSON.parse(await fs.readFile(file,'utf8'));
if(v.validate){const edl=edlSchema.parse(raw);console.log(JSON.stringify({valid:true,operations:edl.operations.map(o=>o.op),export:edl.export.preset},null,2));}
else{
 const result=await runEdl(raw,path.dirname(file),{output:v.output});
 // Learning: every finished edit is recorded in the brain (never blocks the export).
 try{const {recordJob}=await import('../engine/brain/brain.js');const edl=edlSchema.parse(raw);
  recordJob({id:'edit-'+path.basename(result.output).replace(/\.[^.]+$/,''),kind:'edit',title:path.basename(result.output),brief:edl.operations.map(o=>o.op).join(', '),
   durationSeconds:Number((result.info as {duration?:number}|undefined)?.duration??0)||null,transitions:edl.operations.map(o=>o.op),output:result.output,checks:{operations:edl.operations.length}});
 }catch(e){console.error('brain: '+String(e));}
 console.log(JSON.stringify(result,null,2));
}
