import {cardNames,referenceStyleIds,type CardName,type ReferenceStyle} from './reference-motion-schema.js';

export const activeCardNames = [...cardNames];

export function assertActiveCard(name: CardName) {
 if (!cardNames.includes(name)) throw new Error('Unknown style card: ' + name);
}

// Public creation choices. Legacy registries remain decoders for saved work.
export const activeProductionPresets=['kinetic','presenter-inserts','pendulum-reveal','script-explainer',...referenceStyleIds.map(id=>`reference-${id}`)];
export const defaultProductionPreset='reference-style-1' as const;
export function isActivePreset(name:string){return activeProductionPresets.includes(name);}
export function assertActivePreset(name:string){
 if(!isActivePreset(name))throw new Error('Unknown preset '+JSON.stringify(name)+'. Use kinetic (text only), presenter-inserts, pendulum-reveal, script-explainer or reference-style-1 through reference-style-7.');
}
export const fidelityCriteria=['composition','material','lighting','typography','overlap','motion','mobile-readability'] as const;
export function referenceAssetPrompt(style:ReferenceStyle,subject:string,part:string){
 return `Create one isolated ${part} for ${subject}. Material: ${style.material}. Lighting: ${style.lighting}. Palette: ${style.accent}, ${style.background}, ${style.ink}; shadows ${style.shadow}. Match the chosen reference camera and scale. Transparent background; entire object in frame; no lettering, logos, grid, floor, poster or unrelated objects. Keep movable parts separate and record their shared attachment points. This is an asset, not a completed scene.`;
}
