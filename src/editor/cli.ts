// dimensaz edit --edl EDIT.json [--output FILE] [--validate]
// dimensaz edit auto FOOTAGE [options]: talking-head footage edited automatically (auto-edit.ts)
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {edlSchema} from './edl.js';
import {runEdl} from './editor.js';

if(process.argv[2]==='auto'){await autoCommand(process.argv.slice(3));process.exit(process.exitCode??0);}
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

async function autoCommand(args:string[]){
 const usage=`Usage: dimensaz edit auto FOOTAGE [--transcript WORDS.json] [--language en|ckb|ar|fa] [--like LOOK] [--brand]
                     [--no-visuals] [--no-zooms] [--no-captions] [--no-music] [--max-pause 0.6] [--plan] [--out DIR]

Edits talking-head footage from the speech: cuts pauses and fillers, alternates punch-ins to hide the
jump cuts, designs visuals from zero for the moments worth showing (a figure, a list, a change, a
quotation, the call to action) and lays them over the speaker as the words are said, adds captions
and music under the voice. --plan writes edit.json and plan.md without rendering; edit them and run
pnpm dimensaz edit --edl DIR/edit.json. Uses ElevenLabs speech-to-text unless --transcript is given.`;
 const file=args[0];if(!file||file.startsWith('--')){console.log(usage);return;}
 const flag=(n:string)=>{const i=args.indexOf(n);return i>=0&&args[i+1]&&!args[i+1]!.startsWith('--')?args[i+1]:undefined;};
 const {autoEdit}=await import('./auto-edit.js');
 try{const r=await autoEdit(file,{transcript:flag('--transcript'),language:flag('--language') as never,like:flag('--like'),brand:args.includes('--brand'),
  visuals:!args.includes('--no-visuals'),zooms:!args.includes('--no-zooms'),captions:!args.includes('--no-captions'),music:args.includes('--no-music')?'off':'auto',
  maxPause:flag('--max-pause')?Number(flag('--max-pause')):undefined,plan:args.includes('--plan'),out:flag('--out'),onStep:s=>console.error('… '+s)});
  console.log(JSON.stringify(r,null,2));}
 catch(e){console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;}
}
