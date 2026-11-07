// Free, license-clear sources. Each provider searches and resolves the files of one item.
// Keys come from .env; providers without a needed key say so instead of failing silently.
import {classifyLicense,attributionLine,getJson,type Kind,type SourceItem,type License} from './core.js';

export type SearchOptions={query:string;kind:Kind;limit?:number;orientation?:'portrait'|'landscape'|'square';fetcher?:typeof fetch;resolution?:string};
export type Provider={id:string;name:string;kinds:Kind[];key?:string;signup?:string;
 search:(o:SearchOptions)=>Promise<SourceItem[]>;resolve?:(item:SourceItem,o:{fetcher?:typeof fetch;resolution?:string})=>Promise<SourceItem>};

const env=(name:string)=>process.env[name]?.trim()||undefined;
function needKey(p:{key?:string;name:string;signup?:string}){
 const k=p.key&&env(p.key);if(p.key&&!k)throw new Error(`${p.name} needs ${p.key} in .env (free key: ${p.signup}).`);return k;
}
const item=(i:Omit<SourceItem,'attribution'>):SourceItem=>({...i,attribution:attributionLine(i)});
type Json=Record<string,any>; // provider JSON is validated field by field below

// ---------- Poly Haven: CC0 3D models, textures and HDRIs (no key) ----------
const POLY='https://api.polyhaven.com';
const polyType:Partial<Record<Kind,string>>={model:'models',texture:'textures',hdri:'hdris'};
export const polyhaven:Provider={id:'polyhaven',name:'Poly Haven',kinds:['model','texture','hdri'],
 async search({query,kind,limit=10,fetcher}){
  const assets=await getJson<Record<string,Json>>(`${POLY}/assets?t=${polyType[kind]}`,{fetcher});
  const words=query.toLowerCase().split(/\s+/).filter(Boolean);
  const score=(id:string,a:Json)=>{const hay=[id,a.name,...(a.tags??[]),...(a.categories??[])].join(' ').toLowerCase();return words.reduce((n,w)=>n+(hay.includes(w)?1:0),0);};
  return Object.entries(assets).map(([id,a])=>({id,a,s:score(id,a)})).filter(x=>x.s>0).sort((x,y)=>y.s-x.s||(y.a.download_count??0)-(x.a.download_count??0)).slice(0,limit)
   .map(({id,a})=>item({provider:'polyhaven',id,kind,title:a.name??id,page:`https://polyhaven.com/a/${id}`,preview:`https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=512`,
    creator:Object.keys(a.authors??{}).join(', ')||null,creatorUrl:null,license:classifyLicense('CC0'),files:[],tags:a.tags,credit:'Powered by Poly Haven (polyhaven.com)'}));
 },
 async resolve(it,{fetcher,resolution='1k'}={}){
  const files=await getJson<Json>(`${POLY}/files/${encodeURIComponent(it.id)}`,{fetcher});
  const pick=(byRes:Json)=>byRes?.[resolution]??byRes?.['1k']??byRes?.['2k']??Object.values(byRes??{})[0];
  if(it.kind==='model'){
   const g=pick(files.gltf)?.gltf;if(!g?.url)throw new Error('No glTF file for '+it.id);
   const main={url:g.url,path:g.url.split('/').pop()!,size:g.size,md5:g.md5};
   const include=Object.entries(g.include??{}).map(([p,f]:[string,any])=>({url:f.url,path:p,size:f.size,md5:f.md5}));
   return {...it,files:[main,...include]};
  }
  if(it.kind==='hdri'){const h=pick(files.hdri);const f=h?.hdr??h?.exr;if(!f?.url)throw new Error('No HDRI file for '+it.id);return {...it,files:[{url:f.url,size:f.size,md5:f.md5}]};}
  const maps=['Diffuse','nor_gl','Rough','AO','Displacement'].filter(m=>files[m]);
  const out=maps.map(m=>{const f=pick(files[m]);const v=f?.jpg??f?.png;return v?.url?{url:v.url,path:`${m.toLowerCase()}${v.url.match(/\.\w+$/)?.[0]??'.jpg'}`,size:v.size,md5:v.md5}:null}).filter(Boolean) as SourceItem['files'];
  if(!out.length)throw new Error('No texture maps for '+it.id);return {...it,files:out};
 }};

// ---------- Openverse: openly licensed images and audio (no key) ----------
const openverseLicense=(r:Json):License=>classifyLicense(r.license?(r.license.toLowerCase()==='cc0'||r.license.toLowerCase()==='pdm'?r.license:'cc-'+r.license):null,r.license_url??null);
export const openverse:Provider={id:'openverse',name:'Openverse',kinds:['image','sound','music'],
 async search({query,kind,limit=10,fetcher,orientation}){
  const audio=kind!=='image',base=`https://api.openverse.org/v1/${audio?'audio':'images'}/`;
  const params=new URLSearchParams({q:query,page_size:String(Math.min(limit,20)),license_type:'commercial,modification',mature:'false'});
  if(audio)params.set('category',kind==='music'?'music':'sound_effect');
  if(!audio&&orientation)params.set('aspect_ratio',orientation==='portrait'?'tall':orientation==='landscape'?'wide':'square');
  const data=await getJson<Json>(base+'?'+params,{fetcher});
  return (data.results??[]).filter((r:Json)=>r.url).map((r:Json)=>item({provider:'openverse',id:r.id,kind,title:r.title||r.id,page:r.foreign_landing_url??r.url,preview:r.thumbnail??null,
   creator:r.creator??null,creatorUrl:r.creator_url??null,license:openverseLicense(r),files:[{url:r.url}],width:r.width,height:r.height,duration:r.duration?r.duration/1000:undefined,tags:(r.tags??[]).map((t:Json)=>t.name).slice(0,10)}));
 }};

// ---------- Iconify: 200,000+ open-source icons (no key) ----------
export const iconify:Provider={id:'iconify',name:'Iconify',kinds:['icon'],
 async search({query,kind,limit=20,fetcher}){
  const data=await getJson<Json>(`https://api.iconify.design/search?${new URLSearchParams({query,limit:String(Math.max(32,limit))})}`,{fetcher});
  return (data.icons??[]).slice(0,limit).map((name:string)=>{const [prefix,icon]=name.split(':');const c=data.collections?.[prefix]??{};
   return item({provider:'iconify',id:name,kind,title:`${icon} (${c.name??prefix})`,page:`https://icon-sets.iconify.design/${prefix}/?icon-filter=${icon}`,preview:`https://api.iconify.design/${prefix}/${icon}.svg`,
    creator:c.author?.name??null,creatorUrl:c.author?.url??null,license:classifyLicense(c.license?.spdx??c.license?.title??null,c.license?.url??null),files:[{url:`https://api.iconify.design/${prefix}/${icon}.svg`,path:`${prefix}-${icon}.svg`}]});});
 }};

// ---------- Pexels: free stock photos and videos (PEXELS_API_KEY) ----------
export const pexels:Provider={id:'pexels',name:'Pexels',kinds:['image','video'],key:'PEXELS_API_KEY',signup:'https://www.pexels.com/api/',
 async search({query,kind,limit=10,fetcher,orientation}){
  const key=needKey(this);const video=kind==='video';
  const params=new URLSearchParams({query,per_page:String(Math.min(limit,40)),...(orientation?{orientation}:{})});
  const data=await getJson<Json>(`https://api.pexels.com/${video?'videos/search':'v1/search'}?${params}`,{fetcher,headers:{Authorization:key!}});
  const lic=classifyLicense('Pexels','https://www.pexels.com/license/');
  if(video)return (data.videos??[]).map((v:Json)=>{const files=[...(v.video_files??[])].filter((f:Json)=>f.link&&/mp4/.test(f.file_type??'mp4')).sort((a:Json,b:Json)=>(b.width*b.height)-(a.width*a.height));
   const best=files.find((f:Json)=>Math.max(f.width,f.height)<=1920)??files[0];
   return item({provider:'pexels',id:String(v.id),kind,title:`Pexels video ${v.id}`,page:v.url,preview:v.image??null,creator:v.user?.name??null,creatorUrl:v.user?.url??null,license:lic,
    files:best?[{url:best.link,path:`pexels-${v.id}.mp4`}]:[],width:best?.width,height:best?.height,duration:v.duration});}).filter((i:SourceItem)=>i.files.length);
  return (data.photos??[]).map((p:Json)=>item({provider:'pexels',id:String(p.id),kind,title:p.alt||`Pexels photo ${p.id}`,page:p.url,preview:p.src?.medium??null,creator:p.photographer??null,creatorUrl:p.photographer_url??null,
   license:lic,files:[{url:p.src?.large2x??p.src?.original,path:`pexels-${p.id}.jpg`}],width:p.width,height:p.height}));
 }};

// ---------- Pixabay: free images, illustrations, vectors and videos (PIXABAY_API_KEY) ----------
export const pixabay:Provider={id:'pixabay',name:'Pixabay',kinds:['image','video'],key:'PIXABAY_API_KEY',signup:'https://pixabay.com/api/docs/',
 async search({query,kind,limit=10,fetcher,orientation}){
  const key=needKey(this);const video=kind==='video';
  const params=new URLSearchParams({key:key!,q:query.slice(0,100),per_page:String(Math.min(Math.max(limit,3),50)),safesearch:'true',...(!video&&orientation?{orientation:orientation==='portrait'?'vertical':'horizontal'}:{})});
  const data=await getJson<Json>(`https://pixabay.com/api/${video?'videos/':''}?${params}`,{fetcher});
  const lic=classifyLicense('Pixabay','https://pixabay.com/service/license-summary/');
  return (data.hits??[]).slice(0,limit).map((h:Json)=>{
   const v=video?(h.videos?.large?.url?h.videos.large:h.videos?.medium):null;
   const url=video?v?.url:(h.largeImageURL??h.webformatURL);
   return item({provider:'pixabay',id:String(h.id),kind,title:h.tags||`Pixabay ${h.id}`,page:h.pageURL,preview:video?(h.videos?.tiny?.thumbnail??null):h.previewURL??null,creator:h.user??null,
    creatorUrl:h.user_id?`https://pixabay.com/users/${h.user}-${h.user_id}/`:null,license:lic,files:url?[{url,path:`pixabay-${h.id}${video?'.mp4':url.match(/\.\w+$/)?.[0]??'.jpg'}`}]:[],
    width:video?v?.width:h.imageWidth,height:video?v?.height:h.imageHeight,duration:h.duration});}).filter((i:SourceItem)=>i.files.length);
 }};

// ---------- Freesound: sound effects (FREESOUND_API_KEY; CC0 and CC-BY only) ----------
export const freesound:Provider={id:'freesound',name:'Freesound',kinds:['sound'],key:'FREESOUND_API_KEY',signup:'https://freesound.org/apiv2/apply/',
 async search({query,kind,limit=10,fetcher}){
  const key=needKey(this);
  const params=new URLSearchParams({query,page_size:String(Math.min(limit,30)),fields:'id,name,license,username,previews,duration,url,tags',
   filter:'license:("Creative Commons 0" OR "Attribution")',token:key!});
  const data=await getJson<Json>(`https://freesound.org/apiv2/search/text/?${params}`,{fetcher});
  return (data.results??[]).map((s:Json)=>item({provider:'freesound',id:String(s.id),kind,title:s.name,page:s.url,preview:s.previews?.['preview-hq-mp3']??null,creator:s.username??null,
   creatorUrl:s.username?`https://freesound.org/people/${s.username}/`:null,license:classifyLicense(s.license,s.license),
   files:s.previews?.['preview-hq-mp3']?[{url:s.previews['preview-hq-mp3'],path:`freesound-${s.id}.mp3`}]:[],duration:s.duration,tags:(s.tags??[]).slice(0,10)})).filter((i:SourceItem)=>i.files.length);
 }};

export const providers:Provider[]=[polyhaven,openverse,iconify,pexels,pixabay,freesound];
export const providerFor=(id:string)=>{const p=providers.find(x=>x.id===id);if(!p)throw new Error('Unknown provider: '+id+'. Use one of '+providers.map(x=>x.id).join(', '));return p;};
export const defaultProviders:Record<Kind,string[]>={model:['polyhaven'],texture:['polyhaven'],hdri:['polyhaven'],icon:['iconify'],image:['openverse','pexels','pixabay'],video:['pexels','pixabay'],sound:['freesound','openverse'],music:['openverse']};
