import {cardNames,referenceStyleIds,type CardName,type ReferenceStyle} from './reference-motion-schema.js';

const retiredCards = new Set<CardName>(['Citron Clay', 'Violet Cutout']);
export const activeCardNames = cardNames.filter(name => !retiredCards.has(name));

export function assertActiveCard(name: CardName) {
 if (retiredCards.has(name)) throw new Error(name + ' is available for saved projects only. Choose a realistic 3D card for a new project.');
}

// Public creation choices. Legacy registries remain decoders for saved work.
export const activeProductionPresets=['presenter-inserts','pendulum-reveal','script-explainer',...referenceStyleIds.map(id=>`reference-${id}`)];
export const defaultProductionPreset='reference-style-1' as const;
export function isActivePreset(name:string){return activeProductionPresets.includes(name);}
export function assertActivePreset(name:string){
 if(!isActivePreset(name))throw new Error('New videos use pendulum-reveal, script-explainer or reference-style-1 through reference-style-7. Legacy requests require the explicit --legacy-style compatibility option.');
}
export const fidelityCriteria=['composition','material','lighting','typography','overlap','motion','mobile-readability'] as const;
export function referenceAssetPrompt(style:ReferenceStyle,subject:string,part:string){
 return `Create one isolated ${part} for ${subject}. Material: ${style.material}. Lighting: ${style.lighting}. Palette: ${style.accent}, ${style.background}, ${style.ink}; shadows ${style.shadow}. Match the chosen reference camera and scale. Transparent background; entire object in frame; no lettering, logos, grid, floor, poster or unrelated objects. Keep movable parts separate and record their shared attachment points. This is an asset, not a completed scene.`;
}
