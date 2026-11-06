import type {Config} from '../engine/schema.js';
export function style(c:Config){return {
 'minimal-kinetic':{intensity:.65,card:false,weight:'normal',accent:c.primary},
 'saas-motion':{intensity:.5,card:true,weight:'normal',accent:c.primary},
 'clay-motion':{intensity:.6,card:false,weight:'normal',accent:c.primary},
 'bold-viral':{intensity:1,card:false,weight:'bold',accent:c.primary},
 'editorial':{intensity:.25,card:false,weight:'normal',accent:c.ink},
 'highlight-explainer':{intensity:.35,card:false,weight:'normal',accent:c.primary}
}[c.theme];}
