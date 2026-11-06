import {applyReferenceStyle} from './reference-styles.js';
import {hasAcousticTiming} from './acoustic-alignment.js';
import {selectSceneAsset} from './asset-selector.js';
import {speechEvents} from './speech-events.js';
import fs from 'node:fs/promises';import path from 'node:path';
import {ROOT} from './config.js';import {save,importMedia} from './project.js';import {deriveStyle} from './style-dna.js';import {eligibleSfx,readSfxIndex,type Sfx} from './sfx.js';
import {directorSchema,styleForScene,type Director} from './style-director-schema.js';import type {Project} from './schema.js';
export function applyDirector(p:Project,input:Director){
 const d=directorSchema.parse(input),v=d.resolved;if(contrastRatio(v.palette.text,v.palette.background)<4.5)throw new Error('Text/background contrast is below 4.5:1; adjust the palette');p.config.director=d;
 for(const override of Object.values(d.sceneOverrides))for(const key of Object.keys(override))if(!['textReveal','textEntrance','textExit','textHighlight','objectEntrance','camera','transitions','animation'].includes(key))throw new Error('Scene override unsupported: '+key+'; use global setting');
 Object.assign(p.config,{theme:({saas:'saas-motion',viral:'bold-viral',minimal:'minimal-kinetic',clay:'clay-motion',glass:'saas-motion',cinematic:'editorial',editorial:'editorial',hybrid:'highlight-explainer'} as const)[v.creativeDirection],background:v.background,primary:v.palette.primary,white:v.palette.background,dark:v.palette.background,ink:v.palette.text,visuals:v.illustrations!=='none',font:v.typography.font==='auto'?p.config.font:v.typography.font,fontSize:v.typography.size,minFontSize:Math.min(p.config.minFontSize,v.typography.size),lineHeight:v.typography.lineHeight,intensity:v.animation.energy,entrance:v.animation.duration,exit:v.animation.duration,textTreatment:'kinetic',...v.export,voiceVolume:v.audioMixing.voiceGain,musicVolume:v.audioMixing.musicGain,transitionDuration:v.transitions==='cut'?0:v.animation.duration});
 p.styleDNA=deriveStyle(p.config);
 for(const scene of p.scenes){scene.director=styleForScene(d,scene.id);scene.layout=v.composition;scene.animation=scene.wordCues?'word-slide-up':'phrase-rise';if(v.illustrations==='none')delete scene.asset;else if(!v.referenceStyle&&!p.config.referenceStyle)scene.asset??=selectSceneAsset(scene.role);}
 if(v.referenceStyle)applyReferenceStyle(p,v.referenceStyle);
 return p;
}
export function directorEvents(p:Project){
 const anchors=speechEvents(p);
 const events:{id:string;sceneId:string;type:'word'|'icon'|'transition';time:number;word?:string;confidence:number}[]=[];
 for(const s of p.scenes){if((s.director??p.config.director?.resolved)?.transitions!=='cut')events.push({id:s.id+':transition',sceneId:s.id,type:'transition',time:s.start+Math.max(0,s.duration-p.config.transitionDuration),confidence:1});if(s.asset&&p.config.visuals)events.push({id:s.id+':icon',sceneId:s.id,type:'icon',time:anchors.find(a=>a.kind==='object'&&a.sceneId===s.id)?.time??s.start,confidence:1});
 if(p.alignmentEvidence?.reviewed||hasAcousticTiming(p))for(const [i,c] of (s.wordCues??[]).entries())if(s.highlights.some(h=>c.from<h.end&&c.to>h.start))events.push({id:s.id+':word:'+i,sceneId:s.id,type:'word',time:s.start+c.start,word:s.text.slice(c.from,c.to),confidence:p.acousticAlignment?.wordConfidence[p.scenes.slice(0,p.scenes.indexOf(s)).reduce((n,s)=>n+(s.wordCues?.length??0),0)+i]??1});}
 return events;
}
export function assertDirector(p:Project){const d=p.config.director;if(!d)return;
 if(d.resolved.backgroundMusic==='provided'&&!p.media.some(m=>m.kind==='music'))throw new Error('Background music is enabled but no licensed music was supplied');
 if(!d.confirmed)throw new Error('Confirm the unified style summary before final rendering');
 if(p.media.some(m=>m.kind==='voice')&&p.scenes.some(s=>['progressive','active','replacement','phrase'].includes(s.director?.textReveal??d.resolved.textReveal))&&(!(p.alignmentEvidence?.reviewed||hasAcousticTiming(p))||p.scenes.some(s=>!s.wordCues)))throw new Error('Selected spoken-word reveal requires reviewed alignment; no estimated word rendering');
 if(d.resolved.soundEffects&&p.soundTimeline?.some(e=>!e.disabled&&!e.approved))throw new Error('Sound suggestions require approval or removal before final rendering');
 for(const e of p.soundTimeline??[]){if(e.disabled)continue;const event=directorEvents(p).find(x=>x.id===e.eventId);if(!e.manual&&(!event||Math.abs(e.time-event.time-e.offset)>.001))throw new Error('Sound timeline is stale; regenerate suggestions after timing changes');}
}
export async function planDirectorSound(p:Project,candidates?:Sfx[]){
 const d=p.config.director?.resolved;if(!d)return;
 const manual=(p.soundTimeline??[]).filter(e=>e.manual);p.soundTimeline=manual;
 if(!d.soundEffects)return;
 if(d.soundSelection==='manual'||d.soundPlacement==='manual')return;
 const index:Sfx[]=candidates??await readSfxIndex();
 p.directorWarnings=[];
 const sounds=eligibleSfx(index).filter(s=>d.soundCategories.includes(s.category as any));
 if(!sounds.length)p.directorWarnings.push('No short CC0 sound matches the selected categories. No automatic sound was added. Import a licensed sound or adjust categories.');
 const events=directorEvents(p).filter(e=>d.soundSynchronization.includes(e.type)).sort((a,b)=>a.time-b.time);
 let last=-10,count=0;const spacing={subtle:3,balanced:2,energetic:1}[d.soundIntensity];
 for(const e of events){if(e.time-last<spacing||manual.some(m=>m.eventId===e.id)||!sounds.length)continue;
 const desired=e.type==='transition'?'whooshes':e.type==='icon'?'pops':'ticks';const choices=sounds.filter(s=>s.category===desired);const sound=(choices.length?choices:sounds)[count++%(choices.length||sounds.length)];
 let media=p.media.find(m=>m.kind==='sfx'&&m.metadata?.directorSource===sound.sha256);
 if(!media){await importMedia(p,sound.file,'sfx',e.time);media=p.media.at(-1)!;media.metadata={...media.metadata,directorSource:sound.sha256};}
 p.soundTimeline.push({id:e.id+':sound',eventId:e.id,sceneId:e.sceneId,type:e.type,time:e.time,offset:0,duration:sound.duration,gain:d.audioMixing.sfxGain,fadeIn:.01,fadeOut:.04,priority:e.type==='word'?2:1,confidence:e.confidence,mediaId:media.id,source:sound.file,license:sound.license!,manual:false,approved:d.soundSelection==='automatic'&&d.soundPlacement==='automatic',disabled:false});last=e.time;
 }
 await save(p);
}

export async function editDirectorSound(p:Project,id:string,patch:Partial<NonNullable<Project['soundTimeline']>[number]>){
 const event=p.soundTimeline?.find(e=>e.id===id);if(!event)throw new Error('Unknown sound event');
 const allowed=['time','offset','gain','duration','fadeIn','fadeOut','mediaId','disabled','approved'];if(Object.keys(patch).some(k=>!allowed.includes(k)))throw new Error('Unsupported sound edit');
 const candidate={...event,...patch,manual:event.manual||Object.keys(patch).some(k=>k!=='approved')};if(!p.media.some(m=>m.id===candidate.mediaId&&m.kind==='sfx'))throw new Error('Import the replacement sound before using its media ID');
 if(patch.offset!==undefined&&patch.time===undefined){const anchor=directorEvents(p).find(e=>e.id===event.eventId);if(!anchor)throw new Error('Event missing');candidate.time=anchor.time+patch.offset;}
 Object.assign(event,candidate);await save(p);return event;
}

export function contrastRatio(a:string,b:string){const luminance=(hex:string)=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
