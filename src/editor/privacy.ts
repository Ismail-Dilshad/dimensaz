// Private details, blurred when the user asks: the faces of people who are not the speaker, number
// plates and phone numbers. The media tools find faces and text through the video (media_tools/
// private.py: OpenCV's face detector and RapidOCR, on this computer); here they become tracks that
// follow what they cover, and a `blur` operation for the edit list.
import {runPythonModule} from '../engine/audio-analysis.js';
import {ffmpeg} from '../renderer/ffmpeg-encoder.js';
import type {Operation} from './edl.js';

type Box=[number,number,number,number];
type Sample={time:number;faces:{box:Box;score:number}[];texts:{box:Box;text:string;score:number}[]};
export type Found={width:number;height:number;step:number;faces:boolean;text:boolean;samples:Sample[];notes:string[]};
export type Kind='face'|'plate'|'phone'|'you';
export type Region={kind:Kind;start:number;end:number;keys:{t:number;x:number;y:number;w:number;h:number}[];label:string};

// Digits in any script the region writes (Arabic-Indic, Persian) read as Latin digits.
const latinDigits=(s:string)=>s.replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0));
const PHONE=/(\+?\(?\d[\d\s().\-]{6,}\d)/;
/** What a piece of text is: a phone number (7 to 15 digits), a number plate (a short run of letters
 *  and digits on a plate-shaped box), or neither. Returns the part of the box it covers. */
export function classifyText(t:{box:Box;text:string}):{kind:'phone'|'plate';box:Box;text:string}|null{
 const text=latinDigits(t.text.trim()),[x,y,w,h]=t.box;
 const m=PHONE.exec(text);
 if(m){const digits=m[1]!.replace(/\D/g,'');if(digits.length>=7&&digits.length<=15){
  // Only the number's part of the box: by where it sits in the line.
  const a=m.index/Math.max(1,text.length),b=(m.index+m[1]!.length)/Math.max(1,text.length);
  return {kind:'phone',box:[x+w*Math.max(0,a-.02),y,w*Math.min(1,b-a+.04),h],text:m[1]!};}}
 const compact=text.replace(/[\s\-.·]/g,'');
 const plate=/^[\p{L}\p{N}]{4,10}$/u.test(compact)&&(compact.match(/\d/g)?.length??0)>=2&&w/h>=1.8&&w/h<=8&&!/^\d{4}$/.test(compact);
 return plate?{kind:'plate',box:t.box,text:compact}:null;
}
const iou=(a:Box,b:Box)=>{const x1=Math.max(a[0],b[0]),y1=Math.max(a[1],b[1]),x2=Math.min(a[0]+a[2],b[0]+b[2]),y2=Math.min(a[1]+a[3],b[1]+b[3]);const i=Math.max(0,x2-x1)*Math.max(0,y2-y1);return i/(a[2]*a[3]+b[2]*b[3]-i||1);};
const near=(a:Box,b:Box)=>iou(a,b)>.15||Math.hypot(a[0]+a[2]/2-b[0]-b[2]/2,a[1]+a[3]/2-b[1]-b[3]/2)<Math.max(a[2],a[3],b[2],b[3])*.8;
type Track={kind:Kind;hits:{t:number;box:Box}[];label:string};
/** Links what was found in one sample to the same thing in the next ones (a gap of up to 1 s). */
function link(items:{t:number;box:Box;kind:Kind;label:string}[]){
 const tracks:Track[]=[];
 for(const it of items.sort((a,b)=>a.t-b.t)){const tr=tracks.find(x=>x.kind===it.kind&&it.t-x.hits.at(-1)!.t<=1.01&&near(x.hits.at(-1)!.box,it.box));
  if(tr)tr.hits.push({t:it.t,box:it.box});else tracks.push({kind:it.kind,hits:[{t:it.t,box:it.box}],label:it.label});}
 return tracks;
}
/** Tracks of what to blur. The speaker (the biggest face, there most of the time) is left alone
 *  unless `allFaces`; a face seen once only, for a moment, is kept too (a false find costs little). */
export function regions(f:Found,o:{faces?:boolean;plates?:boolean;phones?:boolean;allFaces?:boolean;pad?:number}={}):{regions:Region[];speaker:boolean;counts:Record<string,number>}{
 const items:{t:number;box:Box;kind:Kind;label:string}[]=[];
 for(const s of f.samples){
  if(o.faces!==false)for(const x of s.faces)items.push({t:s.time,box:x.box,kind:'face',label:'a face'});
  for(const x of s.texts){const c=classifyText(x);if(c&&((c.kind==='phone'&&o.phones!==false)||(c.kind==='plate'&&o.plates!==false)))items.push({t:s.time,box:c.box,kind:c.kind,label:c.kind==='phone'?'a phone number':'a number plate'});}
 }
 const tracks=link(items),faces=tracks.filter(t=>t.kind==='face'),n=f.samples.length||1;
 const size=(t:Track)=>{const a=t.hits.map(h=>h.box[2]*h.box[3]).sort((x,y)=>x-y);return a[Math.floor(a.length/2)]!;};
 const speaker=!o.allFaces?faces.filter(t=>t.hits.length>=Math.max(2,n*.4)).sort((a,b)=>size(b)-size(a))[0]:undefined;
 const pad=o.pad??.25,step=f.step||.25,out:Region[]=[];
 for(const t of tracks){if(t===speaker)continue;
  out.push({kind:t.kind,label:t.label,start:+Math.max(0,t.hits[0]!.t-step/2-.1).toFixed(3),end:+(t.hits.at(-1)!.t+step/2+.2).toFixed(3),
   keys:t.hits.map(h=>{const [x,y,w,h2]=h.box,px=w*pad,py=h2*pad;return {t:h.t,x:+Math.max(0,x-px).toFixed(4),y:+Math.max(0,y-py).toFixed(4),w:+Math.min(1,w+2*px).toFixed(4),h:+Math.min(1,h2+2*py).toFixed(4)};})});}
 const counts={faces:out.filter(r=>r.kind==='face').length,plates:out.filter(r=>r.kind==='plate').length,phones:out.filter(r=>r.kind==='phone').length};
 return {regions:out,speaker:!!speaker,counts};
}
/** Runs the media tools over a video (only when asked) and returns what to blur, as an operation. */
export async function findPrivate(file:string,o:{faces?:boolean;plates?:boolean;phones?:boolean;allFaces?:boolean;step?:number;allowDownload?:boolean}={}){
 const text=o.plates!==false||o.phones!==false;
 const f=await runPythonModule('media_tools.cli',['private',file,'--step',String(o.step??.25),...(o.faces===false?['--no-faces']:[]),...(text?[]:['--no-text']),...(o.allowDownload?['--allow-download']:[])],
  {label:'Finding private details',env:{FFMPEG_PATH:ffmpeg}}) as Found;
 const r=regions(f,o),notes=[...f.notes];
 if(r.speaker)notes.push('The speaker (the biggest face, there most of the time) is not blurred; --all-faces blurs every face.');
 return {...r,notes,edlOperation:r.regions.length?{op:'blur',regions:r.regions.slice(0,120),strength:.8} as Operation:null};
}
