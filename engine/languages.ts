import {z} from 'zod';

// Language metadata is explicit; shared alphabets cannot identify a dialect.
export const languageSchema=z.enum(['ckb','en','ar','fa','kmr','badini']);
export type Language=z.infer<typeof languageSchema>;
export function htmlLanguage(language:Language,text:string):string {
 if(language==='badini'||language==='kmr')return /\p{Script=Arabic}/u.test(text)?'kmr-Arab':'kmr-Latn';
 return language;
}
