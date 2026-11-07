import {it,expect,beforeEach} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {classifyLicense,store,type SourceItem} from '../src/engine/sourcing/core.js';
import {polyhaven,openverse,iconify,pexels,pixabay,freesound,providers,defaultProviders} from '../src/engine/sourcing/providers.js';
import {kinds} from '../src/engine/sourcing/core.js';
import {render3d} from '../src/renderer/model3d.js';

type Routes=Record<string,unknown>;
const calls:string[]=[];
const mock=(routes:Routes):typeof fetch=>(async(input:string|URL|Request,init?:RequestInit)=>{
 const url=String(input);calls.push(url+' '+JSON.stringify(init?.headers??{}));
 const key=Object.keys(routes).find(k=>url.startsWith(k));
 if(!key)return new Response('missing '+url,{status:404});
 const body=routes[key];
 return typeof body==='string'||body instanceof Uint8Array?new Response(body as BodyInit,{status:200}):new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
}) as typeof fetch;
beforeEach(()=>{calls.length=0;});

it('classifies licenses: final, study and blocked',()=>{
 const u=(s:string|null,url:string|null=null)=>classifyLicense(s,url).usage;
 expect(u('CC0')).toBe('final');expect(u('pdm')).toBe('final');expect(u(null,'https://creativecommons.org/publicdomain/zero/1.0/')).toBe('final');
 expect(u('Pexels')).toBe('final');expect(u('Pixabay')).toBe('final');
 expect(classifyLicense('cc-by').attributionRequired).toBe(true);expect(u('CC-BY-4.0')).toBe('final');expect(u(null,'https://creativecommons.org/licenses/by/4.0/')).toBe('final');
 expect(u('cc-by-sa')).toBe('study');expect(u('CC-BY-SA-4.0')).toBe('study');expect(u('GPL-3.0')).toBe('study');
 expect(u('cc-by-nc')).toBe('blocked');expect(u(null,'https://creativecommons.org/licenses/by-nc/4.0/')).toBe('blocked');expect(u('cc-by-nd')).toBe('blocked');
 expect(u('MIT')).toBe('final');expect(u('Apache-2.0')).toBe('final');expect(u('OFL-1.1')).toBe('final');expect(u('Unlicense')).toBe('final');
 expect(u('Admit One Custom')).toBe('blocked');expect(u('')).toBe('blocked');expect(u('Commercial')).toBe('blocked');
});

it('has a default provider for every kind',()=>{
 for(const k of kinds){expect(defaultProviders[k].length).toBeGreaterThan(0);for(const id of defaultProviders[k])expect(providers.find(p=>p.id===id)!.kinds).toContain(k);}
});

it('searches and resolves Poly Haven models with their texture files',async()=>{
 const fetcher=mock({
  'https://api.polyhaven.com/assets?t=models':{wooden_chair:{name:'Wooden Chair',tags:['chair','wood'],categories:['furniture'],authors:{'Jane Doe':'All'},download_count:5},
   lamp:{name:'Lamp',tags:['light'],categories:[],authors:{},download_count:9}},
  'https://api.polyhaven.com/files/wooden_chair':{gltf:{'1k':{gltf:{url:'https://dl.polyhaven.org/chair_1k.gltf',size:10,md5:'x',include:{'textures/diff.jpg':{url:'https://dl.polyhaven.org/diff.jpg',size:4}}}}}},
 });
 const [hit,...more]=await polyhaven.search({query:'chair',kind:'model',fetcher});
 expect(more).toHaveLength(0);
 expect(hit).toMatchObject({provider:'polyhaven',id:'wooden_chair',creator:'Jane Doe',license:{usage:'final',attributionRequired:false},credit:expect.stringContaining('Poly Haven')});
 expect(calls[0]).toContain('Dimensaz/');
 const full=await polyhaven.resolve!(hit!,{fetcher});
 expect(full.files).toEqual([{url:'https://dl.polyhaven.org/chair_1k.gltf',path:'chair_1k.gltf',size:10,md5:'x'},{url:'https://dl.polyhaven.org/diff.jpg',path:'textures/diff.jpg',size:4,md5:undefined}]);
});

it('maps Openverse and Iconify licenses',async()=>{
 const ov=await openverse.search({query:'mountain',kind:'image',fetcher:mock({'https://api.openverse.org/v1/images/':{results:[
  {id:'a',title:'Peak',url:'https://x/a.jpg',foreign_landing_url:'https://flickr/a',creator:'Ann',license:'by',license_url:'https://creativecommons.org/licenses/by/2.0/',tags:[{name:'snow'}]},
  {id:'b',title:'Lake',url:'https://x/b.jpg',license:'by-sa',license_url:'https://creativecommons.org/licenses/by-sa/2.0/'},
  {id:'c',title:'Sky',url:'https://x/c.jpg',license:'cc0'}]}})});
 expect(ov.map(i=>[i.id,i.license.usage,i.license.attributionRequired])).toEqual([['a','final',true],['b','study',true],['c','final',false]]);
 expect(ov[0]!.attribution).toContain('by Ann');
 expect(calls[0]).toContain('license_type=commercial%2Cmodification');
 const ic=await iconify.search({query:'rocket',kind:'icon',limit:2,fetcher:mock({'https://api.iconify.design/search':{icons:['mdi:rocket','foo:rocket','gpl:rocket'],
  collections:{mdi:{name:'Material Design Icons',license:{title:'Apache 2.0',spdx:'Apache-2.0'}},foo:{name:'Foo',license:{title:'CC BY-NC 4.0',spdx:'CC-BY-NC-4.0'}}}}})});
 expect(ic.map(i=>[i.id,i.license.usage])).toEqual([['mdi:rocket','final'],['foo:rocket','blocked']]);
 expect(ic[0]!.files[0]).toEqual({url:'https://api.iconify.design/mdi/rocket.svg',path:'mdi-rocket.svg'});
});

it('uses API keys for Pexels, Pixabay and Freesound and explains a missing key',async()=>{
 const keep={...process.env};
 try{
  delete process.env.PEXELS_API_KEY;
  await expect(pexels.search({query:'city',kind:'video',fetcher:mock({})})).rejects.toThrow(/PEXELS_API_KEY.*pexels.com\/api/);
  process.env.PEXELS_API_KEY='pk';process.env.PIXABAY_API_KEY='xk';process.env.FREESOUND_API_KEY='fk';
  const px=await pexels.search({query:'city',kind:'video',fetcher:mock({'https://api.pexels.com/videos/search':{videos:[{id:7,url:'https://pexels.com/v/7',image:'p.jpg',duration:9,user:{name:'Bo',url:'u'},
   video_files:[{link:'https://v/4k.mp4',file_type:'video/mp4',width:3840,height:2160},{link:'https://v/hd.mp4',file_type:'video/mp4',width:1920,height:1080},{link:'https://v/sd.mp4',file_type:'video/mp4',width:640,height:360}]}]}})});
  expect(px[0]).toMatchObject({id:'7',files:[{url:'https://v/hd.mp4',path:'pexels-7.mp4'}],width:1920,license:{usage:'final'}});
  expect(calls.at(-1)).toContain('"Authorization":"pk"');
  const pb=await pixabay.search({query:'flower',kind:'image',fetcher:mock({'https://pixabay.com/api/':{hits:[{id:3,pageURL:'https://pixabay.com/3',tags:'flower, red',largeImageURL:'https://cdn/3.png',user:'Cy',user_id:9,imageWidth:10,imageHeight:20}]}})});
  expect(pb[0]).toMatchObject({id:'3',files:[{url:'https://cdn/3.png',path:'pixabay-3.png'}],license:{usage:'final'}});
  expect(calls.at(-1)).toContain('key=xk');
  const fs_=await freesound.search({query:'whoosh',kind:'sound',fetcher:mock({'https://freesound.org/apiv2/search/text/':{results:[
   {id:1,name:'Whoosh',url:'https://freesound.org/s/1/',username:'dee',license:'https://creativecommons.org/licenses/by/4.0/',duration:1.2,previews:{'preview-hq-mp3':'https://cdn/1.mp3'}},
   {id:2,name:'Zap',url:'https://freesound.org/s/2/',username:'e',license:'http://creativecommons.org/publicdomain/zero/1.0/',previews:{'preview-hq-mp3':'https://cdn/2.mp3'}}]}})});
  expect(fs_.map(s=>[s.id,s.license.usage,s.license.attributionRequired])).toEqual([['1','final',true],['2','final',false]]);
  expect(decodeURIComponent(calls.at(-1)!.replace(/\+/g,"%20"))).toContain('license:("Creative Commons 0" OR "Attribution")');
 }finally{process.env={...keep};}
});

it('stores files with a license record, reuses them, and refuses blocked or unsafe items',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'dz-source-'));
 const item:SourceItem={provider:'polyhaven',id:'wooden_chair',kind:'model',title:'Wooden Chair',page:'https://polyhaven.com/a/wooden_chair',preview:null,creator:'Jane',creatorUrl:null,
  license:classifyLicense('CC0'),files:[{url:'https://dl/chair.gltf',path:'chair.gltf'},{url:'https://dl/diff.jpg',path:'textures/diff.jpg'}],attribution:'x',credit:'Powered by Poly Haven'};
 const fetcher=mock({'https://dl/chair.gltf':'{"asset":{}}','https://dl/diff.jpg':'jpg'});
 const first=await store(item,{fetcher,root});
 expect(first.cached).toBe(false);
 expect(await fs.readFile(path.join(root,'model/polyhaven-wooden_chair/textures/diff.jpg'),'utf8')).toBe('jpg');
 const record=JSON.parse(await fs.readFile(path.join(root,'model/polyhaven-wooden_chair/source.json'),'utf8'));
 expect(record).toMatchObject({provider:'polyhaven',license:{usage:'final'},credit:'Powered by Poly Haven',usage:'May be used in final videos'});
 expect(record.files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
 expect((await store(item,{fetcher,root})).cached).toBe(true);
 await expect(store({...item,id:'nc',license:classifyLicense('cc-by-nc')},{fetcher,root})).rejects.toThrow(/Not downloaded/);
 await expect(store({...item,id:'evil',files:[{url:'https://dl/diff.jpg',path:'../../escape.jpg'}]},{fetcher,root})).rejects.toThrow(/Unsafe/);
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders a glTF model to transparent views',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dz-3d-'));
 const p=new Float32Array([-1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,1,1]);
 const i=new Uint16Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,2,3,7,2,7,6,1,2,6,1,6,5,0,4,7,0,7,3]);
 const buf=Buffer.concat([Buffer.from(p.buffer),Buffer.from(i.buffer)]);
 await fs.writeFile(path.join(dir,'cube.bin'),buf);
 await fs.writeFile(path.join(dir,'cube.gltf'),JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],
  buffers:[{uri:'cube.bin',byteLength:buf.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:96},{buffer:0,byteOffset:96,byteLength:72}],
  accessors:[{bufferView:0,componentType:5126,count:8,type:'VEC3',min:[-1,-1,-1],max:[1,1,1]},{bufferView:1,componentType:5123,count:36,type:'SCALAR'}]}));
 const r=await render3d(path.join(dir,'cube.gltf'),{size:256,views:['front','three-quarter']});
 expect(r).toMatchObject({meshes:1,triangles:12,transparent:true});
 const png=await fs.readFile(r.images[1]!.file);
 expect(png[25]).toBe(6); // RGBA
 expect(png.length).toBeGreaterThan(1500);
 await expect(render3d(path.join(dir,'cube.bin'))).rejects.toThrow(/glb or .gltf/);
},60000);
