import type {Project} from './schema.js';
// Global source-word indices survive scene regrouping. Only genuine reviewed cues resolve anchors.
export function speechEvents(p:Project){
 const anchors=p.speechAnchors??[];
 if(!anchors.length)return [];
 if(!p.alignmentEvidence?.reviewed||p.config.voiceTiming!=='required')throw new Error('Speech anchors require reviewed exact alignment');
 const cues=p.scenes.flatMap(scene=>(scene.wordCues??[]).map(cue=>({scene, cue})));
 const count=[...p.script.matchAll(/\S+/gu)].length;
 if(cues.length!==count)throw new Error('Speech anchors require complete word cues');
 const seen=new Set<string>();
 return anchors.map(anchor=>{
  const source=cues[anchor.wordIndex];if(!source)throw new Error('Speech anchor word index is out of range');
  const time=source.scene.start+source.cue[anchor.edge]+anchor.offset;
  if(time<source.scene.start||time>=source.scene.start+source.scene.duration)throw new Error('Speech anchor falls outside its word scene');
  const key=anchor.kind==='sfx'?'sfx:'+anchor.mediaId:anchor.kind+':'+source.scene.id;
  if(seen.has(key))throw new Error('Duplicate speech anchor target');seen.add(key);
  if(anchor.kind==='sfx'&&!p.media.some(m=>m.id===anchor.mediaId&&m.kind==='sfx'))throw new Error('Speech anchor requires an imported SFX media ID');
  return {...anchor,time,sceneId:source.scene.id};
 });
}
export function retimeSpeechEvents(p:Project){
 for(const event of speechEvents(p))if(event.kind==='sfx')p.media.find(m=>m.id===event.mediaId)!.at=event.time;
}
export function assertSpeechEvents(p:Project){
 for(const event of speechEvents(p))if(event.kind==='sfx'&&Math.abs(p.media.find(m=>m.id===event.mediaId)!.at-event.time)>1e-6)throw new Error('Speech-anchored SFX is stale; reapply reviewed alignment');
}
