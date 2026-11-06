import type {Scene} from '../engine/schema.js';
export function sceneAt(scenes:Scene[],t:number){return scenes.find(s=>t>=s.start&&t<s.start+s.duration);}
export function total(scenes:Scene[]){return scenes.length?scenes.at(-1)!.start+scenes.at(-1)!.duration:0;}
