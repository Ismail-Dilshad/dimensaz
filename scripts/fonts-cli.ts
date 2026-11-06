import {parseArgs} from 'node:util';
import fs from 'node:fs/promises';
import {fontCatalog,recommendFonts} from '../src/engine/font-catalog.js';
const {positionals,values}=parseArgs({allowPositionals:true,options:{text:{type:'string'},file:{type:'string'},role:{type:'string'}}});
async function main(){if(positionals[0]==='list')return fontCatalog();if(positionals[0]==='recommend'){const text=values.file?await fs.readFile(values.file,'utf8'):values.text;if(!text)throw new Error('Supply exact text or UTF-8 script file');return recommendFonts(text,values.role);}throw new Error('Expected list or recommend');}
main().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(JSON.stringify({error:String(e)}));process.exitCode=1;});
