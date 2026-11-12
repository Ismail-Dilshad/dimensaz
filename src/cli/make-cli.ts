// `pnpm tempoloom make SCRIPT.txt`: one command from a script to a finished video.
import fs from 'node:fs/promises';
import {make,finish,type MakeOptions} from '../engine/make.js';

const usage=`Usage: tempoloom make SCRIPT.txt|--text "..." [--voice [VOICE_ID]] [--look "WORDS"] [--title TEXT]
                     [--format 9:16|1:1|16:9] [--formats 1:1,16:9,4:5|none] [--no-thumbnail] [--captions burned|off] [--music library|composed|off] [--mood MOOD] [--like LOOK [--copy colors]] [--draft] [--yes] [--out DIR]
       tempoloom make --approve JOB

Designs the storyboard (a visual for every sentence and a new style), records an ElevenLabs
voice-over with word timings when you pass --voice, builds the video and a preview with quality
checks, and stops for you to look. --approve JOB then renders the final video, the other shapes
(default 1:1 and 16:9), a thumbnail and, with a voice-over, caption files (.srt and .vtt;
--captions burned also makes a copy with the captions drawn on). Music fits the video's
mood: a track from assets/music, else an original score (--music, --mood to choose).
--like LOOK makes it in the spirit of a look learned from a video (pnpm tempoloom look learn);
--copy colors (only with --like) uses that video's own colours instead of your brand's. --yes finishes without stopping when the preview passes
every quality check. Everything goes to workspace/makes/<title>/.`;

async function main(){
 const a=process.argv.slice(2);const v:Record<string,string|true>={};const pos:string[]=[];
 for(let i=0;i<a.length;i++){const x=a[i]!;if(x.startsWith('--')){const next=a[i+1];v[x.slice(2)]=next!==undefined&&!next.startsWith('--')&&!(x==='--voice'&&/\.(txt|md)$/i.test(next))?(i++,next):true;}else pos.push(x);}
 const step=(s:string)=>console.error('… '+s);
 if(typeof v.approve==='string'){const r=await finish(v.approve,{onStep:step});return report(r);}
 if(v.help||pos[0]==='help'||(!pos[0]&&typeof v.text!=='string')){console.log(usage);return;}
 const script=typeof v.text==='string'?v.text:await fs.readFile(pos[0]!,'utf8');
 const shape=(s:string)=>s as '9:16';
 const o:MakeOptions={script,onStep:step,voice:v.voice===undefined?undefined:v.voice===true?true:String(v.voice),
  look:typeof v.look==='string'?v.look:undefined,title:typeof v.title==='string'?v.title:undefined,out:typeof v.out==='string'?v.out:undefined,
  aspectRatio:typeof v.format==='string'?shape(v.format):undefined,
  formats:typeof v.formats==='string'?(v.formats==='none'?[]:v.formats.split(',').map(s=>s.trim()) as MakeOptions['formats']):undefined,
  thumbnail:v['no-thumbnail']?false:undefined,captions:v.captions==='burned'||v.captions==='off'?v.captions:undefined,
  music:v.music==='library'||v.music==='composed'||v.music==='off'?v.music:undefined,mood:typeof v.mood==='string'?v.mood:undefined,like:typeof v.like==='string'?v.like:undefined,copy:v.copy==='colors'?['colors']:undefined,draft:!!v.draft,yes:!!v.yes,seed:typeof v.seed==='string'?v.seed:undefined};
 report(await make(o));
}
function report(r:Awaited<ReturnType<typeof make>>){
 console.log(JSON.stringify(r,null,2));
 if(r.next)console.error('\n'+r.next);
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
