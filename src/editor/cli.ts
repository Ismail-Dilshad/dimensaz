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
else console.log(JSON.stringify(await runEdl(raw,path.dirname(file),{output:v.output}),null,2));
