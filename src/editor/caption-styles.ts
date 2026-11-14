// Caption styles: how captions show and come in. Built-in ones, and the user's own (saved from any
// style with their changes: their colours, size, the way words appear). A style is a set of the
// caption operation's fields; an edit list names it with `preset`, and fields it sets itself win.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../engine/config-root.js';

export const MODES=['phrase','word','karaoke','build'] as const;
export const REVEALS=['none','fade','pop','rise','slide'] as const;
export type StyleFields={style?:typeof MODES[number];reveal?:typeof REVEALS[number];keyword?:boolean;upper?:boolean;highlight?:string;
 size?:number;color?:string;stroke?:string;strokeWidth?:number;background?:string|null;weight?:number;maxWidth?:number;position?:'bottom'|'center'|'top';margin?:number};
export type CaptionStyle={name:string;label:string;about:string;fields:StyleFields;yours:boolean;from?:string;created?:string};

export const BUILT_IN:CaptionStyle[]=[
 {name:'clean',label:'Clean',about:'A phrase at a time, white with a dark edge; it fades in.',fields:{style:'phrase',reveal:'fade'},yours:false},
 {name:'karaoke',label:'Karaoke',about:'The whole phrase, the word being said lit in the highlight colour.',fields:{style:'karaoke',reveal:'fade',highlight:'#FFD400'},yours:false},
 {name:'word-pop',label:'Word by word',about:'One big word at a time, in capitals; each pops in.',fields:{style:'word',reveal:'pop',upper:true,size:.075,weight:800},yours:false},
 {name:'build-up',label:'Build up',about:'Words appear as they are said and stay until the phrase ends.',fields:{style:'build',reveal:'rise'},yours:false},
 {name:'key-word',label:'Key word',about:'A phrase at a time, its key word (a number, or the strongest word) in the highlight colour.',fields:{style:'phrase',keyword:true,reveal:'rise',highlight:'#FFD400'},yours:false},
 {name:'boxed',label:'Boxed',about:'On a dark box, no edge; each phrase slides up.',fields:{style:'phrase',reveal:'slide',background:'#000000B3',strokeWidth:0,weight:600},yours:false},
];
const file=()=>path.join(path.resolve(ROOT,process.env.TEMPOLOOM_SETTINGS_DIR||'.tempoloom'),'caption-styles.json');
type Store={version:1;default:string|null;styles:CaptionStyle[]};
function read():Store{try{const s=JSON.parse(fs.readFileSync(file(),'utf8')) as Store;return {version:1,default:s.default??null,styles:Array.isArray(s.styles)?s.styles:[]};}catch{return {version:1,default:null,styles:[]};}}
function write(s:Store){fs.mkdirSync(path.dirname(file()),{recursive:true});const tmp=file()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s,null,1)+'\n');fs.renameSync(tmp,file());}
export const captionStylesFile=file;

/** Every style: the built-in ones, then yours; and which one new edits use. */
export function captionStyles(){const s=read();return {styles:[...BUILT_IN,...s.styles],default:s.default??'clean'};}
export function captionStyle(name:string):CaptionStyle{
 const s=captionStyles().styles.find(x=>x.name===name);if(!s)throw new Error(`No caption style "${name}". Styles: ${captionStyles().styles.map(x=>x.name).join(', ')}`);return s;}
const HEX=/^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
/** Checks a style's fields (the same limits as the caption operation). */
export function cleanFields(f:Record<string,unknown>):StyleFields{
 const out:StyleFields={};const num=(k:string,lo:number,hi:number)=>{if(f[k]===undefined)return;const v=Number(f[k]);if(!Number.isFinite(v)||v<lo||v>hi)throw new Error(`${k} is from ${lo} to ${hi}`);(out as Record<string,unknown>)[k]=v;};
 if(f.style!==undefined){if(!(MODES as readonly string[]).includes(String(f.style)))throw new Error('style is '+MODES.join(', '));out.style=f.style as StyleFields['style'];}
 if(f.reveal!==undefined){if(!(REVEALS as readonly string[]).includes(String(f.reveal)))throw new Error('reveal is '+REVEALS.join(', '));out.reveal=f.reveal as StyleFields['reveal'];}
 for(const k of ['keyword','upper'] as const)if(f[k]!==undefined)out[k]=f[k]===true||f[k]==='true';
 for(const k of ['highlight','color','stroke'] as const)if(f[k]!==undefined){if(!HEX.test(String(f[k])))throw new Error(`${k} is a colour like #FFD400`);out[k]=String(f[k]);}
 if(f.background!==undefined){if(f.background!==null&&f.background!==''&&!HEX.test(String(f.background)))throw new Error('background is a colour like #000000B3, or none');out.background=f.background===''?null:f.background as string|null;}
 num('size',.02,.2);num('strokeWidth',0,.4);num('weight',100,900);num('maxWidth',.3,1);num('margin',0,1);
 if(f.weight!==undefined)out.weight=Math.round(out.weight!);
 if(f.position!==undefined){if(!['bottom','center','top'].includes(String(f.position)))throw new Error('position is bottom, center or top');out.position=f.position as StyleFields['position'];}
 return out;
}
/** Saves your own style: another style with your changes. Your styles can be used like the built-in ones. */
export function saveStyle(name:string,o:{from?:string;fields?:Record<string,unknown>;about?:string;makeDefault?:boolean}={}){
 const id=name.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,30);
 if(id.length<2)throw new Error('Give the style a name');if(BUILT_IN.some(b=>b.name===id))throw new Error(`"${id}" is a built-in style; choose another name`);
 const base=o.from?captionStyle(o.from).fields:{},fields={...base,...cleanFields(o.fields??{})};
 const s=read(),style:CaptionStyle={name:id,label:name.trim().slice(0,40),about:o.about?.trim().slice(0,200)||`Your style${o.from?`, from ${captionStyle(o.from).label}`:''}.`,fields,yours:true,...(o.from?{from:o.from}:{}),created:new Date().toISOString()};
 s.styles=[...s.styles.filter(x=>x.name!==id),style];if(o.makeDefault)s.default=id;write(s);return style;
}
export function removeStyle(name:string){const s=read();if(!s.styles.some(x=>x.name===name))throw new Error(BUILT_IN.some(b=>b.name===name)?'Built-in styles stay':`No style "${name}" of yours`);s.styles=s.styles.filter(x=>x.name!==name);if(s.default===name)s.default=null;write(s);return {removed:name};}
export function setDefault(name:string){captionStyle(name);const s=read();s.default=name;write(s);return {default:name};}
/** A caption operation with its style applied: the style's fields, then the operation's own. */
export function withPreset(op:Record<string,unknown>){
 if(op.op!=='captions'||typeof op.preset!=='string')return op;
 const {preset,...rest}=op;return {...captionStyle(preset).fields,...rest};
}
/** The fields a captions operation gets from a style (yours by default), complete. */
export function styleFor(name?:string){
 const s=captionStyles(),pick=name??s.default,st=s.styles.find(x=>x.name===pick)??BUILT_IN[0]!;
 return {style:'phrase' as StyleFields['style'] & string,reveal:'none' as StyleFields['reveal'] & string,keyword:false,upper:false,highlight:'#FFD400',...st.fields,name:st.name} as
  Required<Pick<StyleFields,'style'|'reveal'|'keyword'|'upper'|'highlight'>>&StyleFields&{name:string};
}
/** A style's fields for a captions operation (without its name). */
export const styleFields=(name?:string)=>{const {name:_,...f}=styleFor(name);return f;};
