// Perfect loops: a video whose end flows into its start with no seam. The end crossfades into the
// opening (picture and sound), and the opening is taken off the front, so when a platform plays it
// again the last frame leads straight into the first. The seam is measured, not assumed.
import {ffmpeg,probe} from '../renderer/ffmpeg-encoder.js';

/** The FFmpeg graph for a loop of a clip `duration` long with a `x`-second crossfade. */
export function loopGraph(duration:number,x:number,audio:boolean,fps=30){
 const n=(v:number)=>Number(v.toFixed(4)).toString();
 const v=`[0:v]fps=${n(fps)},split[la][lb];[la]trim=start=${n(x)},setpts=PTS-STARTPTS,fps=${n(fps)}[body];[lb]trim=end=${n(x)},setpts=PTS-STARTPTS,fps=${n(fps)}[head];[body][head]xfade=transition=fade:duration=${n(x)}:offset=${n(duration-2*x)},format=yuv420p[v]`;
 // The sound: the end fades out while the opening fades in over it (a crossfade by two fades).
 const a=audio?`;[0:a]asplit[sa][sb];[sa]atrim=start=${n(x)},asetpts=PTS-STARTPTS,afade=t=out:st=${n(duration-2*x)}:d=${n(x)}[abody];[sb]atrim=end=${n(x)},asetpts=PTS-STARTPTS,afade=t=in:d=${n(x)},adelay=${Math.round((duration-2*x)*1000)}:all=1[ahead];[abody][ahead]amix=inputs=2:normalize=0:duration=longest[a]`:'';
 return v+a;
}
const diff=(a:Buffer,b:Buffer)=>{const n=Math.min(a.length,b.length);if(!n)return NaN;let s=0;for(let i=0;i<n;i++)s+=Math.abs(a[i]!-b[i]!);return s/n;};
/** How well a video loops: the jump from its last frame to its first, against the usual change
 *  between two frames inside it. Seamless when the jump is no bigger than an ordinary frame step. */
export async function loopSeam(file:string){
 const info=await probe(file),duration=Number(info.format?.duration)||0,v=(info.streams as {codec_type:string;avg_frame_rate?:string}[]).find(s=>s.codec_type==='video');
 const [a,b]=String(v?.avg_frame_rate??'25/1').split('/').map(Number),fps=b?a!/b:25,size=64*64;
 const head=await rawFrames(file,['-ss','0'],2),tail=await rawFrames(file,['-sseof',(-3/fps).toFixed(3)],3);
 const mid=await rawFrames(file,['-ss',(duration/2).toFixed(3)],4);
 const steps=[diff(mid.slice(0,size),mid.slice(size,2*size)),diff(mid.slice(size,2*size),mid.slice(2*size,3*size)),diff(head.slice(0,size),head.slice(size,2*size))].filter(Number.isFinite);
 const usual=steps.length?steps.sort((x,y)=>x-y)[Math.floor(steps.length/2)]!:0,last=tail.slice(Math.max(0,tail.length-size)),jump=diff(last,head.slice(0,size));
 const seamless=Number.isFinite(jump)&&jump<=Math.max(1.5*usual,2.5);
 return {duration:+duration.toFixed(3),jump:+jump.toFixed(2),usual:+usual.toFixed(2),seamless,
  note:seamless?'It loops without a visible seam.':`The last frame jumps to the first (${jump.toFixed(1)} against ${usual.toFixed(1)} between ordinary frames): make it a loop with media loop, or end on the opening picture.`};
}
async function rawFrames(file:string,seek:string[],count:number){
 const {spawn}=await import('node:child_process');
 return new Promise<Buffer>((resolve,reject)=>{const c=spawn(ffmpeg,['-v','error',...seek,'-i',file,'-frames:v',String(count),'-vf','scale=64:64,format=gray','-f','rawvideo','-'],{windowsHide:true});
  const parts:Buffer[]=[];c.stdout.on('data',(d:Buffer)=>parts.push(d));c.once('error',reject);c.once('close',()=>resolve(Buffer.concat(parts)));});
}
