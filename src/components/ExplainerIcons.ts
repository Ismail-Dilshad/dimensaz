import type {ExplainerTheme} from '../engine/explainer-schema.js';
import {iconNames} from '../engine/explainer-schema.js';
// Original native geometry. No external assets, text baked into props, or hidden dependencies.
export const symbolGeometry:Record<typeof iconNames[number],string>={
 store:'<path d="M17 45h66v41H17z"/><path d="M12 44l7-23h62l7 23M31 22l-3 22m22-22v22m19-22l3 22"/><path d="M16 44q8 14 16 0q9 14 18 0q9 14 18 0q8 14 16 0"/><path d="M28 61h18v25M59 59h14v14H59z"/>',
 bag:'<path d="M21 33h58l5 53H16z"/><path d="M36 36V25a14 14 0 0 1 28 0v11"/><path d="M38 60l9 9 18-21"/>',
 hidden:'<path d="M9 50Q50 7 91 50Q50 93 9 50z"/><circle cx="50" cy="50" r="13"/><path d="M16 14l68 72"/>',
 diamond:'<path d="M10 35l18-19h44l18 19-40 52zM10 35h80M28 16l10 19 12 52 12-52 10-19M38 35l12-19 12 19"/>',
 price:'<path d="M12 22h40l36 36-32 31L12 45z"/><circle cx="31" cy="35" r="5"/><path d="M48 45l20 20m-25-9l14 14"/>',
 pin:'<path d="M50 90S18 58 18 35a32 32 0 0 1 64 0c0 23-32 55-32 55z"/><circle cx="50" cy="35" r="11"/>',
 video:'<rect x="14" y="12" width="72" height="76" rx="12"/><path d="M42 31l23 16-23 16zM27 76h46"/>',
 hourglass:'<path d="M24 10h52M24 90h52M29 12v18l21 20-21 20v18m42-76v18L50 50l21 20v18M34 27h32M35 79l15-14 15 14z"/>',
 megaphone:'<path d="M13 40h23l43-22v64L36 62H13zM29 63l9 25h14l-8-20M89 37l7-5m-7 21h9m-9 17l7 5"/>',
 message:'<path d="M14 22h72v52H42L22 88V74h-8z"/><path d="M28 38h44M28 52h31"/>',
 people:'<circle cx="50" cy="31" r="13"/><path d="M26 86V69a24 24 0 0 1 48 0v17z"/><circle cx="17" cy="42" r="8"/><circle cx="83" cy="42" r="8"/><path d="M7 80V66q0-11 13-11m60 0q13 0 13 11v14"/>',
 target:'<circle cx="48" cy="53" r="36"/><circle cx="48" cy="53" r="23"/><circle cx="48" cy="53" r="9"/><path d="M49 52l34-34m-2 1V6m0 13h13"/>',
 seed:'<path d="M22 75C1 52 19 15 44 12c19-3 18 17 31 23 30 14 12 49-11 53-17 3-31-1-42-13z"/><path fill="none" d="M32 68c-8-11-1-28 12-35 10 24 27 13 29 30"/>',
 sun:'<circle cx="50" cy="50" r="23"/><path d="M50 5v10m0 70v10M5 50h10m70 0h10M18 18l7 7m50 50l7 7M18 82l7-7m50-50l7-7"/>',
 water:'<path d="M22 43h43l6 40H17zM30 43V30h26v13M65 48l20-16 9 12-25 25M36 30V19h17"/><path d="M85 61l-2 7m11-10l-2 7m0 10l-2 7"/>',
 sprout:'<path d="M50 89V44M50 61C22 65 12 44 13 26c23-2 40 14 37 35zM50 46C47 20 67 9 88 13c1 21-15 38-38 33zM23 89h54"/>',
 leaf:'<path d="M19 75C1 36 40 10 86 15c5 42-20 78-58 68zM27 76l45-46M42 61l-8-22m22 8l21-1"/>',
 flower:'<path d="M50 61v31m0-10q-27 0-28-23 24-2 28 23m0-10q25 0 29-23-24-1-29 23"/><path d="M38 18q12-28 24 0 29-3 19 22 21 19-7 29-12 23-24 0-28 5-28-19-23-17 3-27z"/><circle cx="49" cy="37" r="10"/>',
 folder:'<path d="M10 28h33l10 10h37v44H10zM10 28V18h28l11 10h34v10"/><path d="M29 55h40M29 67h26"/>',
 list:'<rect x="20" y="10" width="60" height="80" rx="8"/><path d="M32 31l4 4 8-10m-12 25l4 4 8-10m-12 25l4 4 8-10M54 31h14M54 50h14M54 69h14"/>',
 timer:'<circle cx="50" cy="56" r="33"/><path d="M50 56V35m0 21l16 10M40 10h20M50 10v13M75 27l8-8"/>',
 check:'<circle cx="50" cy="50" r="38"/><path d="M27 51l16 17 31-36"/>',
 flag:'<path d="M23 91V12m0 4q18-12 36 0 12 10 27-1v40q-16 10-29 0-17-12-34 0M10 91h27"/>',
 book:'<path d="M50 27Q30 8 10 18v63q20-10 40 8 20-18 40-8V18Q70 8 50 27v62M22 33l16 7m-16 7l16 7m24-14l16-7m-16 21l16-7"/>'
};
export function iconSvg(name:typeof iconNames[number],t:ExplainerTheme){
 const fill=t.iconRendering==='outline'?'none':t.iconRendering==='duotone'?t.tint:t.accent;
 const stroke=t.iconRendering==='solid'?t.ink:t.accent;
 const width=t.iconSet==='geometric'?3.8:t.iconSet==='organic'?4.8:4.2;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="${t.iconSet==='geometric'?'square':'round'}" stroke-linejoin="${t.iconSet==='geometric'?'miter':'round'}">${symbolGeometry[name]}</svg>`;
}
