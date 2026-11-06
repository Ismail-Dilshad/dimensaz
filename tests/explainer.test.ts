import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {chooseExplainerTheme,duplicateReport,assertExplainer,type ThemeHistory} from '../engine/explainer-design.js';
import {explainerSceneSchema} from '../engine/explainer-schema.js';
import {defaults} from '../engine/config.js';
import {sceneSchema,type Project} from '../engine/schema.js';
import {openRenderer} from '../renderer/browser-renderer.js';
import {checkGeometry,qaTimes} from '../renderer/explainer-qa.js';

const brief={topic:'Local shop discovery',industry:'retail',audience:'Sorani shop owners',emotion:'curiosity',tone:'calm and friendly',domain:'commerce' as const};
const scene=(text:string,id:string,start:number,template:'hook'|'cta',icon:'store'|'message')=>sceneSchema.parse({id,text,start,duration:3,direction:'rtl',role:template,animation:'phrase-rise',layout:'center',highlights:[],explainer:{template,icons:[{name:icon,meaning:'Explain the central source concept',at:0}],phrases:[{from:0,to:text.length,at:0,highlight:true}],transition:'match-slide',transitionReason:'Clear the old symbol before the next enters the same anchor.'}});
async function fixture(width=1080,height=1920){const scenes=[scene('بۆچی خەڵک؟','hook',0,'hook','store'),scene('نامەمان بۆ بنێرە.','cta',3,'cta','message')];return {id:'explainer-test',title:'test',schemaVersion:1,slug:'test',sequence:1,createdAt:'2026-11-01',version:1,script:scenes.map(s=>s.text).join(''),config:await defaults({language:'ckb',width,height,fontSize:96,explainer:chooseExplainerTheme({brief})}),scenes,media:[],exports:[]} satisfies Project;}

it('varies every automatic design axis while preserving explicit overrides',()=>{
 const a=chooseExplainerTheme({brief});const history:ThemeHistory[]=[{project:'a',createdAt:'2026-11-01',scriptHash:'a',theme:a,icons:['store']}];
 const b=chooseExplainerTheme({brief:{...brief,topic:'Growing a plant',industry:'gardening',domain:'nature'}},history);
 for(const key of ['palette','backgroundStyle','iconSet','iconRendering','highlight'] as const)expect(b[key]).not.toBe(a[key]);
 const c=chooseExplainerTheme({brief,overrides:{backgroundStyle:'dots',iconRendering:'outline',highlight:'underline',palette:a.palette,background:a.background,ink:a.ink,accent:a.accent,tint:a.tint,iconSet:a.iconSet}},history);
 expect(c.backgroundStyle).toBe('dots');expect(c.warnings.join()).toContain('Near-duplicate');
 expect(()=>chooseExplainerTheme({brief,overrides:{ink:'#FFFFFF',background:'#FFFFFF'}})).toThrow(/contrast/);
});
it('flags repeats without changing supplied copy and accepts explained callbacks',async()=>{
 const p=await fixture();p.scenes[1].explainer!.icons[0].name='store';expect(duplicateReport(p.scenes).issues.join()).toContain('repeated store');
 const original=p.script;p.scenes[1].explainer!.icons[0].callback='Return to the shop from the opening to complete the story.';expect(duplicateReport(p.scenes).issues).toEqual([]);expect(p.script).toBe(original);
});
it('rejects split phrases, missing source text, invented cue starts and competing entrances',async()=>{
 const p=await fixture();assertExplainer(p);p.scenes[0].explainer!.phrases[0].to--;expect(()=>assertExplainer(p)).toThrow(/coverage|splits a word/);
 const q=await fixture();q.scenes[0].wordCues=[{from:0,to:5,start:.3,end:1}];expect(()=>assertExplainer(q)).toThrow(/actual word cue/);
 const r=await fixture();r.scenes[0].explainer!.icons.push({name:'bag',meaning:'A relevant support symbol',at:.2});expect(()=>assertExplainer(r)).toThrow(/overlap/);
 expect(()=>explainerSceneSchema.parse({...r.scenes[0].explainer,icons:Array(5).fill(r.scenes[0].explainer!.icons[0])})).toThrow();
});
it('detects overlap and clipping and includes half-second plus motion-boundary samples',async()=>{
 const p=await fixture();expect(qaTimes(p)).toContain(.5);expect(qaTimes(p)).toContain(2.5);
 const box={kind:'icon',x:0,y:0,w:100,h:100};const frame={time:0,scene:'x',fontReady:true,fontSize:70,sourceExact:true,textOverflow:false,direction:'rtl',boxes:[box,{...box,kind:'text'}],zones:{text:{...box,x:500},icons:{...box,x:200}}};
 expect(checkGeometry(frame,1080,1920).join()).toMatch(/Unsafe.*Overlapping/);
});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders whole Sorani phrases deterministically with safe reflow in all three formats',async()=>{
 for(const [width,height] of [[1080,1920],[1080,1080],[1920,1080]]){
  const p=await fixture(width,height),r=await openRenderer(p,.3);
  try{
   await r.page.evaluate(()=>window.render(1));const first=createHash('sha256').update(await r.page.screenshot()).digest('hex');
   const qa=await r.page.evaluate(()=>window.qa) as Parameters<typeof checkGeometry>[0];expect(checkGeometry(qa,width,height)).toEqual([]);
   expect(await r.page.locator('[data-scene="hook"] [data-phrase]').count()).toBe(1);
   await r.page.evaluate(()=>window.render(4));await r.page.evaluate(()=>window.render(1));expect(createHash('sha256').update(await r.page.screenshot()).digest('hex')).toBe(first);
   expect(await r.page.locator('[data-scene="hook"] [data-phrase]').textContent()).toBe(p.scenes[0].text);
  }finally{await r.close();}
 }
},60000);

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('reserves space for unrevealed multiline phrases and does not paint paragraph whitespace',async()=>{
 const p=await fixture();const s=p.scenes[0];s.text='ڕەنگە هۆکارەکە زۆر سادە بێت... چونکە هێشتا تۆیان نەناسیوە!\n\n';const cut=s.text.indexOf('چونکە');s.explainer!.phrases=[{from:0,to:cut,at:0,highlight:false},{from:cut,to:s.text.length,at:1.5,highlight:true}];p.script=p.scenes.map(s=>s.text).join('');
 const r=await openRenderer(p,.3);try{for(const time of [.1,1.5,2.1]){await r.page.evaluate(t=>window.render(t),time);expect(checkGeometry(await r.page.evaluate(()=>window.qa) as Parameters<typeof checkGeometry>[0],1080,1920)).toEqual([]);}expect(await r.page.locator('[data-scene="hook"] [data-phrase="1"]').textContent()).toBe(s.text.slice(cut));}finally{await r.close();}
});
