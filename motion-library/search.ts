import fs from 'node:fs';
import {INDEX} from './paths.js';
import {indexSchema,type ReferenceIndex,type ReferenceMatch} from './model.js';
export function loadIndex():ReferenceIndex{
 if(!fs.existsSync(INDEX))return {version:1,updatedAt:'',categories:[],records:[]};
 return indexSchema.parse(JSON.parse(fs.readFileSync(INDEX,'utf8')));
}
export function tokens(query:string){return query.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}-]+/gu)||[];}
export function search(index:ReferenceIndex,query:string,options:{category?:string;limit?:number;reviewedOnly?:boolean}={}):ReferenceMatch[]{
 const terms=tokens(query),result:ReferenceMatch[]=[];
 for(const record of index.records){
  if(!record.available||record.status==='error')continue;
  const review=record.review,meta=review||record.automatic;
  if(options.reviewedOnly&&(!review||review.confidence<.65))continue;
  if(options.category&&!meta.categories.includes(options.category as any))continue;
  const hay=[record.name,meta.description,...meta.categories,...meta.tags,...(review?.techniques.flatMap(t=>[t.name,t.evidence,...t.implementation,...t.presets,...t.assetTags,...t.roles])||[])].join(' ').toLowerCase().normalize('NFKC');
  const matched=terms.filter(t=>hay.includes(t));
  if(terms.length&&!matched.length)continue;
  const score=(terms.length?matched.length/terms.length:1)+(review?.confidence||.1)*.15;
  const technique=review?.techniques.filter(t=>t.confidence>=.65).map(t=>({t,score:terms.filter(q=>[t.name,...t.roles,...t.presets,...t.assetTags].join(' ').toLowerCase().includes(q)).length})).sort((a,b)=>b.score-a.score)[0]?.t;
  result.push({record,score,technique});
 }
 return result.sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id)).slice(0,options.limit??8);
}
