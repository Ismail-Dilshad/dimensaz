import {assessAsset,pixelMetrics,type Metrics} from './asset-intelligence.js';
import fs from 'node:fs/promises';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../renderer/browser-path.js';
import {ROOT} from './config.js';
import {download} from './asset-download.js';

export const categories=['icons','illustrations','objects-3d','shapes','backgrounds','characters','ui-elements','animations','transitions','effects'] as const;
export const provenanceSchema=z.object({
 sourceWebsite:z.string().min(1),originalUrl:z.string().url(),creator:z.string().nullable(),
 license:z.string().min(1),licenseUrl:z.string().url().nullable(),licenseEvidence:z.string(),
 commercial:z.boolean().nullable(),modification:z.boolean().nullable(),attribution:z.string().nullable(),
 verified:z.boolean(),origin:z.enum(['internet','original','adaptation']),referenceIds:z.array(z.string()).default([])
}).strict();
export const submissionSchema=z.object({referenceIdentity:z.object({styles:z.array(z.enum(['style-1','style-2','style-3','style-4','style-5','style-6','style-7'])).min(1),subject:z.string().min(1),part:z.string().min(1),material:z.string().min(1),perspective:z.string().min(1),lighting:z.string().min(1),reviewNotes:z.string().min(12)}).strict().optional(),name:z.string().min(1).max(150),category:z.enum(categories),tags:z.array(z.string().min(1)).min(1),style:z.string().min(1),description:z.string().optional(),parentAssetId:z.string().optional(),format:z.enum(['svg','png','webp','jpg','jpeg','gif','json','glb','gltf','mp4','webm','blend','aep']),provenance:provenanceSchema,
 evaluation:z.object({reviewed:z.boolean(),quality:z.number().min(0).max(1),relevance:z.number().min(0).max(1),styleConsistency:z.number().min(0).max(1),notes:z.string()})}).strict();
export const recordSchema=submissionSchema.extend({metrics:z.object({coverage:z.number(),contrast:z.number(),edgeDensity:z.number(),colors:z.array(z.string()),signature:z.array(z.number()).length(64)}).optional(),id:z.string(),path:z.string(),hash:z.string(),originalHash:z.string(),source:z.string(),license:z.string(),width:z.number(),height:z.number(),transparent:z.boolean().nullable(),downloadedAt:z.string(),preview:z.string().nullable(),renderable:z.boolean(),scan:z.string(),finalUrl:z.string().nullable()});
export type LibraryRecord=z.infer<typeof recordSchema>;
export type Submission=z.infer<typeof submissionSchema>;
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
export function libraryRecords(root=ROOT):LibraryRecord[]{
 const base=path.join(root,'assets/library');if(!existsSync(base))return [];
 const records:LibraryRecord[]=[];
 for(const category of categories){const folder=path.join(base,category);if(!existsSync(folder))continue;
  for(const entry of readdirSync(folder,{withFileTypes:true}))if(entry.isDirectory()&&!entry.name.includes('-pending-')){
   const file=path.join(folder,entry.name,'metadata.json');if(existsSync(file))records.push(recordSchema.parse(JSON.parse(readFileSync(file,'utf8'))));
  }
 }return records;
}
export function reusable(a:LibraryRecord){return assessAsset(a).accepted&&(a.provenance.origin!=='adaptation'||a.provenance.modification===true)&&a.renderable&&a.evaluation.reviewed&&a.provenance.verified&&a.provenance.commercial===true&&a.provenance.attribution!==null&&!!a.provenance.licenseEvidence;}
export function safeName(name:string){return name.normalize('NFKD').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,70)||'asset';}

// Strict subset rebuilt from a parsed XML document; rejected content never reaches an image decoder.
export async function sanitizeSvg(bytes:Buffer){
 const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
 try{const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 return await page.evaluate(source=>{
  if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('SVG entities are forbidden');
  const doc=new DOMParser().parseFromString(source,'image/svg+xml');
  if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw new Error('Invalid SVG');
  const tags=new Set('svg g path rect circle ellipse line polyline polygon defs linearGradient radialGradient stop clipPath mask title desc'.split(' '));
  const attrs=new Set('xmlns viewBox width height x y x1 x2 y1 y2 cx cy r rx ry d points fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset stroke-opacity opacity transform id offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod clip-path clipPathUnits mask maskUnits preserveAspectRatio'.split(' '));
  for(const el of Array.from(doc.querySelectorAll('*'))){
   if(!tags.has(el.localName)||el.namespaceURI!=='http://www.w3.org/2000/svg')throw new Error('Unsupported or active SVG element: '+el.localName);
   for(const attr of Array.from(el.attributes)){
    if(!attrs.has(attr.name)||/url\s*\(/i.test(attr.value)&&!/^url\(#[a-zA-Z0-9_-]+\)$/.test(attr.value)||/javascript:|data:|https?:/i.test(attr.value)&&attr.name!=='xmlns')throw new Error('Unsafe SVG attribute: '+attr.name);
   }
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
 },bytes.toString('utf8'));
 }finally{await browser.close();}
}
function validateSource(bytes:Buffer,format:string){
 if(['json','gltf'].includes(format)){
  const value:unknown=JSON.parse(bytes.toString('utf8'));
  const v=value as Record<string,unknown>;
  if(!v||typeof v!=='object'||(format==='json'?!Array.isArray(v.layers)||!v.v:!(v.asset as {version?:string})?.version))throw new Error('Not Lottie/glTF source');
  const walk=(x:unknown)=>{if(!x||typeof x!=='object')return;for(const [k,val] of Object.entries(x)){if(['uri','u','p'].includes(k)&&typeof val==='string'&&val&&!/^data:(image\/(png|jpeg|webp)|application\/octet-stream);base64,[A-Za-z0-9+/=]+$/.test(val))throw new Error('External dependency requires a reviewed self-contained conversion');if(k==='x'&&typeof val==='string')throw new Error('Lottie expressions are not allowed');walk(val);}};walk(v);return;
 }
 if(format==='glb'){if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid GLB');const len=bytes.readUInt32LE(12);if(bytes.toString('ascii',16,20)!=='JSON'||20+len>bytes.length)throw new Error('Invalid GLB JSON chunk');validateSource(bytes.subarray(20,20+len),'gltf');return;}
 if(format==='blend'&&bytes.toString('ascii',0,7)==='BLENDER')return;
 if(format==='aep'&&bytes.toString('ascii',0,4)==='RIFX')return;
 if(format==='mp4'&&bytes.toString('ascii',4,8)==='ftyp')return;
 if(format==='webm'&&bytes.subarray(0,4).toString('hex')==='1a45dfa3')return;
 throw new Error('Unsupported or mismatched source file');
}
export async function registerAsset(raw:unknown,bytes:Buffer,options:{root?:string;finalUrl?:string;scan?:(bytes:Buffer)=>Promise<string>}={}){
 const input=submissionSchema.parse(raw),root=options.root??ROOT;
 if(input.parentAssetId){const parent=libraryRecords(root).find(a=>a.id===input.parentAssetId);if(!parent)throw new Error('Variant parent not found');if(parent.provenance.modification!==true)throw new Error('Variant requires parent modification permission');}
 if(!bytes.length||bytes.length>25*1024*1024)throw new Error('Empty or oversized asset');
 const originalBytes=Buffer.from(bytes);const originalHash=digest(bytes),existing=libraryRecords(root).find(a=>a.originalHash===originalHash);
 if(existing)return {asset:existing,duplicate:true};
 const scan=options.scan?await options.scan(bytes):'unavailable; not malware-certified';
 let width=0,height=0,transparent:boolean|null=null,preview:Buffer|undefined,metrics:Metrics|undefined;
 const renderable=['svg','png','jpg','jpeg','webp'].includes(input.format);
 if(input.format==='svg')bytes=Buffer.from(await sanitizeSvg(bytes));
 if(renderable||input.format==='gif'){
  const signatures:Record<string,boolean>={png:bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a',jpg:bytes[0]===255&&bytes[1]===216,jpeg:bytes[0]===255&&bytes[1]===216,webp:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP',gif:/^GIF8[79]a/.test(bytes.toString('ascii',0,6)),svg:true};
  if(!signatures[input.format])throw new Error('File signature does not match declared format');
  const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
  try{const page=await browser.newPage();await page.route('**/*',r=>r.abort());
   const result=await page.evaluate(async ({data,mime})=>{
    const img=new Image();img.src='data:'+mime+';base64,'+data;await img.decode();
    if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>40000000)throw new Error('Image dimensions exceed limit');
    const canvas=document.createElement('canvas');const scale=Math.min(1,512/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.ceil(img.naturalWidth*scale);canvas.height=Math.ceil(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    return {width:img.naturalWidth,height:img.naturalHeight,transparent:pixels.some((v,i)=>i%4===3&&v<255),pixels:Array.from(pixels),sampleWidth:canvas.width,sampleHeight:canvas.height,png:canvas.toDataURL('image/png').split(',')[1]};
   },{data:bytes.toString('base64'),mime:input.format==='svg'?'image/svg+xml':'image/'+(input.format==='jpg'?'jpeg':input.format)});
   metrics=pixelMetrics(result.pixels,result.sampleWidth,result.sampleHeight);width=result.width;height=result.height;transparent=result.transparent;preview=Buffer.from(result.png,'base64');
  }finally{await browser.close();}
 }else validateSource(bytes,input.format);
 const hash=digest(bytes),same=libraryRecords(root).find(a=>a.hash===hash);if(same)return {asset:same,duplicate:true};
 const id='asset-'+hash;const relative=path.posix.join('assets/library',input.category,id);const target=path.join(root,relative);
 await fs.mkdir(path.dirname(target),{recursive:true});const staging=target+'-pending-'+randomUUID();await fs.mkdir(staging);
 const filename=safeName(input.name)+'.'+input.format;
 const asset=recordSchema.parse({...input,metrics,id,path:relative+'/'+filename,hash,originalHash,source:input.provenance.originalUrl,license:input.provenance.license,width,height,transparent,downloadedAt:new Date().toISOString(),preview:preview?relative+'/preview.png':null,renderable,scan,finalUrl:options.finalUrl??null});
 await fs.writeFile(path.join(staging,filename),bytes,{flag:'wx'});if(preview)await fs.writeFile(path.join(staging,'preview.png'),preview,{flag:'wx'});
 if(originalHash!==hash)await fs.writeFile(path.join(staging,'original-source.'+input.format),originalBytes,{flag:'wx'});
 if(renderable){const {checkCompatibility}=await import('./asset-compatibility.js');const result=await checkCompatibility({...asset,path:path.join(staging,filename)});if(!result.passed)throw new Error('Compositor compatibility failed: '+result.reason);}
 await fs.writeFile(path.join(staging,'metadata.json'),JSON.stringify(asset,null,2),{flag:'wx'});
 await fs.rename(staging,target);return {asset,duplicate:false};
}
export async function obtainAsset(input:unknown,url:string,authorizedHosts:string[],root=ROOT){const data=await download(url,authorizedHosts);return registerAsset(input,data.bytes,{root,finalUrl:data.finalUrl});}
export async function captureReference(input:{sourceUrl:string;creator:string|null;description:string;style:string;characteristics:string[];restrictions:string},png:Buffer,root=ROOT){
 if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.length>25*1024*1024)throw new Error('Expected bounded PNG screenshot');
 new URL(input.sourceUrl);const id='reference-'+digest(png);const base=path.join(root,'references/internet',id);await fs.mkdir(base,{recursive:true});
 await fs.writeFile(path.join(base,randomUUID()+'.json'),JSON.stringify({...input,id,capturedAt:new Date().toISOString(),usage:'internal-reference-only'},null,2),{flag:'wx'});
 if(!existsSync(path.join(base,'screenshot.png')))await fs.writeFile(path.join(base,'screenshot.png'),png,{flag:'wx'});return {id,path:base};
}






