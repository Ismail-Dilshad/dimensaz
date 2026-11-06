import {referenceStyleSchema,type ReferenceStyle,referenceStyleIds,sceneScoreFrames} from './reference-motion-schema.js';
import {deriveStyle} from './style-dna.js';
import type {Project} from './schema.js';

const blue:ReferenceStyle={
 version:1,id:'style-1',name:'Blue on White - Discovery',background:'#FFFFFF',corner:'#C8DBFF',
 accent:'#1F5FFF',ink:'#0B1B3A',onAccent:'#FFFFFF',shadow:'#BBD0FF',
 grid:{geometry:'square',color:'#CFDAE9',spacing:60,opacity:1,width:2},
 lines:{count:2,color:'#D5E0F7',opacity:.25,angle:-38,width:3},
 material:'matte white and blue 3D objects, selective glass',lighting:'soft studio upper-left, blue-tinted floor shadows',
 texture:'flat',motion:'smooth',
};
const red:ReferenceStyle={...blue,id:'style-3',name:'Black and Red — Direction',
 background:'#0A0A0B',corner:'#17171A',accent:'#E5202E',ink:'#FFFFFF',onAccent:'#FFFFFF',shadow:'#7A0F18',
 grid:{...blue.grid,color:'#1E1E22'},lines:{...blue.lines,color:'#3A1F24'},
 material:'glossy black, steel and red physical metaphors',lighting:'hard upper-left light, red rim and floor glow',motion:'snappy'};
export const referenceStyles:Record<typeof referenceStyleIds[number],ReferenceStyle>={
 'style-1':blue,'style-2':{...blue,id:'style-2',name:'Blue on White — Mechanisms'},
 'style-3':red,
 'style-4':{...blue,id:'style-4',name:'Warm Orange — Action',background:'#FAF5EC',corner:'#FFD3B3',
 accent:'#FF6A1A',ink:'#1A1411',onAccent:'#1A1411',shadow:'#FFD3B3',
 grid:{...blue.grid,geometry:'dotted',color:'#E6DCCB'},lines:{...blue.lines,color:'#E2D2B8'},
 material:'matte cream and glossy orange physical metaphors',lighting:'soft warm studio upper-left',texture:'paper'},
 'style-5':{...red,id:'style-5',name:'Emerald and Lime — Contrast',background:'#06201A',corner:'#0B5C45',
 accent:'#C6F432',ink:'#F4FFF0',onAccent:'#06201A',shadow:'#0B5C45',
 grid:{...blue.grid,color:'#0F3A30'},lines:{...blue.lines,color:'#14463A'},
 material:'pearl-white and dark-green objects with lime details',lighting:'soft cinematic upper-left, lime rim',motion:'smooth'},
 'style-6':{...red,id:'style-6',name:'Black and Red — Diagnosis'},
 'style-7':{...blue,id:'style-7',name:'Lavender Glass — Trust',background:'#F7F6FF',corner:'#E9E4FF',
 accent:'#6D5BFF',ink:'#1C1B3A',onAccent:'#FFFFFF',shadow:'#E9E4FF',
 grid:{...blue.grid,geometry:'dotted',color:'#E3DFF5',opacity:.55},lines:{...blue.lines,color:'#DCD5F7'},
 material:'frosted glass, pearl-white and violet objects',lighting:'large diffused studio source, violet shadows',texture:'glass',motion:'gentle'}
};
export function applyReferenceStyle(p:Project,id:typeof referenceStyleIds[number]){
 // Persist a full snapshot so later preset edits cannot restyle existing projects.
 const lock=p.config.referenceStyle?.id===id?p.config.referenceStyle:referenceStyleSchema.parse(structuredClone(referenceStyles[id]));
 p.config.referenceStyle=lock;
 Object.assign(p.config,{background:'white-grid',primary:lock.accent,white:lock.background,ink:lock.ink,
 dark:lock.background,visuals:true,textTreatment:'kinetic',progress:false,theme:'editorial'});
 p.styleDNA={...(p.styleDNA??deriveStyle(p.config)),palette:[lock.accent,lock.background,lock.ink],material:lock.material,lighting:lock.lighting};
 for(const s of p.scenes){s.animation='word-slide-up';s.layout='center';}
}
export function selectedAssetIds(p:Project):string[]{
 return [...new Set(p.scenes.flatMap(s=>[...(s.asset?[s.asset]:[]),...(s.referenceMotion?.layers.map(l=>l.asset)??[])]))];
}
export function assertReferenceScenes(p:Project){
 if(!p.config.referenceStyle){
  if(p.scenes.some(s=>s.referenceMotion))throw new Error('Reference layers require a reference style preset.');
  return;
 }
 for(const [i,s] of p.scenes.entries()){
  if(!s.asset||!s.referenceMotion)throw new Error('Reference scene '+s.id+' requires an explicit hero asset and referenceMotion storyboard. Use video:reference plan, source/import its layers, and supply scenes; generic icons are not a faithful substitute.');
  if(/^REQUIRED:/i.test(s.referenceMotion.metaphor))throw new Error('Reference scene '+s.id+' still has a placeholder metaphor; complete its physical storyboard.');
  if(s.referenceMotion.scoreFrames&&(s.referenceMotion.scoreFrames!==sceneScoreFrames(s.start,s.start+s.duration,p.config.fps)||p.config.fps!==60||p.config.width!==1080||p.config.height!==1920))
   throw new Error(s.id+' requires a 1080×1920 score at 60 fps with a frame count matching its scene boundaries.');
  if(s.number!==undefined)throw new Error('Reference scenes use authored chart layers; remove the legacy statistics counter.');
  if(s.referenceMotion.continuity==='carry-hero'&&(i===0||p.scenes[i-1].asset!==s.asset||s.referenceMotion.camera!=='static'||p.scenes[i-1].referenceMotion?.camera!=='static'||p.scenes[i-1].referenceMotion?.transition!=='cut'))throw new Error('carry-hero requires the same hero, static cameras and a preceding cut; author a compatible match between scenes');
  if(s.referenceMotion.continuity==='carry-hero'){
   const previous=p.scenes[i-1].referenceMotion!;
   if(previous.heroMotion||s.referenceMotion.heroMotion||previous.heroLoop!=='none'||s.referenceMotion.heroLoop!=='none'||previous.rotation!==s.referenceMotion.rotation||JSON.stringify(previous.composition?.hero??previous.layout)!==JSON.stringify(s.referenceMotion.composition?.hero??s.referenceMotion.layout))throw new Error('carry-hero requires matching stationary hero geometry and rotation');
  }
 }
}
export function styleLockText(s:ReferenceStyle){
 return ['STYLE LOCK — '+s.name,'Background '+s.background+'; corner '+s.corner+'; '+s.texture,
  'Grid '+s.grid.geometry+', '+s.grid.color+', spacing '+s.grid.spacing+'px, opacity '+s.grid.opacity,
  'Exactly '+s.lines.count+' diagonal lines, '+s.lines.color+', opacity '+s.lines.opacity,
  'Accent '+s.accent+'; headline '+s.ink+'; text on accent '+s.onAccent,
  'Hero material: '+s.material,'Lighting: '+s.lighting,'Motion: '+s.motion,
  'One hero, at most two supporting accents. Independent hero parts. Text composited separately in the project font.'].join('\n');
}

