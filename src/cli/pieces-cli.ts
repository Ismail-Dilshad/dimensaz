// `pnpm tempoloom pieces`: scene visuals are designed from zero for every video. This shows what
// the designer makes of a sentence, the layers a visual is built from, the sound kits, and
// checks a request's sceneVisuals.
import fs from 'node:fs/promises';
import {sceneVisualSchema,icons,layerSchema,shapes3d,materials3d,cameras3d,type Piece} from '../engine/scene-pieces-schema.js';
import {kitDescriptions} from '../engine/sound-kits.js';
import {archetypes} from '../engine/piece-designer.js';

const usage=`Usage: tempoloom pieces [design "SENTENCE" [--seed TEXT] | layers | sounds | check REQUEST.json]

Every scene's visual is designed from zero for its video ("sceneVisuals" in video:create): a
"compose" piece made of layers (card, text, number, shape, icon, bar, line, image, avatar, scene3d), each
with an entrance, an optional loop and a sound. The storyboard designs one for every sentence;
an agent can also write the layers itself. There are no ready-made pieces.
  design    what the designer makes of a sentence (run again with another --seed for another)
  layers    the layer types, entrances, loops, sounds and icons
  sounds    the sound kits
  check     validates a request's sceneVisuals and shows lines without a visual
Common options on a piece: placement center|top|bottom, size 0.3-0.75, delay SECONDS,
transition none|fade|wipe|push|zoom-through|mask-reveal|circle-reveal,
cursor {path:[{x,y,at,click}]} (x,y are 0-1 of the piece; at is seconds into the scene).`;

async function main(){
 const [cmd,...rest]=process.argv.slice(2);
 if(cmd==='check'){
  const req=JSON.parse(await fs.readFile(rest[0]!,'utf8')) as {sceneVisuals?:unknown[];script?:string};
  const lines=(req.script??'').split(/\r?\n/).filter(l=>l.trim());
  const results=(req.sceneVisuals??[]).map((v,i)=>{const r=sceneVisualSchema.safeParse(v);if(!r.success)return {index:i,ok:false,problems:r.error.issues.map(x=>x.path.join('.')+': '+x.message)};
   const m=r.data.match?lines.findIndex(l=>l.toLowerCase().includes(r.data.match!.toLowerCase())):r.data.scene!;
   return {index:i,ok:m>=0&&m<lines.length,layers:r.data.piece.layers.length,line:m>=0?lines[m]:null,problems:m>=0&&m<lines.length?[]:['no script line matches']};});
  const covered=new Set(results.filter(r=>r.ok&&r.line).map(r=>r.line));
  console.log(JSON.stringify({ok:results.every(r=>r.ok),pieces:results,linesWithoutPiece:lines.filter(l=>!covered.has(l))},null,2));
  if(!results.every(r=>r.ok))process.exitCode=1;return;
 }
 if(cmd==='design'){
  const seedAt=rest.indexOf('--seed'),seed=seedAt>=0?rest[seedAt+1]!:String(Date.now());const sentence=rest.filter((_,i)=>i!==seedAt&&i!==seedAt+1).join(' ');
  if(!sentence)throw new Error('design "SENTENCE"');
  const {designScenes}=await import('../engine/storyboard.js');const [p]=designScenes([sentence],{seed});
  return console.log(JSON.stringify({sentence,role:p!.role,composition:p!.piece.designed,piece:p!.piece},null,1));
 }
 if(cmd==='layers'){const sh=layerSchema.shape;
  return console.log(JSON.stringify({types:sh.type.options,shapes:sh.shape.removeDefault().options,entrances:sh.in.removeDefault().shape.from.removeDefault().options,
   sounds:sh.in.removeDefault().shape.sound.unwrap().options,loops:sh.loop.unwrap().shape.kind.options,colors:'primary accent text muted surface background white black or #RRGGBB',icons,scene3d:{kinds:['text','icon','shape'],shapes:shapes3d,materials:materials3d,cameras:cameras3d},compositions:archetypes},null,1));}
 if(cmd==='sounds')return console.log(JSON.stringify(kitDescriptions,null,2));
 if(cmd&&cmd!=='help'){console.error('Unknown command: '+cmd);process.exitCode=1;}
 console.log(usage);
}
if(process.argv[1]?.endsWith('pieces-cli.ts'))main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
export type {Piece};
