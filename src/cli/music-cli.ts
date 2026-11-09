// `pnpm dimensaz music`: your music library, and original music composed for a mood.
import path from 'node:path';
import {addTrack,readLibrary,moodFor,musicDir} from '../engine/music/library.js';
import {composeMusic,moods,type Mood} from '../engine/music/compose.js';
import {analyzeMusic} from '../engine/music/analyze.js';

const usage=`Usage: dimensaz music <command>
  list                          Your tracks (assets/music) with mood, tempo and license
  add FILE --mood calm[,warm] --license cc0|pdm|cc-by|cc-by-sa|own|licensed [--title T] [--credit "Title by Artist (CC BY 4.0, link)"] [--source URL]
                                Add a track you may use; tempo and beats are measured (never overwrites)
  analyze FILE                  Tempo, beat length, first beat and how sure the measurement is
  compose --mood MOOD [--seconds 30] [--seed TEXT] [--out FILE.wav]
                                An original piece for a mood (hear what videos get when no track fits)
  mood --text "SCRIPT"          The mood a script's music would get
  moods                         ${moods.join(', ')}

Every new motion video gets music automatically ("music": "auto"): a track of its mood from
your library, otherwise an original piece composed for it. Find tracks to add with
  pnpm dimensaz source search "calm piano" --kind music   (then: source download N)`;

const flag=(a:string[],n:string)=>{const i=a.indexOf(n);return i>=0&&a[i+1]&&!a[i+1]!.startsWith('--')?a[i+1]:undefined;};
const isMood=(m:string):m is Mood=>(moods as readonly string[]).includes(m);
async function main(){
 const [cmd,...a]=process.argv.slice(2);const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
 switch(cmd){
  case 'list':return out((await readLibrary()).map(t=>({id:t.id,title:t.title,moods:t.moods,bpm:t.bpm,seconds:t.duration,license:t.license,...(t.credit?{credit:t.credit}:{})})));
  case 'add':{const file=a[0];if(!file||file.startsWith('--'))throw new Error('add FILE --mood MOOD --license LICENSE');
   const ms=(flag(a,'--mood')??'').split(',').map(s=>s.trim()).filter(Boolean);if(!ms.length||!ms.every(isMood))throw new Error('--mood takes one or more of: '+moods.join(', '));
   const license=flag(a,'--license');if(!license)throw new Error('--license is required: cc0, pdm, cc-by, cc-by-sa, own or licensed');
   const t=await addTrack(path.resolve(file),{moods:ms as Mood[],license,title:flag(a,'--title'),credit:flag(a,'--credit'),source:flag(a,'--source')});
   return out({added:t,folder:musicDir(),note:t.confidence<.25?'The beat was hard to measure; the track is still used, cut by time.':'Videos of these moods can now use it.'});}
  case 'analyze':{if(!a[0])throw new Error('analyze FILE');return out(await analyzeMusic(path.resolve(a[0])));}
  case 'compose':{const m=flag(a,'--mood')??'upbeat';if(!isMood(m))throw new Error('--mood: '+moods.join(', '));
   const seconds=Number(flag(a,'--seconds')??30),file=path.resolve(flag(a,'--out')??`music-${m}-${Date.now()}.wav`);
   return out(await composeMusic({mood:m,duration:seconds,seed:flag(a,'--seed')??String(Date.now())},file));}
  case 'mood':{const text=flag(a,'--text');if(!text)throw new Error('mood --text "SCRIPT"');return out({mood:moodFor(text)});}
  case 'moods':return out(moods);
  default:if(cmd&&cmd!=='help'){console.error('Unknown command: '+cmd);process.exitCode=1;}console.log(usage);
 }
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
