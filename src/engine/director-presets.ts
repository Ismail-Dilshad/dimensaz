import {referenceStyles} from './reference-styles.js';
import {factoryStyle,type DirectorValues} from './style-director-schema.js';
export const directorPresets:Record<string,DirectorValues>={};
export const legacyDirectorPresets:Record<string,DirectorValues>={};
const variants:Record<string,Partial<DirectorValues>>={
 'premium-saas-white-grid':{creativeDirection:'saas',composition:'card',background:'white-grid'},
 'viral-kinetic-typography':{creativeDirection:'viral',textEntrance:'bounce',palette:{primary:'#7c3aed',highlight:'#7c3aed',background:'#ffffff',text:'#111318'},animation:{energy:.8,duration:.3,easing:'back'}},
 'minimal-editorial':{creativeDirection:'editorial',background:'solid',illustrations:'none',animation:{energy:.2,duration:.6,easing:'cubic'},textEntrance:'fade'},
 'soft-clay-2d-composite':{creativeDirection:'clay',background:'soft-gradient',objectEntrance:'spring',palette:{primary:'#9370db',highlight:'#7c3aed',background:'#f7f3ff',text:'#222033'}},
 'glass-tech-2d-cards':{creativeDirection:'glass',composition:'card',background:'flow-gradient',palette:{primary:'#00a6b8',highlight:'#028495',background:'#e5f8fc',text:'#10262d'}},
 'dark-cinematic':{creativeDirection:'cinematic',background:'black-grid',grid:{...factoryStyle.grid,color:'#ffffff'},palette:{primary:'#f0b35b',highlight:'#f0b35b',background:'#10131b',text:'#f7f7fb'},camera:'gentle-zoom',animation:{energy:.25,duration:.65,easing:'cubic'},textEntrance:'fade'},
 'hybrid-motion':{creativeDirection:'hybrid',background:'abstract',composition:'card',textEntrance:'spring',objectEntrance:'slide-up'}
};
for(const [name,value] of Object.entries(variants))legacyDirectorPresets[name]={...structuredClone(factoryStyle),...value};

for(const s of Object.values(referenceStyles))directorPresets['reference-'+s.id]={...structuredClone(factoryStyle),referenceStyle:s.id,creativeDirection:'editorial',palette:{primary:s.accent,highlight:s.accent,background:s.background,text:s.ink},background:'white-grid',composition:'center',illustrations:'existing-assets'};
