import {parseArgs} from 'node:util';import fs from 'node:fs/promises';
import {beginDirector,answerDirector,readDirector,directorView,preset,installDirectorPresets} from '../src/engine/style-director.js';
import {applyDirector,planDirectorSound,editDirectorSound} from '../src/engine/director-integration.js';import {revise,save,load} from '../src/engine/project.js';
const {values:v}=parseArgs({args:process.argv.slice(3),options:{file:{type:'string'},session:{type:'string'},text:{type:'string'},name:{type:'string'},target:{type:'string'},project:{type:'string'},confirm:{type:'boolean'}}});
const cmd=process.argv[2];
(async()=>{
 if(cmd==='init')return {presets:await installDirectorPresets()};
 if(cmd==='begin'){if(!v.file)throw new Error('--file required');return beginDirector(JSON.parse(await fs.readFile(v.file,'utf8')));}
 if(cmd==='show'){if(!v.session)throw new Error('--session required');return directorView(await readDirector(v.session));}
 if(cmd==='answer'){if(!v.session)throw new Error('--session required');return answerDirector(v.session,v.text||'');}
 if(cmd==='apply'){if(!v.session||!v.project)throw new Error('--session and --project required');const s=await readDirector(v.session);if(!s.style.confirmed)throw new Error('Confirm the summary first');const p=await revise(v.project);applyDirector(p,s.style);await planDirectorSound(p);await save(p);return {project:p.id,summary:s.style,next:'Generate and inspect a fresh preview before rendering.'};}
 if(cmd==='sound-edit'){if(!v.project||!v.name||!v.text)throw new Error('--project --name EVENT_ID --text JSON required');const p=await revise(v.project);const event=await editDirectorSound(p,v.name,JSON.parse(v.text));return {project:p.id,event};}
 if(cmd==='previous'){if(!v.project)throw new Error('--project required');const p=await load(v.project);if(!p.config.director)throw new Error('This legacy video has no saved unified director style');return beginDirector({script:p.script,voice:p.media.some(m=>m.kind==='voice'),previous:p.config.director});}
 if(['save','load','duplicate','rename','default','delete','list'].includes(cmd))return preset(cmd as any,v.name||'',v.session,v.target,!!v.confirm);
 throw new Error('Use begin, answer, show, apply, previous, save, load, duplicate, rename, default, delete, list');
})().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(String(e));process.exitCode=1;});
