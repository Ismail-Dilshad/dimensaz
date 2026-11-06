import {z} from 'zod';

// Language metadata is explicit; shared alphabets cannot identify a dialect.
export const languageSchema=z.enum(['ckb','en','ar','fa','kmr','badini']);
export type Language=z.infer<typeof languageSchema>;
// Requests may say "auto" (or omit language) to detect it from the script.
export const languageInputSchema=z.union([languageSchema,z.literal('auto')]);
export type LanguageInput=z.infer<typeof languageInputSchema>;
export const DEFAULT_LANGUAGE:Language='en';
export function htmlLanguage(language:Language,text:string):string {
 if(language==='badini'||language==='kmr')return /\p{Script=Arabic}/u.test(text)?'kmr-Arab':'kmr-Latn';
 return language;
}
export function isRtl(language:Language,text:string){
 if(language==='ckb'||language==='ar'||language==='fa')return true;
 if(language==='kmr'||language==='badini')return /\p{Script=Arabic}/u.test(text);
 return false;
}
// Letters used in Kurdish (Arabic script) but not in Arabic or Persian: ڕ ڵ ۆ ێ ە ڤ ھ.
const kurdishLetters=/[ڕڵۆێەڤھ]/u;
// Persian letters and forms not used in Arabic: پ چ ژ گ and Persian yeh/keheh.
const persianLetters=/[پچژگیک]/u;
/** Best-effort detection from the script. Dialects that share an alphabet (Kurmanji, Badini) are never guessed. */
export function detectLanguage(text:string):Language{
 const arabic=(text.match(/\p{Script=Arabic}/gu)??[]).length;
 // Any Arabic-script letters select an Arabic-script language; Latin words then use the Latin fallback font.
 if(arabic>0){if(kurdishLetters.test(text))return 'ckb';if(persianLetters.test(text))return 'fa';return 'ar';}
 return DEFAULT_LANGUAGE;
}
export function resolveLanguage(input:LanguageInput|undefined,text:string):Language{
 return !input||input==='auto'?detectLanguage(text):input;
}
