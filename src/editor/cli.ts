// tempoloom edit --edl EDIT.json [--output FILE] [--validate]
// tempoloom edit auto FOOTAGE [options]: talking-head footage edited automatically (auto-edit.ts)
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {edlSchema} from './edl.js';
import {runEdl} from './editor.js';

if(['help','--help','-h'].includes(process.argv[2]??'')){console.log('Usage: tempoloom edit auto FILE [--plan] [options]   a talking head, edited automatically\n       tempoloom edit text FOOTAGE | DOC [changes]   edit by its words (fillers, takes, openings, b-roll)\n       tempoloom edit broll add CLIP... | describe | list   your own clips, for b-roll\n       tempoloom edit export EDIT.json | TEXT-EDIT [--to premiere,resolve,fcp,edl,capcut]   a timeline for another editor\n       tempoloom edit --edl EDIT.json [--output FILE] [--validate]\n\nSee src/editor/README.md for every operation; tempoloom edit auto (no file) lists its options.');process.exit(0);}
if(process.argv[2]==='auto'){await autoCommand(process.argv.slice(3));process.exit(process.exitCode??0);}
if(process.argv[2]==='text'){await textCommand(process.argv.slice(3));process.exit(process.exitCode??0);}
if(process.argv[2]==='captions'){await captionsCommand(process.argv.slice(3));process.exit(process.exitCode??0);}
if(process.argv[2]==='export'){const a=process.argv.slice(3),flag=(k:string)=>{const i=a.indexOf(k);return i>=0?a[i+1]:undefined;},what=a.find((x,i)=>!x.startsWith('--')&&!a[i-1]?.startsWith('--'));
 const {targets,exportTimeline}=await import('./timeline-export.js'),to=(flag('--to')??'premiere,resolve,fcp,edl').split(',').map(s=>s.trim());
 const bad=to.filter(t=>!(targets as readonly string[]).includes(t));
 if(!what||bad.length){console.error(`Usage: tempoloom edit export EDIT.json | TEXT-EDIT [--to ${targets.join(',')}] [--out FOLDER] [--name NAME]${bad.length?'\nUnknown: '+bad.join(', '):''}`);process.exit(1);}
 const t=to as (typeof targets[number])[],fsx=await import('node:fs');
 const r=fsx.existsSync(what)?await exportTimeline(what,{to:t,...(flag('--out')?{out:flag('--out')!}:{}),...(flag('--name')?{name:flag('--name')!}:{})}):await (await import('./text-edit.js')).exportDoc(what,t,{...(flag('--out')?{out:flag('--out')!}:{})});
 console.log(JSON.stringify(r,null,2));process.exit(0);}
if(process.argv[2]==='broll'){await brollCommand(process.argv.slice(3));process.exit(process.exitCode??0);}
const {values:v}=parseArgs({options:{edl:{type:'string'},output:{type:'string'},validate:{type:'boolean'}}});
if(!v.edl){console.log('Usage: tempoloom edit --edl EDIT.json [--output FILE] [--validate]\nSee src/editor/README.md for operations.');process.exit(1);}
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
 const usage=`Usage: tempoloom edit auto FOOTAGE [--transcript WORDS.json] [--language en|ckb|ar|fa] [--like LOOK] [--brand]
                     [--no-visuals] [--no-zooms] [--no-captions] [--no-music] [--no-sounds] [--caption-style NAME] [--max-pause 0.6] [--plan] [--out DIR]

Edits talking-head footage from the speech: cuts pauses and fillers, alternates punch-ins to hide the
jump cuts, designs visuals from zero for the moments worth showing (a figure, a list, a change, a
quotation, the call to action) and lays them over the speaker as the words are said, adds captions
and music under the voice. --plan writes edit.json and plan.md without rendering; edit them and run
pnpm tempoloom edit --edl DIR/edit.json. Uses ElevenLabs speech-to-text unless --transcript is given.`;
 const file=args[0];if(!file||file.startsWith('--')){console.log(usage);return;}
 const flag=(n:string)=>{const i=args.indexOf(n);return i>=0&&args[i+1]&&!args[i+1]!.startsWith('--')?args[i+1]:undefined;};
 const {autoEdit}=await import('./auto-edit.js');
 try{const r=await autoEdit(file,{transcript:flag('--transcript'),language:flag('--language') as never,like:flag('--like'),brand:args.includes('--brand'),
  visuals:!args.includes('--no-visuals'),zooms:!args.includes('--no-zooms'),captions:!args.includes('--no-captions'),music:args.includes('--no-music')?'off':'auto',
  maxPause:flag('--max-pause')?Number(flag('--max-pause')):undefined,sounds:!args.includes('--no-sounds'),captionStyle:flag('--caption-style'),plan:args.includes('--plan'),out:flag('--out'),onStep:s=>console.error('… '+s)});
  console.log(JSON.stringify(r,null,2));}
 catch(e){console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;}
}

function textUsage(){return `Usage: tempoloom edit text                                  your text edits
       tempoloom edit text FOOTAGE [--transcript WORDS.json] [--language en|ckb|ar|fa] [--job STUDIO_JOB] [--title "NAME"]
                                                           read footage into an edit by text (ElevenLabs speech-to-text
                                                           unless --transcript is given)
       tempoloom edit text DOC                             its sentences, every cut and why, takes, openings, b-roll
       tempoloom edit text DOC [--cut N] [--keep N] [--cut-words FROM-TO] [--toggle CUT_ID on|off]
                               [--all filler|pause|take|start|end on|off] [--take GROUP N] [--hook RANK|none [--move]]
                               [--shape 9:16|1:1|4:5|16:9|none [--track TRACK.json]] [--broll N on|off] [--refresh-broll]
                               [--captions on|off] [--edl] [--render]

Striking a sentence (--cut N) cuts it; --keep N brings it back (a take the studio cut too). Fillers,
long pauses and every take of a line but the strongest are cut from the start, each with why; turn any
back on or off. --hook opens the video with one of the ten ranked openings (played first, and still in
its place unless --move). --shape crops to a shape that follows the speaker's face (media tools, or
--track from media reframe). --broll accepts the shot suggested from your own clips for sentence N.
--edl prints the edit list; --render makes the video. Also on the page: Studio, Edit by text.`;}
async function textCommand(args:string[]){
 const T=await import('./text-edit.js'),out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
 const {values:v,positionals:p}=parseArgs({args,allowPositionals:true,options:{transcript:{type:'string'},language:{type:'string'},job:{type:'string'},title:{type:'string'},cut:{type:'string'},keep:{type:'string'},
  'cut-words':{type:'string'},toggle:{type:'string',multiple:true},all:{type:'string',multiple:true},take:{type:'string',multiple:true},hook:{type:'string'},move:{type:'boolean'},shape:{type:'string'},track:{type:'string'},
  broll:{type:'string',multiple:true},'refresh-broll':{type:'boolean'},captions:{type:'string'},edl:{type:'boolean'},render:{type:'boolean'},help:{type:'boolean'}}});
 try{
  if(v.help)return console.log(textUsage());
  const target=p[0];
  if(!target)return out({edits:T.docs().map(d=>({id:d.id,title:d.title,input:d.input,updated:d.updated,job:d.job??null}))});
  // A file: read it into a new text edit; anything else is the name of one.
  if(/[\\/.]/.test(target)){const d=await T.createDoc(target,{...(v.transcript?{transcript:v.transcript}:{}),...(v.language?{language:v.language as never}:{}),...(v.job?{job:v.job}:{}),...(v.title?{title:v.title}:{})});
   const w=T.docView(d.id);return out({id:d.id,seconds:{before:+d.duration.toFixed(2),after:w.seconds},counts:w.counts,takes:w.takes.map(t=>t.why),hooks:w.hooks.slice(0,3).map(h=>`${h.rank}. ${h.at} "${h.text}" (${h.why.join(', ')})`),broll:w.broll.length,
    next:`pnpm tempoloom edit text ${d.id} to see every sentence and cut; change it, then --render`});}
  const id=target,on=(x:string|undefined)=>{if(x!=='on'&&x!=='off')throw new Error('Say on or off');return x==='on';};
  if(v.cut)T.cutSentence(id,Number(v.cut),true);
  if(v.keep)T.cutSentence(id,Number(v.keep),false);
  if(v['cut-words']){const [a,b]=v['cut-words'].split('-').map(Number);T.cutWords(id,a!,(b??a!)+1);}
  for(const t of v.toggle??[]){const [rid,state]=t.split(/[ =]/);T.toggle(id,rid!,on(state??p[1]));}
  for(const t of v.all??[]){const [kind,state]=t.split(/[ =]/);T.toggleKind(id,kind as never,on(state??p[1]));}
  for(const t of v.take??[]){const [g,n]=t.split(/[ =]/);T.pickTake(id,g!,Number(n??p[1]));}
  if(v.hook)T.setHook(id,v.hook==='none'?null:Number(v.hook),!!v.move);
  if(v.shape)await T.setShape(id,v.shape==='none'?null:v.shape as never,{...(v.track?{track:v.track}:{})});
  for(const b of v.broll??[]){const [n,state]=b.split(/[ =]/);T.setBroll(id,Number(n),on(state??p[1]));}
  if(v['refresh-broll'])T.refreshBroll(id);
  if(v.captions)T.setCaptions(id,on(v.captions));
  if(v.edl)return out(T.compile(T.readDoc(id)));
  if(v.render)return out(await T.render(id));
  return out(T.docView(id));
 }catch(e){console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;}
}
async function brollCommand(args:string[]){
 const B=await import('./broll.js'),out=(x:unknown)=>console.log(JSON.stringify(x,null,2)),[cmd='list',...rest]=args;
 try{
  switch(cmd){
   case 'list':return out({clips:B.library().map(c=>({id:c.id,name:c.name,file:c.file,shots:c.shots.map(s=>({shot:s.n,from:s.start,to:s.end,description:s.description,by:s.by,sheet:s.sheet}))}))});
   case 'add':if(!rest.length)throw new Error('edit broll add CLIP.mp4 [CLIP2.mp4 ...]');return out(await B.addClips(rest));
   case 'describe':{const [clip,shot,...text]=rest.filter(x=>x!=='--agent');if(!clip||!shot||!text.length)throw new Error('edit broll describe CLIP SHOT "WHAT IT SHOWS" [--agent]');return out(B.describe(clip,Number(shot),text.join(' '),rest.includes('--agent')?'agent':'you'));}
   case 'remove':if(!rest[0])throw new Error('edit broll remove CLIP');return out(B.removeClip(rest[0]));
   default:console.log(`Usage: tempoloom edit broll list | add CLIP... | describe CLIP SHOT "WHAT IT SHOWS" [--agent] | remove CLIP

Your own clips, for b-roll: each is split into shots, each shot gets a sheet of three frames and a
description (from the file name first). Describe a shot after looking at its sheet; edits by text
suggest the shot whose description says what a sentence says. The clips stay where they are.`);if(cmd!=='help')process.exitCode=1;
  }
 }catch(e){console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;}
}

async function captionsCommand(args:string[]){
 const C=await import('./caption-styles.js'),out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
 const {values:v,positionals:[cmd='list',name]}=parseArgs({args,allowPositionals:true,options:{from:{type:'string'},style:{type:'string'},reveal:{type:'string'},highlight:{type:'string'},color:{type:'string'},stroke:{type:'string'},
  background:{type:'string'},size:{type:'string'},weight:{type:'string'},'stroke-width':{type:'string'},upper:{type:'boolean'},keyword:{type:'boolean'},about:{type:'string'},default:{type:'boolean'}}});
 try{
  switch(cmd){
   case 'list':{const s=C.captionStyles();return out({default:s.default,styles:s.styles.map(x=>({name:x.name,label:x.label,about:x.about,yours:x.yours,fields:x.fields}))});}
   case 'save':{if(!name)throw new Error('edit captions save NAME [--from STYLE] [--style phrase|word|karaoke|build] [--reveal none|fade|pop|rise|slide] [--highlight #FFD400] [--size 0.06] [--upper] [--keyword] [--default]');
    const f:Record<string,unknown>={};for(const k of ['style','reveal','highlight','color','stroke','background','size','weight'] as const)if(v[k]!==undefined)f[k]=v[k];
    if(v['stroke-width']!==undefined)f.strokeWidth=v['stroke-width'];if(v.upper)f.upper=true;if(v.keyword)f.keyword=true;
    return out(C.saveStyle(name,{...(v.from?{from:v.from}:{}),fields:f,...(v.about?{about:v.about}:{}),makeDefault:!!v.default}));}
   case 'default':if(!name)throw new Error('edit captions default NAME');return out(C.setDefault(name));
   case 'remove':if(!name)throw new Error('edit captions remove NAME');return out(C.removeStyle(name));
   default:console.log(`Usage: tempoloom edit captions list | save NAME [--from STYLE] [changes] [--default] | default NAME | remove NAME

Caption styles: a phrase at a time, one word at a time, karaoke (the spoken word lit), or words
building up; the key word lit; how each comes in (fade, pop, rise, slide). Save your own from any
style with your changes; the default one is used by new edits. In an edit list: "preset": "NAME".`);if(cmd!=='help')process.exitCode=1;
  }
 }catch(e){console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;}
}
