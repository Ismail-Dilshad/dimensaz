import path from 'node:path';
import type {Project} from '../engine/schema.js';
import {dir,inside} from '../engine/project.js';
import {ffmpeg,run} from './ffmpeg-encoder.js';
export async function mixAudio(p:Project,input:string,output:string,duration:number){
 const d=p.config.director?.resolved;
 // Automatic music ducks under the voice-over (effects keep their usual level).
 const autoDuck=p.media.some(m=>m.metadata?.autoMusic)&&p.media.some(m=>m.kind==='voice');
 const mix=d?.audioMixing??(p.config.explainer?{ducking:true,sfxGain:.12}:autoDuck?{ducking:true,sfxGain:p.config.voiceVolume}:undefined);
 type Track=Project['media'][number]&{mix?:{gain:number;duration:number;fadeIn:number;fadeOut:number}};
 const tracks:Track[]=p.media.filter(m=>['voice','music','sfx'].includes(m.kind)||(m.kind==='video'&&p.config.preserveOriginal&&m.metadata?.streams?.some((s:any)=>s.codec_type==='audio'))).filter(m=>!d||(m.kind!=='music'||d.backgroundMusic!=='off')&&(m.kind!=='sfx'||d.soundEffects&&!m.metadata?.directorSource));
 if(d?.soundEffects)for(const event of p.soundTimeline??[]){if(event.disabled||!event.approved)continue;const media=p.media.find(m=>m.id===event.mediaId);if(!media)throw new Error('Missing sound event media');tracks.push({...media,at:event.time,mix:{gain:event.gain,duration:event.duration,fadeIn:event.fadeIn,fadeOut:event.fadeOut}});}
 const longest=tracks.filter(m=>m.kind==='voice').reduce((a,m)=>Math.max(a,Number(m.metadata?.format?.duration||0)+m.at),0);
 if(longest>duration+.05)throw new Error('Voiceover exceeds timeline. Extend scenes explicitly before rendering.');
 if(!tracks.length){await run(ffmpeg,['-v','error','-n','-i',input,'-map','0:v:0','-c:v','copy','-movflags','+faststart',output]);return false;}
 const args=['-v','error','-n','-i',input];
 tracks.forEach(m=>{if(m.kind==='music'&&m.metadata?.loop!==false)args.push('-stream_loop','-1');args.push('-i',inside(dir(p.id,p.config),m.path));});
 const filters=tracks.map((m,i)=>{
  // The piece sound bed is levelled when it is made, so it plays at its own level.
  const volume=m.mix?.gain??(typeof m.metadata?.gain==='number'?m.metadata.gain:m.metadata?.pieceSounds?(mix?.ducking?.8:1):m.kind==='music'?p.config.musicVolume:m.kind==='video'?p.config.originalVolume:m.kind==='sfx'?(mix?.sfxGain??p.config.voiceVolume):p.config.voiceVolume);
  const shortEffect=(p.referenceWorkflow||p.config.explainer)&&m.kind==='sfx';
  const effectDuration=shortEffect?Number(m.metadata?.format?.duration):NaN;
  const length=Math.min(m.mix?.duration??(Number.isFinite(effectDuration)?effectDuration:duration),duration-m.at);
  const fadeIn=m.mix?.fadeIn??(shortEffect?Math.min(.005,length/4):p.config.fadeIn),fadeOut=m.mix?.fadeOut??(shortEffect?Math.min(.04,length/4):p.config.fadeOut);
  const delay=Math.round(m.at*1000);return '['+(i+1)+':a:0]aresample=48000,aformat=channel_layouts=stereo,atrim=duration='+length+',asetpts=PTS-STARTPTS,volume='+volume+',afade=t=in:st=0:d='+fadeIn+',afade=t=out:st='+Math.max(0,length-fadeOut)+':d='+fadeOut+',adelay='+delay+':all=1,apad,atrim=duration='+duration+'[a'+i+']';
 });
 // A director or explainer ducks everything under the voice; automatic music ducks only itself.
 const onlyMusic=autoDuck&&!d?.audioMixing&&!p.config.explainer;
 const ducks=(m:Track)=>m.kind!=='voice'&&(!onlyMusic||m.kind==='music');
 const voice=tracks.flatMap((m,i)=>m.kind==='voice'?['[a'+i+']']:[]),bed=tracks.flatMap((m,i)=>ducks(m)?['[a'+i+']']:[]),rest=tracks.flatMap((m,i)=>m.kind!=='voice'&&!ducks(m)?['[a'+i+']']:[]);
 let labels=tracks.map((_,i)=>'[a'+i+']').join(''),count=tracks.length;
 if(mix?.ducking&&voice.length&&bed.length){
  filters.push(voice.join('')+'amix=inputs='+voice.length+':normalize=0,asplit=2[voice][side]');
  filters.push(bed.join('')+'amix=inputs='+bed.length+':normalize=0[bed]');
  filters.push('[bed][side]sidechaincompress=threshold=0.025:ratio=6:attack=10:release=220[ducked]');labels='[voice][ducked]'+rest.join('');count=2+rest.length;
 }
 filters.push(labels+'amix=inputs='+count+':duration=longest:normalize=0'+(p.config.normalize?',loudnorm=I=-16:TP=-1.5:LRA=11':'')+',alimiter=limit=0.95:level=0[outa]');
 args.push('-filter_complex',filters.join(';'),'-map','0:v:0','-map','[outa]','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart',output);
 await run(ffmpeg,args);return true;
}
