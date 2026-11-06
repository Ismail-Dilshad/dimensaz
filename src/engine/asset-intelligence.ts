import type {LibraryRecord} from './asset-library.js';
import type {StyleDNA} from './style-dna.js';
export type Metrics={coverage:number;contrast:number;edgeDensity:number;colors:string[];signature:number[]};
export function pixelMetrics(pixels:number[],width:number,height:number):Metrics{
 let visible=0,edges=0,min=255,max=0;const bins=new Map<string,number>();const signature=Array(64).fill(0),counts=Array(64).fill(0);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,a=pixels[i+3]/255,l=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)*a+255*(1-a);const cell=Math.min(7,Math.floor(y*8/height))*8+Math.min(7,Math.floor(x*8/width));signature[cell]+=l/255;counts[cell]++;
 if(a>.1){visible++;min=Math.min(min,l);max=Math.max(max,l);const color='#'+pixels.slice(i,i+3).map(v=>Math.round(v/51)*51).map(v=>v.toString(16).padStart(2,'0')).join('');bins.set(color,(bins.get(color)||0)+1);}
 if(x&&Math.abs(l-((pixels[i-4]*.2126+pixels[i-3]*.7152+pixels[i-2]*.0722)*(pixels[i-1]/255)+255*(1-pixels[i-1]/255)))>32)edges++;
 }return {coverage:visible/(width*height),contrast:visible?(max-min)/255:0,edgeDensity:edges/(width*height),colors:[...bins].sort((a,b)=>b[1]-a[1]).slice(0,5).map(a=>a[0]),signature:signature.map((n,i)=>counts[i]?n/counts[i]:1)};
}
export function assessAsset(a:LibraryRecord,options:{targetPixels?:number;transparent?:boolean;style?:StyleDNA;query?:string}={}){
 const blockers:string[]=[],warnings:string[]=[],checks:{name:string;pass:boolean;reason:string}[]=[];
 const check=(name:string,pass:boolean,reason:string,fatal=true)=>{checks.push({name,pass,reason});if(!pass)(fatal?blockers:warnings).push(reason);};
 check('license',a.provenance.verified&&a.provenance.commercial===true&&!!a.provenance.licenseEvidence&&a.provenance.attribution!==null,'Verified commercial rights and attribution evidence required');
 if(a.provenance.origin==='adaptation')check('modification',a.provenance.modification===true,'Adaptation requires modification permission');
 check('compatibility',a.renderable,'Format has no supported deterministic renderer');
 check('resolution',a.format==='svg'||Math.min(a.width,a.height)>=(options.targetPixels??128),'Raster short edge must meet intended display pixels; SVG is scalable');
 if(options.transparent)check('transparency',a.transparent===true,'Transparent cutout required');
 if(a.metrics){check('visible-content',a.metrics.coverage>.005,'Visible pixels must cover more than 0.5% of preview');check('detail',a.metrics.edgeDensity<.45,'Dense edge detail may be unreadable on mobile',false);}
 else warnings.push('Pixel metrics unavailable; inspect mobile preview');
 if(options.style)check('style',a.style===options.style.material||a.tags.includes(options.style.material),'Material/style differs from project profile',false);
 if(options.query)check('relevance',searchScore(a,options.query).score>0,'No lexical subject match; visual relevance needs review',false);
 warnings.push('Pixel metrics do not certify subject recognition, edge halos or subjective composition; inspect preview');
 return {accepted:blockers.length===0,score:Math.round(100*checks.filter(c=>c.pass).length/Math.max(1,checks.length)),checks,blockers,warnings,method:'v1 explicit checks; score is percent of passed checks, not aesthetic probability'};
}
const synonyms:Record<string,string>={smartphone:'phone',mobile:'phone',telephone:'phone',notifications:'notification',bell:'notification',growth:'increase',rising:'increase',analytics:'chart',graph:'chart'};
export function terms(text:string){return [...new Set((text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}#]+/gu)||[]).map(t=>synonyms[t]||t).filter(t=>!['a','an','the','for','with','of','and','show','me'].includes(t)))];}
export function searchScore(a:LibraryRecord,query:string,usage:string[]=[]){const q=terms(query);const fields:[[string,number],...Array<[string,number]>]=[[a.name+' '+a.tags.join(' '),3],[a.description??'',2],[a.category+' '+a.style+' '+(a.metrics?.colors||[]).join(' '),2],[usage.join(' '),1]];const reasons:string[]=[];let score=0;for(const [text,weight] of fields){const indexed=terms(text),matches=q.filter(t=>indexed.includes(t));score+=matches.length*weight;reasons.push(...matches);}return {score,reasons:[...new Set(reasons)]};}
export function searchAssets(entries:LibraryRecord[],query:string,style?:StyleDNA,usage:Record<string,string[]>={}){return entries.map(asset=>({asset,...searchScore(asset,query,usage[asset.id]),quality:assessAsset(asset,{style})})).filter(r=>r.score>0&&r.quality.accepted).sort((a,b)=>(b.score+(b.asset.style===style?.material?2:0))-(a.score+(a.asset.style===style?.material?2:0))||a.asset.id.localeCompare(b.asset.id));}
export function similarAssets(entries:LibraryRecord[],signature:number[]){if(signature.length!==64||signature.some(n=>!Number.isFinite(n)))throw new Error('Expected 64-cell local visual signature');return entries.filter(a=>a.metrics?.signature.length===64).map(asset=>({asset,distance:asset.metrics!.signature.reduce((sum,n,i)=>sum+Math.abs(n-signature[i]),0)/64,method:'8x8 luminance appearance distance; not semantic embedding'})).sort((a,b)=>a.distance-b.distance);}
