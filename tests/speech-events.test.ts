import {it,expect} from 'vitest';
import {create} from '../src/engine/project.js';
import {plan} from '../src/engine/scene-planner.js';
import {speechEvents,retimeSpeechEvents,assertSpeechEvents} from '../src/engine/speech-events.js';
import {projectSchema} from '../src/engine/schema.js';
it('binds object, camera and SFX events to genuine cues and detects stale edits',async()=>{
 const p=await create('speech-event-unit-fixture','Hello world');p.scenes=plan(p.script,p.config);p.config.voiceTiming='required';
 p.alignmentEvidence={audioSha256:'a'.repeat(64),method:'manual-review',source:'Synthetic unit fixture; not a reviewed voice',reviewed:true};
 p.scenes[0].wordCues=[{from:0,to:5,start:.3,end:.6},{from:6,to:11,start:1.1,end:1.5}];
 p.media=[{id:'effect',path:'fixture.wav',kind:'sfx',at:0}];
 p.speechAnchors=[{kind:'object',wordIndex:1,edge:'start',offset:0},{kind:'camera',wordIndex:1,edge:'end',offset:0},{kind:'sfx',wordIndex:1,edge:'start',offset:0,mediaId:'effect'}];
 expect(projectSchema.parse(p).speechAnchors).toHaveLength(3);
 retimeSpeechEvents(p);expect(p.media[0].at).toBe(1.1);expect(speechEvents(p).map(e=>e.time)).toEqual([1.1,1.5,1.1]);
 p.scenes[0].wordCues[1].start=1.2;expect(()=>assertSpeechEvents(p)).toThrow(/stale/);retimeSpeechEvents(p);expect(p.media[0].at).toBe(1.2);
 delete p.alignmentEvidence;expect(()=>speechEvents(p)).toThrow(/reviewed/);
});
it('rejects out-of-range and duplicate speech targets',async()=>{
 const p=await create('speech-event-invalid-fixture','Hello');p.scenes=plan(p.script,p.config);p.config.voiceTiming='required';
 p.alignmentEvidence={audioSha256:'a'.repeat(64),method:'manual-review',source:'Synthetic fixture',reviewed:true};p.scenes[0].wordCues=[{from:0,to:5,start:.3,end:.6}];
 p.speechAnchors=[{kind:'object',wordIndex:2,edge:'start',offset:0}];expect(()=>speechEvents(p)).toThrow(/range/);
 p.speechAnchors=[{kind:'object',wordIndex:0,edge:'start',offset:0},{kind:'object',wordIndex:0,edge:'end',offset:0}];expect(()=>speechEvents(p)).toThrow(/Duplicate/);
});
