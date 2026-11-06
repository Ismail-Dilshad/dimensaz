import type {Project} from './schema.js';
import {plan} from './scene-planner.js';
import {planReference} from './reference-storyboard.js';
export function planProject(p:Project){
 const scenes=p.referenceWorkflow&&p.config.referenceStyle?planReference(p.script,p.config.referenceStyle.id).request.scenes:plan(p.script,p.config);
 if(p.media.some(m=>m.kind==='voice'))for(const scene of scenes)scene.animation='phrase-rise';
 const base=scenes.reduce((sum,s)=>sum+s.duration,0);
 const mediaDuration=p.media.filter(m=>m.kind==='video'||m.kind==='voice').reduce((n,m)=>Math.max(n,Number(m.metadata?.format?.duration||0)+m.at),0);
 // Duration is estimated reading time, extended to preserve supplied media.
 // This is not speech alignment and must not be represented as such.
 if(mediaDuration>base){let start=0;for(const scene of scenes){scene.duration=Math.ceil(scene.duration*mediaDuration/base*p.config.fps)/p.config.fps;scene.start=start;start+=scene.duration;}}
 return scenes;
}
