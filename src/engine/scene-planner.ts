import {loadIndex} from '../motion-library/search.js';
import {findGuidance} from '../motion-library/guidance.js';
import type {ReferenceIndex} from '../motion-library/model.js';
import {selectSceneAsset} from './asset-selector.js';
import {parseScript} from './script-parser.js';
import {direction,words} from './rtl-layout.js';
import {classify,selectMotion} from './motion-selector.js';
import {sceneSchema,type Config,type Scene} from './schema.js';
export function plan(script:string,c:Config,library:ReferenceIndex=loadIndex()):Scene[]{
 const parts=parseScript(script);let start=0;
 return parts.map((text,i)=>{
  const tokens=words(text),role=classify(text,i,parts.length);
  const reference=findGuidance(library,role,c);
  const duration=Math.ceil(Math.max(c.minSceneDuration,tokens.length/c.wordsPerSecond+c.entrance+c.exit)*c.fps)/c.fps;
  const keyword=tokens.reduce<typeof tokens[number]|undefined>((a,b)=>!a||b.text.length>a.text.length?b:a,undefined);
  const scene=sceneSchema.parse({id:'scene-'+(i+1),text,start,duration,direction:c.direction==='auto'?direction(text):c.direction,role,
   animation:c.animation==='auto-directed'?(c.textTreatment==='kinetic'?['word-slide-up','center-word-swap','phrase-rise','smooth-replacement'][i%4]:selectMotion(role,reference)):c.animation,
   layout:c.textTreatment==='kinetic'?'center':role==='statistic'?'counter':role==='benefit'?'card':'center',
   highlights:keyword?[{start:keyword.start,end:keyword.end}]:[],asset:c.visuals?selectSceneAsset(role,reference):undefined,
   objectMotion:reference?.technique?.guidance?.objectMotion,
   motion:c.animation==='auto-directed'&&reference?.technique?.guidance?{duration:reference.technique.guidance.entranceSeconds,easing:reference.technique.guidance.easing,intensity:reference.technique.guidance.intensity}:undefined,
   reference:reference?.technique?{id:reference.record.id,contentHash:reference.record.contentHash,source:reference.record.source,technique:reference.technique.name,start:reference.technique.start,end:reference.technique.end,approximate:reference.technique.approximate,notes:reference.technique.implementation}:undefined});
  start+=duration;return scene;
 });
}
export function validateTimeline(scenes:Scene[],script?:string){
 let end=0;const ids=new Set<string>();
 for(const s of scenes){sceneSchema.parse(s);if(ids.has(s.id))throw new Error('Duplicate scene ID');ids.add(s.id);
 if(Math.abs(s.start-end)>.0001)throw new Error('Timeline has gaps or overlap');end=s.start+s.duration;
 for(const h of s.highlights)if(h.end> s.text.length||h.end<=h.start)throw new Error('Invalid highlight range');}
 if(scenes.some(s=>!s.text.trim()))throw new Error('Whitespace-only scenes are not renderable');
 if(!scenes.length)throw new Error('No scenes. Run video:plan first.');
 if(script!==undefined&&scenes.map(s=>s.text).join('')!==script)throw new Error('Scene text differs from exact source script.');
 return end;
}

