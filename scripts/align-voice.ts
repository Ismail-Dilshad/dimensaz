import fs from 'node:fs/promises';
import {load,revise,save,dir,writeJSON} from '../src/engine/project.js';
import {applyWordAlignment,fromCharacterAlignment,voiceAlignmentSchema,audioHash} from '../src/engine/voice-alignment.js';
const args=process.argv.slice(2),value=(flag:string)=>args[args.indexOf(flag)+1];
if(!args.includes('--project')||!args.includes('--file'))throw new Error('Use --project ID --file alignment.json; a new revision is always created.');
const previous=await load(value('--project')),data=JSON.parse(await fs.readFile(value('--file'),'utf8'));
let evidence:unknown=data;
if(args.includes('--provider-characters')){
 if(!args.includes('--reviewed')||!args.includes('--source'))throw new Error('Review character timing against the voice before --reviewed; --source is required.');
 evidence=fromCharacterAlignment(previous.script,data,{audioSha256:await audioHash(previous),method:'provider',source:value('--source'),reviewed:true});
}
voiceAlignmentSchema.parse(evidence);
const p=await revise(previous.id);await applyWordAlignment(p,evidence);await save(p);
await writeJSON(dir(p.id,p.config)+'/alignment.json',evidence);
console.log(JSON.stringify({project:p.id,wordCount:p.scenes.reduce((n,s)=>n+(s.wordCues?.length||0),0),voiceTiming:p.config.voiceTiming},null,2));
