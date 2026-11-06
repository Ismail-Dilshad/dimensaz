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
 'premium-viral':{animation:'word-slide-up',theme:'bold-viral',treatment:'kinetic'},
 'kinetic':{animation:'phrase-rise',theme:'minimal-kinetic',treatment:'kinetic'},
 'word-reveal':{animation:'word-slide-up',theme:'minimal-kinetic',treatment:'kinetic'},
 'active-word':{animation:'word-slide-up',theme:'highlight-explainer',treatment:'kinetic'},
 'text-bounce':{animation:'bounce-up',theme:'bold-viral',treatment:'kinetic'},
 'spring':{animation:'spring-entrance',theme:'minimal-kinetic',treatment:'kinetic'},
 'object-motion':{animation:'floating-objects',theme:'clay-motion',treatment:'classic'},
 'saas':{animation:'saas-feature-card',theme:'saas-motion',treatment:'classic'},
 'statistics':{animation:'statistics-counter',theme:'minimal-kinetic',treatment:'classic'},
 'camera':{animation:'parallax',theme:'editorial',treatment:'classic'},
 'clay':{animation:'floating-objects',theme:'clay-motion',treatment:'classic'},
 'premium-transition':{animation:'smooth-replacement',theme:'editorial',treatment:'kinetic'}
} as const;
export type ProductionPreset=keyof typeof productionPresets;
export function applyPreset(p:Project,name:ProductionPreset){
 const id=referenceStyleIds.find(id=>name==='reference-'+id);
 if(id)applyReferenceStyle(p,id);
 const preset=productionPresets[name];p.config.theme=preset.theme;p.config.textTreatment=preset.treatment;
 p.production={preset:name,sfx:p.production?.sfx||'off'};
 for(const scene of p.scenes)scene.animation=preset.animation;
 // Existing vectors are 2.5D, not a true 3D renderer. Never invent statistic values.
 if(name==='clay'||name==='object-motion'){p.config.visuals=true;for(const s of p.scenes){s.asset||='communication';s.objectMotion='float';}}
}
