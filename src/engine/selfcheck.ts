// The agent watches its own video before the user does. A rendered preview is measured exactly
// like a taught video (cuts, motion, colour, sound), compared with the user's taste profile, and
// turned into frame sheets for the agent to look at against the lessons it was meant to follow.
import fsp from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from './config.js';
import {studyClip,measure,frameSheets,type Measured} from './teach/measure.js';
import {check,build,type Check} from './taste.js';

export type SelfCheck={at:string;file:string;profile:string;seconds:number;verdict:'pass'|'fix';checks:Check[];off:number;near:number;passed:number;
 sheets:{file:string;shows:string;times:number[]}[];look:string[];attempt:number;accepted?:string};
const rel=(f:string)=>path.relative(ROOT,f).split(path.sep).join('/');
const strip=(m:Measured)=>({media:m.media,pacing:{...m.pacing,cutTimes:m.pacing.cutTimes.slice(0,40)},motion:m.motion,color:{brightness:m.color.brightness,saturation:m.color.saturation,contrast:m.color.contrast,background:m.color.background,accent:m.color.accent},sound:m.sound});
/** Measures a rendered video, checks it against the profile and prepares frames to look at.
 *  `dir` receives the frame sheets (the working copy of the video is deleted). */
export async function selfCheck(file:string,dir:string,o:{profile?:string;attempt?:number}={}){
 const abs=path.resolve(file);await fsp.access(abs).catch(()=>{throw new Error('No such video to check: '+file);});
 await fsp.rm(dir,{recursive:true,force:true});await fsp.mkdir(dir,{recursive:true});
 const clip=path.join(dir,'_copy.mp4');
 try{
  await studyClip(abs,clip,{});
  const m=await measure(clip),c=check(m,o.profile??'main'),sheets=await frameSheets(clip,dir,m,[]);
  const b=build(o.profile??'main');
  // What only eyes can judge: the kept lines of the profile, for the agent to hold the frames against.
  const look=b.topics.flatMap(t=>t.lines.filter(l=>l.on)).slice(0,14).map(l=>(l.avoid&&!/^(avoid|never|no |do not|don't)/i.test(l.text)?'Avoid: ':'')+l.text);
  const result:SelfCheck={at:new Date().toISOString(),file:rel(abs),profile:c.profile,seconds:m.media.seconds,verdict:c.off?'fix':'pass',checks:c.checks,off:c.off,near:c.near,passed:c.passed,
   sheets:sheets.map(s=>({...s,file:rel(s.file)})),look,attempt:o.attempt??1};
  return {result,measured:strip(m)};
 }finally{await fsp.rm(clip,{force:true});}
}
