import {applyReferenceStyle} from './reference-styles.js';
import {referenceStyleIds} from './reference-motion-schema.js';
import type {Project} from './schema.js';
export const productionPresets={
 'presenter-inserts':{animation:'phrase-rise',theme:'minimal-kinetic',treatment:'kinetic'},
 'pendulum-reveal':{animation:'phrase-rise',theme:'minimal-kinetic',treatment:'kinetic'},
 'script-explainer':{animation:'phrase-rise',theme:'minimal-kinetic',treatment:'kinetic'},
 'reference-style-1':{animation:'word-slide-up',theme:'editorial',treatment:'kinetic'},
 'reference-style-2':{animation:'word-slide-up',theme:'editorial',treatment:'kinetic'},
 'reference-style-3':{animation:'word-slide-up',theme:'editorial',treatment:'kinetic'},
 'reference-style-4':{animation:'word-slide-up',theme:'editorial',treatment:'kinetic'},
 'reference-style-5':{animation:'word-slide-up',theme:'editorial',treatment:'kinetic'},
 'reference-style-6':{animation:'word-slide-up',theme:'editorial',treatment:'kinetic'},
 'reference-style-7':{animation:'word-slide-up',theme:'editorial',treatment:'kinetic'},
 // Text-only kinetic typography: no assets needed.
 'kinetic':{animation:'phrase-rise',theme:'minimal-kinetic',treatment:'kinetic'}
} as const;
export type ProductionPreset=keyof typeof productionPresets;
export function applyPreset(p:Project,name:ProductionPreset){
 const id=referenceStyleIds.find(id=>name==='reference-'+id);
 if(id)applyReferenceStyle(p,id);
 const preset=productionPresets[name];p.config.theme=preset.theme;p.config.textTreatment=preset.treatment;
 p.production={preset:name,sfx:p.production?.sfx||'off'};
 for(const scene of p.scenes)scene.animation=preset.animation;
}
