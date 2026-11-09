import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pieceSchema} from '../src/engine/scene-pieces-schema.js';
import {designScenes} from '../src/engine/storyboard.js';
import {pieceTiming,sceneCues} from '../src/components/pieces/timing.js';
import {planPieceSounds,renderSoundBed,cueSounds,pickSound} from '../src/engine/piece-sounds.js';
import {readSfxIndex} from '../src/engine/sfx.js';
import {probe} from '../src/renderer/ffmpeg-encoder.js';

const piece=(raw:unknown)=>pieceSchema.parse(raw);

const C=(layers:unknown[],extra:object={})=>piece({kind:'compose',layers,...extra});
const designed=()=>designScenes(['Your team is drowning in messages, tasks and deadlines.','Revenue grew 40% in three months.','Solar panels turn sunlight into power.',
 'Customers love the speed, the design and the price.','Deliver to Erbil, Duhok and Sulaimani.','Start your free trial today.'],{seed:'sounds'}).map(p=>p.piece);

it('times sound cues to each layer of a piece',()=>{
 const pops=sceneCues(C([{type:'icon',icon:'star',in:{at:.2,from:'pop'}},{type:'icon',icon:'bell',in:{at:.8,from:'pop'}}],{transition:'zoom-through'}),4);
 expect(pops.map(c=>[c.sound,Number(c.at.toFixed(2))])).toEqual([['whoosh',0],['pop',.47],['pop',1.07]]);
 const fade=sceneCues(C([{type:'text',text:'a',in:{from:'fade'}},{type:'shape',in:{at:.5,from:'scale'}}],{transition:'fade'}),4);
 expect(fade.map(c=>c.sound)).toEqual(['pop']); // fade has no whoosh, a fading layer is silent
 const count=sceneCues(C([{type:'number',value:40,in:{at:.2,dur:1.2,from:'count'}}],{transition:'none'}),4);
 expect(count.filter(c=>c.sound==='tick').length).toBeGreaterThan(5);expect(count.at(-1)!.sound).toBe('impact');
 const chosen=sceneCues(C([{type:'icon',icon:'check',in:{at:.5,from:'pop',sound:'success'}}],{transition:'none'}),4);expect(chosen.map(c=>c.sound)).toEqual(['success']);
 const clicks=sceneCues(C([{type:'card'}],{cursor:{path:[{x:.2,y:.2,at:1},{x:.5,y:.5,at:1.6,click:true}]}}),4);
 expect(clicks.some(c=>c.why==='cursor click'&&Math.abs(c.at-1.6)<.01)).toBe(true);
});

it('fits cues to short scenes, spaces them and caps them',()=>{
 const p=C(Array.from({length:12},(_,i)=>({type:'icon',icon:'star',in:{at:i*.15,from:'pop'}})));
 const long=sceneCues(p,6),short=sceneCues(p,1);
 expect(short.every(c=>c.at<1)).toBe(true);
 for(const cs of [long,short])cs.slice(1).forEach((c,i)=>expect(c.at-cs[i]!.at).toBeGreaterThanOrEqual(.07-1e-9));
 for(const d of designed())expect(sceneCues(d,3).length).toBeLessThanOrEqual(14);
 expect(pieceTiming(C([{type:'text',text:'a',in:{at:0,dur:1.4}}],{delay:.5})).length).toBeCloseTo(2.3);
});

it('picks licensed sounds, levels them and renders one bed the length of the video',async()=>{
 const sounds=cueSounds(await readSfxIndex());
 for(const k of ['whoosh','click','tick','pop','success','impact'] as const)expect(pickSound(k,sounds),k).toBeTruthy();
 const scenes=[...designed(),...designed()].map((p,i)=>({start:i*3,duration:3,piece:p}));
 const cues=planPieceSounds(scenes,sounds);
 expect(cues.length).toBeGreaterThan(24);expect(cues.every(c=>c.volume>0&&c.volume<=4&&c.length<=1)).toBe(true);
 const quiet=planPieceSounds(scenes,sounds,{underVoice:true});expect(quiet[0]!.volume).toBeCloseTo(cues[0]!.volume*.5,2);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dz-bed-'));
 try{const out=await renderSoundBed(cues,scenes.length*3,path.join(dir,'bed.wav'));const d=Number((await probe(out)).format.duration);expect(Math.abs(d-scenes.length*3)).toBeLessThan(.05);}
 finally{await fs.rm(dir,{recursive:true,force:true});}
},60000);
