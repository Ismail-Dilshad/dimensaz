// Finds and downloads free, license-clear assets (3D models, textures, HDRIs, images, icons,
// stock video, sounds, music) and reference videos (study only), with a license record per item.
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {kinds,store,downloadsRoot,type Kind,type SourceItem} from '../engine/sourcing/core.js';
import {providers,providerFor,defaultProviders,polyhaven} from '../engine/sourcing/providers.js';
import {referenceInfo,downloadReference} from '../engine/sourcing/reference-video.js';
import {render3d,views} from '../renderer/model3d.js';
import {projectPython} from '../engine/audio-analysis.js';
import {spawnSync} from 'node:child_process';

const usage=`Usage: dimensaz source <command> [options]

  search QUERY --kind KIND [--provider ID] [--limit 8] [--orientation portrait|landscape|square] [--all]
                     Find free assets. KIND: ${kinds.join(', ')}.
                     Shows only items allowed in final videos unless --all.
  get REF... [--resolution 1k|2k|4k]
                     Download items from the last search: its number (1, 2…) or provider:id.
                     Poly Haven items also work directly: get polyhaven:ID --kind model
  render-3d FILE.glb|.gltf [--size 1024] [--views front,three-quarter,side] [--turntable SECONDS] [--fps 30]
                     [--background #RRGGBB] [--color #RRGGBB] [--out-dir DIR]
                     Transparent PNG views (and a turntable video) of a 3D model
  reference URL [--confirm] [--section START-END]
                     A reference video with yt-dlp, study only. Without --confirm shows its
                     title, length and size; with --confirm downloads it (at most 1080p).
  list [--kind KIND] Downloaded items with their license and usage
  credits [FOLDER...]
                     Attribution lines for downloaded items (all final-use items by default)
  doctor [--offline] Keys, yt-dlp, and one live test search per provider

Downloads go to workspace/downloads/<kind>/<provider>-<id>/ with a source.json license record.
Items with non-commercial, no-derivatives or unknown licenses are never downloaded.`;

const {values:v,positionals}=parseArgs({allowPositionals:true,options:{kind:{type:'string'},provider:{type:'string'},limit:{type:'string'},orientation:{type:'string'},
 all:{type:'boolean'},resolution:{type:'string'},size:{type:'string'},views:{type:'string'},turntable:{type:'string'},fps:{type:'string'},background:{type:'string'},color:{type:'string'},
 'out-dir':{type:'string'},confirm:{type:'boolean'},section:{type:'string'},offline:{type:'boolean'},help:{type:'boolean',short:'h'}}});
const [command,...rest]=positionals;
const lastSearch=()=>path.join(downloadsRoot(),'.last-search.json');
const kindOf=(k?:string):Kind=>{if(!k||!(kinds as readonly string[]).includes(k))throw new Error(`Use --kind with one of: ${kinds.join(', ')}`);return k as Kind;};

async function search(query:string){
 const kind=kindOf(v.kind),limit=Number(v.limit??8);
 const ids=v.provider?v.provider.split(','):defaultProviders[kind];
 const results:SourceItem[]=[],skipped:{provider:string;reason:string}[]=[];
 await Promise.all(ids.map(async id=>{const p=providerFor(id);
  if(!p.kinds.includes(kind))return skipped.push({provider:id,reason:`does not offer ${kind}`});
  try{results.push(...await p.search({query,kind,limit,orientation:v.orientation as never}));}catch(e){skipped.push({provider:id,reason:(e as Error).message});}}));
 const shown=v.all?results:results.filter(r=>r.license.usage==='final');
 await fs.mkdir(downloadsRoot(),{recursive:true});
 await fs.writeFile(lastSearch(),JSON.stringify({query,kind,at:new Date().toISOString(),items:shown},null,1));
 return {query,kind,found:results.length,shown:shown.length,hiddenNotFinal:results.length-shown.length,skipped,
  items:shown.map((r,i)=>({n:i+1,ref:`${r.provider}:${r.id}`,title:r.title,usage:r.license.usage,license:r.license.name,attributionRequired:r.license.attributionRequired,
   creator:r.creator,preview:r.preview,page:r.page,width:r.width,height:r.height,duration:r.duration})),
  next:'Look at the previews, then: pnpm dimensaz source get N'};
}

async function get(refs:string[]){
 if(!refs.length)throw new Error('Name what to download: a number from the last search or provider:id');
 let last:{items:SourceItem[]}={items:[]};try{last=JSON.parse(await fs.readFile(lastSearch(),'utf8'));}catch{/* none */}
 const out=[];
 for(const ref of refs){
  let it=/^\d+$/.test(ref)?last.items[Number(ref)-1]:last.items.find(i=>`${i.provider}:${i.id}`===ref);
  if(!it&&ref.startsWith('polyhaven:')){const kind=kindOf(v.kind);const found=await polyhaven.search({query:ref.slice(10),kind,limit:50});it=found.find(f=>f.id===ref.slice(10));}
  if(!it){out.push({ref,error:'Not in the last search; search again first'});continue;}
  try{
   const p=providerFor(it.provider);
   if(p.resolve&&!it.files.length)it=await p.resolve(it,{resolution:v.resolution});
   const headers:Record<string,string>={};
   const saved=await store(it,{headers});
   out.push({ref,folder:saved.folder,cached:saved.cached,files:saved.files.map((f:{name:string})=>path.join(saved.folder,f.name)),usage:saved.usage,attribution:it.license.attributionRequired?saved.attribution:null,credit:saved.credit});
  }catch(e){out.push({ref,error:(e as Error).message});}
 }
 return out;
}

async function records(){
 const root=downloadsRoot(),found:{folder:string;data:Record<string,any>}[]=[];
 const walk=async(dir:string,depth:number):Promise<void>=>{let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{return;}
  for(const e of entries){const full=path.join(dir,e.name);
   if(e.isFile()&&e.name==='source.json')found.push({folder:dir,data:JSON.parse(await fs.readFile(full,'utf8'))});
   else if(e.isDirectory()&&depth<3)await walk(full,depth+1);}};
 await walk(root,0);return found;
}

async function doctor(){
 const keys=Object.fromEntries(providers.filter(p=>p.key).map(p=>[p.key!,process.env[p.key!]?'set':`missing (free key: ${p.signup})`]));
 const yt=spawnSync(projectPython(),['-m','yt_dlp','--version'],{encoding:'utf8'});
 const tests:Record<string,string>={};
 if(!v.offline){
  const probe:[string,Kind,string][]=[['polyhaven','model','chair'],['openverse','image','mountain'],['iconify','icon','rocket'],['pexels','video','city'],['pixabay','image','flower'],['freesound','sound','whoosh']];
  await Promise.all(probe.map(async([id,kind,q])=>{const p=providerFor(id);
   if(p.key&&!process.env[p.key]){tests[id]='skipped (no key)';return;}
   try{const r=await p.search({query:q,kind,limit:3});tests[id]=r.length?`ok (${r.length} results)`:'reachable, no results';}catch(e){tests[id]='failed: '+(e as Error).message.slice(0,160);}}));
 }
 return {downloads:downloadsRoot(),keys,ytDlp:yt.status===0?'ok '+yt.stdout.trim():'missing: run pnpm media:setup',providers:v.offline?'skipped (--offline)':tests};
}

async function main(){
 if(v.help||!command||command==='help')return console.log(usage);
 let result:unknown;
 if(command==='search'){if(!rest.length)throw new Error('search needs a query');result=await search(rest.join(' '));}
 else if(command==='get')result=await get(rest);
 else if(command==='render-3d'){if(!rest[0])throw new Error('render-3d needs a .glb or .gltf file');
  result=await render3d(rest[0],{size:v.size?Number(v.size):undefined,views:v.views?v.views.split(',') as (typeof views[number])[]:undefined,turntable:v.turntable?Number(v.turntable):undefined,fps:v.fps?Number(v.fps):undefined,
   background:v.background,color:v.color,outDir:v['out-dir']});}
 else if(command==='reference'){if(!rest[0])throw new Error('reference needs a video link');
  result=v.confirm?await downloadReference(rest[0],{section:v.section}):{...await referenceInfo(rest[0]),next:'Ask the user, then add --confirm to download'};}
 else if(command==='list'){const all=await records();result=all.filter(r=>!v.kind||r.data.kind===v.kind||(v.kind==='reference'&&r.data.provider==='yt-dlp'))
  .map(r=>({folder:r.folder,provider:r.data.provider,kind:r.data.kind??'reference',title:r.data.title,usage:r.data.license?.usage,license:r.data.license?.name,files:r.data.files?.length}));}
 else if(command==='credits'){const all=await records();
  const chosen=rest.length?all.filter(r=>rest.some(f=>path.resolve(f)===r.folder)):all.filter(r=>r.data.license?.usage==='final');
  const lines=chosen.filter(r=>r.data.license?.attributionRequired||r.data.credit).map(r=>[r.data.credit,r.data.license?.attributionRequired?r.data.attribution:null].filter(Boolean).join(' — '));
  result={required:lines,text:lines.join('\n')||'No attribution needed for these items.'};}
 else if(command==='doctor')result=await doctor();
 else{console.error(usage);throw new Error('Unknown command: '+command);}
 console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
