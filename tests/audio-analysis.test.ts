import {it,expect} from 'vitest';
import {analysisToAlignment,audioAnalysisSchema,runAudioPython} from '../src/engine/audio-analysis.js';
import {reviewHTML} from '../src/components/AlignmentReview.js';
const analysis=audioAnalysisSchema.parse({schemaVersion:1,script:'Hello world!',audioSha256:'0'.repeat(64),audioFile:'unit-fixture.wav',duration:2,sampleRate:16000,backend:{name:'unit-timing-fixture'},reviewed:false,confidenceMeaning:'test',errors:[],waveform:[.1,.2],pauses:[],sentences:[{id:1,text:'Hello world!',firstWord:0,lastWord:1,start:null,end:null}],
 words:[{index:0,text:'Hello',from:0,to:5,start:null,end:null,confidence:null,flags:['unresolved'],reviewed:false,reviewer:null},{index:1,text:'world!',from:6,to:12,start:null,end:null,confidence:null,flags:['unresolved'],reviewed:false,reviewer:null}]});
it('does not manufacture alignment from pause-only analysis',()=>expect(()=>analysisToAlignment(analysis)).toThrow(/Review/));
it('only exports fully reviewed nonoverlapping timings',()=>{
 const a=structuredClone(analysis);a.words.forEach((w,i)=>Object.assign(w,{start:.2+i,end:.7+i,reviewed:true,reviewer:'unit-test reviewer'}));
 expect(analysisToAlignment(a).words).toEqual([{text:'Hello',start:.2,end:.7},{text:'world!',start:1.2,end:1.7}]);
 a.words[1].start=.3;expect(()=>analysisToAlignment(a)).toThrow(/overlapping/);
});
it('escapes script markup in the offline review page',()=>{
 const a=structuredClone(analysis);a.script='</script><script>bad()</script>';
 const html=reviewHTML(a,'../../input/voice.mp3');
 expect(html).not.toContain('</script><script>bad()');
 expect(html).toContain('\\u003c/script>');
 expect(html).toContain('Set now');
});
it.skipIf(process.env.RUN_AUDIO_TESTS!=='1')('runs the actual .venv bridge and checks stock language support',async()=>{
 const d=await runAudioPython(['doctor']) as any;
 expect(d.python.replaceAll('\\','/')).toContain('/.venv/');
 expect(d.packages['faster-whisper'].imports).toBe(true);
 expect(d.packages.numpy.imports).toBe(true);
 expect(d.stockWhisperSorani).toEqual({ckb:false,ku:false});
},30000);
