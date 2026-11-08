import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {explainerRequestSchema,explainerThemeSchema,type ExplainerTheme} from './explainer-schema.js';
import {contrastRatio} from './director-integration.js';
import {roots} from './config.js';
import {writeJSON} from './project.js';
import type {Project,Scene,Config} from './schema.js';

const palettes=[
 {palette:'plum-paper',background:'#FBF7F2',ink:'#2A2038',accent:'#6C3F89',tint:'#EADDF1'},
 {palette:'forest-mist',background:'#F3F6EA',ink:'#203B32',accent:'#30674B',tint:'#D8E7C5'},
 {palette:'midnight-amber',background:'#172B3A',ink:'#FFF9EA',accent:'#FFD38A',tint:'#344650'},
 {palette:'terracotta-cream',background:'#FFF6EC',ink:'#412D29',accent:'#A8422F',tint:'#F3D7C5'},
 {palette:'ink-lavender',background:'#F5F2FF',ink:'#252449',accent:'#5850A2',tint:'#E3DCF5'},
 {palette:'teal-ice',background:'#F0F9F8',ink:'#183B40',accent:'#1E646B',tint:'#D4EBE6'}
];
export type ThemeHistory={project:string;createdAt:string;scriptHash:string;theme:ExplainerTheme;icons:string[]};
export async function readThemeHistory(c:Config):Promise<ThemeHistory[]>{
 const folder=path.join(roots(c).workspace,'history','explainer-themes');
 const files=await fs.readdir(folder).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return [];throw e;});
 const records=await Promise.all(files.filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await fs.readFile(path.join(folder,f),'utf8')) as ThemeHistory));
 return records.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-20);
}
// defaultFont is the project's language font; an explicit overrides.font still wins.
export function chooseExplainerTheme(raw:z.input<typeof explainerRequestSchema>,history:ThemeHistory[]=[],defaultFont='assets/fonts/open/Vazirmatn-Variable.ttf'):ExplainerTheme{
 const {brief,overrides}=explainerRequestSchema.parse(raw),recent=history.at(-1)?.theme;
 const preferred={commerce:0,nature:1,learning:4,productivity:2,general:5}[brief.domain];
 const candidates=palettes.map((_,i)=>palettes[(i+preferred)%palettes.length]);
 const palette=candidates.find(p=>!history.slice(-3).some(h=>h.theme.palette===p.palette))??candidates.find(p=>p.palette!==recent?.palette)??candidates[0];
 const firstDifferent=<T extends string>(items:T[],last?:T)=>items.find(x=>x!==last)!;
 const backgrounds:ExplainerTheme['backgroundStyle'][]=brief.domain==='nature'?['mesh','texture','none','dots','gradient','grid']:brief.domain==='commerce'?['dots','none','gradient','grid','texture','mesh']:['gradient','grid','none','texture','dots','mesh'];
 const sets:ExplainerTheme['iconSet'][]=brief.domain==='nature'?['organic','rounded','geometric']:['rounded','geometric','organic'];
 const renders:ExplainerTheme['iconRendering'][]=brief.domain==='nature'?['duotone','outline','solid']:['outline','duotone','solid'];
 const theme=explainerThemeSchema.parse({version:1,brief,...palette,backgroundStyle:firstDifferent(backgrounds,recent?.backgroundStyle),iconSet:firstDifferent(sets,recent?.iconSet),iconRendering:firstDifferent(renders,recent?.iconRendering),highlight:firstDifferent<ExplainerTheme['highlight']>(brief.domain==='nature'?['pill','color','underline']:['underline','pill','color'],recent?.highlight),duration:.5,font:defaultFont,...overrides,explicit:Object.keys(overrides),rationale:['Pending explanation'],warnings:[]});
 return describeTheme(theme,history);
}

export function themeContrast(t:ExplainerTheme){return {body:contrastRatio(t.ink,t.background),highlight:contrastRatio(t.accent,t.background),pill:contrastRatio(t.ink,t.tint),accentOnTint:contrastRatio(t.accent,t.tint)};}
export function describeTheme(t:ExplainerTheme,history:ThemeHistory[]=[]){
 t.rationale=[`${t.brief.topic}: ${t.brief.industry}; audience ${t.brief.audience}; emotion ${t.brief.emotion}; tone ${t.brief.tone}.`,`${t.palette} pairs a quiet background with a readable accent; ${t.backgroundStyle} stays static behind the safe text panel.`,`${t.iconSet} ${t.iconRendering} symbols support ${t.brief.domain} metaphors; ${t.highlight} marks entire phrases.`,`${t.font} preserves Sorani joining; typography is centered RTL with complete phrase nodes.`,history.length?'Recent history used to vary palette, background, icon family, rendering and highlight.':'No earlier script-led theme found; domain preference selected.',t.explicit.length?'Explicit overrides preserved: '+t.explicit.join(', '):'No explicit aesthetic overrides.'];
 const checks=themeContrast(t);if(Object.values(checks).some(v=>v<4.5))throw new Error('Explainer palette fails 4.5:1 text contrast: '+JSON.stringify(checks));
 t.warnings=history.slice(-5).filter(h=>['palette','backgroundStyle','iconSet','iconRendering','highlight'].filter(k=>h.theme[k as keyof ExplainerTheme]===t[k as keyof ExplainerTheme]).length>=4).map(h=>'Near-duplicate theme: '+h.project+' (4/5 or more design axes match; explicit overrides are retained).');
 return t;
}
export function duplicateReport(scenes:Scene[]){
 const usedIcons=new Map<string,string>(),usedLines=new Map<string,string>(),issues:string[]=[],callbacks:string[]=[],warnings:string[]=[];
 const ledger=scenes.map(s=>{
  for(const icon of s.explainer?.icons??[]){const prior=usedIcons.get(icon.name);if(prior&&!icon.callback)issues.push(`${s.id}: repeated ${icon.name} from ${prior}; explain callback or choose a relevant new symbol.`);if(prior&&icon.callback)callbacks.push(`${s.id}: ${icon.name}: ${icon.callback}`);usedIcons.set(icon.name,s.id);}
  for(const phrase of s.explainer?.phrases??[]){const copy=s.text.slice(phrase.from,phrase.to).trim().replace(/\s+/gu,' '),prior=usedLines.get(copy);if(prior&&!s.explainer?.copyCallback)issues.push(`${s.id}: repeated source phrase from ${prior}: ${copy}. Preserve supplied words; regroup or explain callback.`);usedLines.set(copy,s.id);}
  return {scene:s.id,icons:s.explainer?.icons.map(i=>i.name)??[],copy:s.text};
 });
 for(let i=0;i<scenes.length;i++)for(let j=0;j<i;j++){
  const tokens=(text:string)=>new Set(text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)??[]),a=tokens(scenes[i].text),b=tokens(scenes[j].text);
  const union=new Set([...a,...b]),intersection=[...a].filter(x=>b.has(x)).length;
  if(a.size>=3&&b.size>=3&&intersection/union.size>=.7)warnings.push(`${scenes[i].id} / ${scenes[j].id}: high lexical overlap; inspect meaning. Supplied copy was not rewritten.`);
 }
 return {issues,callbacks,warnings,ledger};
}
export function recentIconWarnings(p:Project,history:ThemeHistory[]){
 const current=new Set(p.scenes.flatMap(s=>s.explainer?.icons.map(i=>i.name)??[]));
 return history.filter(h=>h.project!==(p.parentId??p.id)).slice(-5).flatMap(h=>{const prior=new Set(h.icons),shared=[...current].filter(i=>prior.has(i)).length,union=new Set([...current,...prior]).size;return union&&shared/union>=.6?[`Near-duplicate icon vocabulary: ${h.project} (${shared}/${union} shared/union); inspect relevance and explain deliberate reuse.`]:[];});
}
export function assertExplainer(p:Project){
 const t=p.config.explainer;if(!t)return;
 if(p.config.referenceStyle||p.config.director)throw new Error('Explainer theme cannot be combined with a reference style or Director override.');
 describeTheme(structuredClone(t));
 for(const s of p.scenes){
  const e=s.explainer;if(!e)throw new Error(s.id+': missing explainer scene plan');
  if(p.media.some(m=>m.kind==='voice')&&!s.wordCues)throw new Error(s.id+': narrated explainer requires real word cues; do not infer them from reading speed');
  if(e.template==='stat'&&s.number===undefined)throw new Error(s.id+': stat needs a supplied number');
  let end=0,at=-1;
  for(const phrase of e.phrases){
   if(!s.text.slice(phrase.from,phrase.to).trim())throw new Error(s.id+': empty phrase');
   if(phrase.from!==end||phrase.to<=phrase.from||phrase.to>s.text.length||phrase.at<at||phrase.at>=s.duration)throw new Error(s.id+': phrases must cover exact text sequentially');
   if(phrase.from>0&&/\S/u.test(s.text[phrase.from-1])&&/\S/u.test(s.text[phrase.from]))throw new Error(s.id+': phrase splits a word');
   if(phrase.to<s.text.length&&/\S/u.test(s.text[phrase.to-1])&&/\S/u.test(s.text[phrase.to]))throw new Error(s.id+': phrase splits a word');
   if(s.wordCues){const cue=s.wordCues.find(c=>c.from>=phrase.from&&c.from<phrase.to);if(!cue||Math.abs(cue.start-phrase.at)>1e-6)throw new Error(s.id+': phrase reveal must use its first actual word cue');}
   if(phrase.at-at<t.duration&&at>=0)throw new Error(s.id+': phrase motions overlap; combine semantic phrases');
   end=phrase.to;at=phrase.at;
  }
  if(end!==s.text.length)throw new Error(s.id+': incomplete phrase coverage');
  for(let i=0;i<e.icons.length;i++){const icon=e.icons[i];if(icon.at+t.duration>s.duration-t.duration)throw new Error(s.id+': icon entrance leaves no hold');if(i>0&&icon.at<e.icons[i-1].at+t.duration)throw new Error(s.id+': dominant icon entrances overlap');}
 }
 if(p.scenes[0].explainer!.template!=='hook'||p.scenes[0].explainer!.phrases[0].at>1.5)throw new Error('Explainer needs a visible hook within two seconds');
 if(p.scenes.at(-1)!.explainer!.template!=='cta')throw new Error('Explainer needs a closing/CTA scene');
 const duplicates=duplicateReport(p.scenes);if(duplicates.issues.length)throw new Error(duplicates.issues.join('\n'));
}
export async function rememberTheme(p:Project){
 if(!p.config.explainer)return;
 const entry:ThemeHistory={project:p.id,createdAt:p.createdAt,scriptHash:createHash('sha256').update(p.script).digest('hex'),theme:p.config.explainer,icons:p.scenes.flatMap(s=>s.explainer?.icons.map(i=>i.name)??[])};
 await writeJSON(path.join(roots(p.config).workspace,'history','explainer-themes',p.id+'.json'),entry);
}
