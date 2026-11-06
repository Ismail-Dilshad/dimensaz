import {it,expect,vi} from 'vitest';
const capture=vi.hoisted(()=>vi.fn(async()=>''));
vi.mock('../renderer/ffmpeg-encoder.js',()=>({ffmpeg:'fixture-ffmpeg',run:capture}));
import {mixAudio} from '../renderer/audio-mixer.js';
import {defaults} from '../engine/config.js';
import {chooseExplainerTheme} from '../engine/explainer-design.js';
import type {Project} from '../engine/schema.js';
it('ducks a licensed optional bed under explainer narration and preserves legacy mixing',async()=>{
 const p={id:'audio-fixture',config:await defaults(),media:[{id:'voice',path:'input/voice.wav',kind:'voice',at:0,metadata:{format:{duration:'2'}}},{id:'effect',path:'input/effect.wav',kind:'sfx',at:.5,metadata:{format:{duration:'.1'}}}]} as Project;
 await mixAudio(p,'silent.mp4','out.mp4',3);expect(JSON.stringify(capture.mock.calls.at(-1))).not.toContain('sidechaincompress');
 p.config.explainer=chooseExplainerTheme({brief:{topic:'Audio fixture',industry:'testing',audience:'test audience',emotion:'neutral',tone:'calm',domain:'general'}});
 await mixAudio(p,'silent.mp4','out2.mp4',3);const graph=JSON.stringify(capture.mock.calls.at(-1));expect(graph).toContain('sidechaincompress');expect(graph).toContain('volume=0.12');expect(graph).toContain('atrim=duration=0.1');
 p.media=p.media.filter(m=>m.kind==='voice');await mixAudio(p,'silent.mp4','out3.mp4',3);expect(JSON.stringify(capture.mock.calls.at(-1))).not.toContain('sidechaincompress');
});
