export function strongDirection(text:string):'rtl'|'ltr'|undefined {
 // First strong character, ignoring numbers, spaces and punctuation.
 for(const c of text){if(/[\p{L}]/u.test(c))return /[\u0590-\u08ff\ufb1d-\ufefc]/u.test(c)?'rtl':'ltr';}
 return undefined;
}
export function direction(text:string):'rtl'|'ltr' {return strongDirection(text)||'ltr';}
export function words(text:string){return [...text.matchAll(/\S+/gu)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}));}
export function graphemes(text:string){return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(s=>({text:s.segment,start:s.index,end:s.index+s.segment.length}));}
