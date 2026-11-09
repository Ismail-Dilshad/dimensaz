// Original music composed for one video, so every video can have a score that is free to use
// and fits it exactly. A mood sets the tempo, mode and instruments; the video's seed picks the
// key, the chord progression and the patterns, so no two videos get the same piece. Chords change
// where the scenes change (on the nearest beat), drums come in after the opening, and the piece
// ends on a held chord exactly when the video ends. Synthesised here (pads, plucks, bass, kick,
// hats, claps, a small reverb), written as a WAV.
import fs from 'node:fs/promises';

export const moods=['calm','warm','inspiring','upbeat','playful','energetic','dark'] as const;
export type Mood=typeof moods[number];
type Spec={bpm:[number,number];minor:number;drums:'none'|'soft'|'four'|'drive';arp:'quarter'|'eighth'|'bounce'|'none';bright:number;pad:number;bass:'root'|'eighth'|'pulse';swing:number};
const SPEC:Record<Mood,Spec>={
 calm:{bpm:[76,88],minor:.2,drums:'none',arp:'quarter',bright:.35,pad:1,bass:'root',swing:0},
 warm:{bpm:[86,96],minor:.15,drums:'soft',arp:'eighth',bright:.45,pad:.9,bass:'root',swing:0},
 inspiring:{bpm:[92,104],minor:.1,drums:'soft',arp:'eighth',bright:.6,pad:1,bass:'eighth',swing:0},
 upbeat:{bpm:[106,118],minor:.05,drums:'four',arp:'eighth',bright:.65,pad:.7,bass:'eighth',swing:0},
 playful:{bpm:[110,122],minor:0,drums:'soft',arp:'bounce',bright:.75,pad:.5,bass:'root',swing:.12},
 energetic:{bpm:[120,128],minor:.4,drums:'drive',arp:'eighth',bright:.75,pad:.6,bass:'pulse',swing:0},
 dark:{bpm:[96,110],minor:1,drums:'four',arp:'none',bright:.35,pad:.9,bass:'pulse',swing:0},
};
const MAJOR=[0,2,4,5,7,9,11],MINOR=[0,2,3,5,7,8,10];
const PROG_MAJOR=[[1,5,6,4],[6,4,1,5],[1,6,4,5],[4,1,5,6],[1,3,6,4],[1,4,6,5],[6,5,4,5]];
const PROG_MINOR=[[1,6,3,7],[1,4,6,5],[6,7,1,1],[1,7,6,7],[1,6,4,5],[4,6,1,7]];

function rng(seed:string){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const hz=(m:number)=>440*2**((m-69)/12);

export type ComposeInput={mood:Mood;duration:number;seed:string;
 /** Scene starts (seconds): chords change there, on the nearest beat. */
 cuts?:number[];
 /** Under a voice-over the music stays sparser (no arpeggio lead in the speech range). */
 underVoice?:boolean};
export type Composed={file:string;mood:Mood;bpm:number;key:string;progression:string;duration:number};

const SR=44100;
export async function composeMusic(i:ComposeInput,file:string):Promise<Composed>{
 const r=rng(i.seed+':'+i.mood),s=SPEC[i.mood],pick=<T>(a:T[])=>a[Math.floor(r()*a.length)]!;
 const bpm=Math.round(s.bpm[0]+r()*(s.bpm[1]-s.bpm[0])),beat=60/bpm,bar=beat*4;
 const minor=r()<s.minor,scale=minor?MINOR:MAJOR,prog=pick(minor?PROG_MINOR:PROG_MAJOR);
 const root=48+Math.floor(r()*7)-2; // around C3: Bb2..E3
 const name=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((root%12)+12)%12]+(minor?' minor':' major');
 const D=Math.max(2,i.duration),N=Math.ceil(D*SR);
 const L=new Float32Array(N),R=new Float32Array(N),revL=new Float32Array(N),revR=new Float32Array(N);
 const chordOf=(deg:number,seventh:boolean)=>{const k=deg-1;const t=(o:number)=>{const j=k+o;return root+scale[j%7]!+12*Math.floor(j/7);};return [t(0),t(2),t(4),...(seventh?[t(6)]:[])];};

 // Chord changes: every bar, and at each scene start (on the nearest beat); none closer than two beats.
 const q=(t:number)=>Math.round(t/beat)*beat;
 const raw=[...Array.from({length:Math.ceil(D/bar)},(_,k)=>k*bar),...(i.cuts??[]).map(q)].filter(t=>t<D-1).sort((a,b)=>a-b);
 const changes:number[]=[];for(const t of raw)if(!changes.length||t-changes.at(-1)!>=beat*2-1e-6)changes.push(t);
 // The ending: the last chord starts on a beat at least 1.6 s before the end and rings to the end.
 const endAt=Math.max(beat,Math.floor((D-1.6)/beat)*beat);
 const segs=changes.filter(t=>t<endAt).map((t,k,a)=>({t,end:a[k+1]??endAt,deg:prog[k%prog.length]!}));
 segs.push({t:endAt,end:D,deg:1});
 const drumsFrom=i.cuts&&i.cuts.length>1?q(i.cuts[1]!):bar*2;

 const add=(buf:Float32Array,at:number,v:number)=>{if(at>=0&&at<N)buf[at]!+=v;};
 // Pad: detuned saws through a soft low-pass, slow attack, panned wide.
 for(const g of segs){const notes=chordOf(g.deg,!minor&&r()<.3);const a=Math.floor(g.t*SR),b=Math.min(N,Math.floor((g.end+.35)*SR));
  notes.forEach((m,n)=>{const f=hz(m+12),pan=(n/(notes.length-1||1))-.5;
   for(const det of [-.0045,.0045]){let ph=r(),lp=0;const cut=600+1800*s.bright,al=1-Math.exp(-2*Math.PI*cut/SR);
    for(let x=a;x<b;x++){const t=(x-a)/SR,len=(g.end-g.t);ph+=f*(1+det)/SR;ph-=Math.floor(ph);const saw=2*ph-1;lp+=al*(saw-lp);
     const env=Math.min(1,t/.35)*(t<len?1:Math.max(0,1-(t-len)/.35));const v=lp*env*.028*s.pad;
     add(L,x,v*(.5-pan*.6));add(R,x,v*(.5+pan*.6));add(revL,x,v*.5);add(revR,x,v*.5);}}});}
 // Bass.
 for(const g of segs){const m=chordOf(g.deg,false)[0]!-12;const f=hz(m);const step=s.bass==='root'?beat*2:s.bass==='eighth'?beat:beat/2;
  for(let t=g.t;t<g.end-1e-6;t+=step){const a=Math.floor(t*SR),len=Math.min(step*.92,g.end-t),b=Math.min(N,a+Math.floor((len+.05)*SR));let ph=0;
   for(let x=a;x<b;x++){const u=(x-a)/SR;ph+=f/SR;const env=Math.min(1,u/.008)*Math.exp(-u*(s.bass==='pulse'?6:2.2))*(u<len?1:Math.max(0,1-(u-len)/.05));
    const v=Math.tanh(Math.sin(2*Math.PI*ph)*1.6)*.12*env;add(L,x,v);add(R,x,v);}}}
 // Arpeggio pluck (chord tones climbing), off under a voice-over in the speech range.
 if(s.arp!=='none'&&!(i.underVoice&&s.arp!=='quarter')){const step=s.arp==='quarter'?beat:beat/2,patt=pick([[0,1,2,1],[0,2,1,2],[0,1,2,3],[2,1,0,1]]);
  for(const g of segs.slice(0,-1)){const notes=chordOf(g.deg,true);let k=0;
   for(let t=g.t;t<g.end-1e-6;t+=step,k++){if(s.arp==='bounce'&&k%4===3)continue;const sw=k%2?s.swing*step:0,m=notes[patt[k%4]!%notes.length]!+(i.underVoice?12:24),f=hz(m);
    const a=Math.floor((t+sw)*SR),b=Math.min(N,a+Math.floor(.6*SR)),pan=(k%2?.25:-.25);
    for(let x=a;x<b;x++){const u=(x-a)/SR,env=Math.min(1,u/.003)*Math.exp(-u*(6-2*s.bright));
     const v=(Math.sin(2*Math.PI*f*u)+.35*Math.sin(4*Math.PI*f*u)*Math.exp(-u*12))*.05*env*(i.underVoice?.6:1);
     add(L,x,v*(.5-pan));add(R,x,v*(.5+pan));add(revL,x,v*.8);add(revR,x,v*.8);}}}}
 // Drums from the second scene to the last chord.
 const noise=()=>r()*2-1;
 const kick=(t:number,g:number)=>{const a=Math.floor(t*SR),b=Math.min(N,a+Math.floor(.3*SR));let ph=0;for(let x=a;x<b;x++){const u=(x-a)/SR,f=45+75*Math.exp(-u*30);ph+=f/SR;const v=Math.sin(2*Math.PI*ph)*Math.exp(-u*9)*.55*g;add(L,x,v);add(R,x,v);}};
 const hat=(t:number,g:number)=>{const a=Math.floor(t*SR),b=Math.min(N,a+Math.floor(.06*SR));let prev=0;for(let x=a;x<b;x++){const u=(x-a)/SR,n=noise(),hp=n-prev;prev=n;const v=hp*Math.exp(-u*70)*.05*g;add(L,x,v*.8);add(R,x,v*1.2);}};
 const clap=(t:number,g:number)=>{const a=Math.floor(t*SR),b=Math.min(N,a+Math.floor(.2*SR));let lp=0;for(let x=a;x<b;x++){const u=(x-a)/SR,n=noise();lp+=.35*(n-lp);const v=(n-lp)*Math.exp(-u*22)*.11*g;add(L,x,v);add(R,x,v);add(revL,x,v*.6);add(revR,x,v*.6);}};
 if(s.drums!=='none')for(let t=Math.ceil(drumsFrom/beat)*beat,k=Math.round(t/beat);t<endAt-1e-6;t+=beat/2,k+=.5){
  const on=Number.isInteger(k),bi=((Math.round(k)%4)+4)%4;
  if(s.drums==='soft'){if(on&&(bi===0||bi===2))kick(t,.7);if(on&&bi===2)clap(t,.6);if(!on)hat(t,.6);}
  else if(s.drums==='four'){if(on)kick(t,.85);if(on&&(bi===1||bi===3))clap(t,.8);if(!on)hat(t,1);}
  else{if(on)kick(t,1);if(on&&(bi===1||bi===3))clap(t,1);hat(t,on?.6:1.1);}
 }
 // Reverb (Schroeder: four combs, two all-passes) on the pad, plucks and claps.
 const reverb=(src:Float32Array,out:Float32Array,spread:number)=>{
  const combs=[1557,1617,1491,1422].map(d=>({buf:new Float32Array(d+spread),i:0,lp:0}));const alls=[225,556].map(d=>({buf:new Float32Array(d+spread),i:0}));
  for(let x=0;x<N;x++){let y=0;for(const c of combs){const o=c.buf[c.i]!;c.lp=o*.7+c.lp*.3;c.buf[c.i]=src[x]!+c.lp*.8;c.i=(c.i+1)%c.buf.length;y+=o;}
   for(const a of alls){const o=a.buf[a.i]!;const v=-y*.5+o;a.buf[a.i]=y+o*.5;a.i=(a.i+1)%a.buf.length;y=v;}out[x]!+=y*.12;}};
 reverb(revL,L,0);reverb(revR,R,23);
 // Fade in, fade out into the last chord's end, soft clip, normalise.
 let peak=0;for(let x=0;x<N;x++){const t=x/SR,env=Math.min(1,t/.5)*Math.min(1,(D-t)/1.4);L[x]=Math.tanh(L[x]!*env*1.1);R[x]=Math.tanh(R[x]!*env*1.1);peak=Math.max(peak,Math.abs(L[x]!),Math.abs(R[x]!));}
 const k=peak>0?.89/peak:1;
 const data=Buffer.alloc(N*4);for(let x=0;x<N;x++){data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,L[x]!*k))*32767),x*4);data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,R[x]!*k))*32767),x*4+2);}
 const h=Buffer.alloc(44);h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVE',8);h.write('fmt ',12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);
 h.writeUInt32LE(SR,24);h.writeUInt32LE(SR*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
 await fs.writeFile(file,Buffer.concat([h,data]));
 return {file,mood:i.mood,bpm,key:name,progression:prog.join('-'),duration:D};
}
