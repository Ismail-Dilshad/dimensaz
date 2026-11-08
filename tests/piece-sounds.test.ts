import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pieceSchema} from '../src/engine/scene-pieces-schema.js';
import {pieceExamples} from '../src/cli/pieces-cli.js';
import {pieceTiming,sceneCues} from '../src/components/pieces/timing.js';
import {planPieceSounds,renderSoundBed,cueSounds,pickSound} from '../src/engine/piece-sounds.js';
import {readSfxIndex} from '../src/engine/sfx.js';
import {probe} from '../src/renderer/ffmpeg-encoder.js';

const piece=(raw:unknown)=>pieceSchema.parse(raw);

it('times sound cues to each piece animation',()=>{
 const n=sceneCues(piece({kind:'notifications',items:[{app:'A',title:'x'},{app:'B',title:'y'}],transition:'zoom-through'}),4);
 expect(n.map(c=>[c.sound,Number(c.at.toFixed(2))])).toEqual([['whoosh',0],['pop',.47],['pop',1.02]]);
 const chat=sceneCues(piece({kind:'chat',messages:[{from:'them',text:'a'},{from:'me',text:'b'}],transition:'fade'}),4);
 expect(chat.map(c=>c.sound)).toEqual(['pop','pop']); // fade has no whoosh
 const done=sceneCues(piece({kind:'tasks',tasks:[{title:'a'},{title:'b'}],flow:'complete'}),5);
 expect(done.filter(c=>c.sound==='click')).toHaveLength(2);expect(done.at(-1)!.sound).toBe('success');
 const counter=sceneCues(piece({kind:'counter',to:40,transition:'none'}),4);
 expect(counter.filter(c=>c.sound==='tick').length).toBeGreaterThan(5);expect(counter.at(-1)!.sound).toBe('impact');
 const clicks=sceneCues(piece({kind:'browser',screen:{kind:'checklist',items:['a']},cursor:{path:[{x:.2,y:.2,at:1},{x:.5,y:.5,at:1.6,click:true}]}}),4);
 expect(clicks.some(c=>c.why==='cursor click'&&Math.abs(c.at-1.6)<.01)).toBe(true);
 expect(clicks.filter(c=>c.sound==='whoosh')).toHaveLength(1); // the window's own whoosh merges with the transition
});

it('fits cues to short scenes, spaces them and caps them',()=>{
 const p=piece({kind:'avatars',people:[1,2,3,4,5,6].map(i=>({name:'P'+i}))});
 const long=sceneCues(p,6),short=sceneCues(p,1);
 expect(short.every(c=>c.at<1)).toBe(true);
 for(const cs of [long,short])cs.slice(1).forEach((c,i)=>expect(c.at-cs[i]!.at).toBeGreaterThanOrEqual(.07-1e-9));
 for(const ex of Object.values(pieceExamples))expect(sceneCues(piece(ex.piece),3).length).toBeLessThanOrEqual(14);
 expect(pieceTiming(piece({kind:'counter',to:1,delay:.5})).length).toBeCloseTo(2.3);
});

it('picks licensed sounds, levels them and renders one bed the length of the video',async()=>{
 const sounds=cueSounds(await readSfxIndex());
 for(const k of ['whoosh','click','tick','pop','success','impact'] as const)expect(pickSound(k,sounds),k).toBeTruthy();
 const scenes=Object.values(pieceExamples).filter(e=>(e.piece as {kind:string}).kind!=='image').map((e,i)=>({start:i*3,duration:3,piece:piece(e.piece)}));
 const cues=planPieceSounds(scenes,sounds);
 expect(cues.length).toBeGreaterThan(30);expect(cues.every(c=>c.volume>0&&c.volume<=4&&c.length<=1)).toBe(true);
 const quiet=planPieceSounds(scenes,sounds,{underVoice:true});expect(quiet[0]!.volume).toBeCloseTo(cues[0]!.volume*.5,2);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dz-bed-'));
 try{const out=await renderSoundBed(cues,scenes.length*3,path.join(dir,'bed.wav'));const d=Number((await probe(out)).format.duration);expect(Math.abs(d-scenes.length*3)).toBeLessThan(.05);}
 finally{await fs.rm(dir,{recursive:true,force:true});}
},60000);
