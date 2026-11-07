// Renders a glTF/GLB 3D model to transparent PNG views (and an optional turntable video) with
// three.js inside Chromium. The model is framed automatically and lit with a neutral studio
// light. Offline: only the model file and files in its folder load.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {z} from 'zod';
import {chromiumExecutable} from './browser-path.js';
import {ffmpeg} from './ffmpeg-encoder.js';

const require=createRequire(import.meta.url);
let bundle:Promise<string>|null=null;
/** three.js plus its glTF loader as one browser script, built once per process with esbuild. */
function threeBundle(){
 bundle??=(async()=>{
  const {build}=await import('esbuild');
  const three=path.resolve(path.dirname(require.resolve('three')),'..');
  const result=await build({stdin:{contents:`import * as THREE from 'three';import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';window.THREE=THREE;window.GLTFLoader=GLTFLoader;`,
   resolveDir:three,loader:'js'},bundle:true,format:'iife',minify:true,write:false,logLevel:'silent',nodePaths:[path.dirname(three)]});
  return result.outputFiles[0]!.text;
 })();
 return bundle;
}

export const views=['front','three-quarter','side','back','top'] as const;
export const render3dSchema=z.object({
 size:z.number().int().min(64).max(4096).default(1024),
 views:z.array(z.enum(views)).min(1).default(['front','three-quarter','side']),
 turntable:z.number().min(0).max(30).default(0),
 fps:z.number().int().min(1).max(60).default(30),
 background:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
 color:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
 elevation:z.number().min(-80).max(80).default(15),
 outDir:z.string().optional(),
}).strict();
export type Render3dOptions=z.input<typeof render3dSchema>;
const azimuth:Record<typeof views[number],number>={front:0,'three-quarter':35,side:90,back:180,top:0};

export async function render3d(file:string,raw:Render3dOptions={}){
 const o=render3dSchema.parse(raw);
 const source=path.resolve(file),folder=path.dirname(source),ext=path.extname(source).toLowerCase();
 if(!['.glb','.gltf'].includes(ext))throw new Error('Use a .glb or .gltf model (Poly Haven models download as glTF).');
 const stem=path.basename(source,ext);
 const out=path.resolve(o.outDir??path.join(folder,'renders'));
 await fs.mkdir(out,{recursive:true});
 const free=async(name:string)=>{const e=path.extname(name),s=name.slice(0,-e.length);for(let i=1;;i++){const f=path.join(out,i===1?name:`${s}-${i}${e}`);try{await fs.access(f);}catch{return f;}}};
 const size=o.size,transparent=!o.background;
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:${transparent?'transparent':o.background}}</style></head>
<body><script src="http://model.local/three.js"></script><script>
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(${size},${size});renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff,0x8a8a8a,1.6));
const key=new THREE.DirectionalLight(0xffffff,2.4);key.position.set(3,5,4);scene.add(key);
const rim=new THREE.DirectionalLight(0xffffff,1.2);rim.position.set(-4,3,-3);scene.add(rim);
const camera=new THREE.PerspectiveCamera(30,1,0.01,1000);
let center=new THREE.Vector3(),radius=1;
window.ready=new Promise((resolve,reject)=>{
 new GLTFLoader().load('http://model.local/files/${encodeURIComponent(path.basename(source))}',gltf=>{
  const model=gltf.scene;${o.color?`model.traverse(m=>{if(m.isMesh)m.material=new THREE.MeshStandardMaterial({color:'${o.color}',roughness:.5,metalness:.1});});`:''}
  scene.add(model);model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);if(box.isEmpty())return reject(new Error('The model has no visible geometry'));
  const sphere=box.getBoundingSphere(new THREE.Sphere());center=sphere.center;radius=sphere.radius||1;
  let meshes=0,triangles=0;model.traverse(m=>{if(m.isMesh){meshes++;const g=m.geometry;triangles+=(g.index?g.index.count:g.attributes.position.count)/3;}});
  const s=box.getSize(new THREE.Vector3());
  resolve({meshes,triangles:Math.round(triangles),size:[s.x,s.y,s.z].map(v=>+v.toFixed(4)),animations:gltf.animations.length});
 },undefined,e=>reject(new Error('Model failed to load: '+(e&&e.message||e))));
 setTimeout(()=>reject(new Error('Model did not load within 60 s')),60000);
});
window.shot=(az,el)=>{
 const d=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.08;
 const a=THREE.MathUtils.degToRad(az),e=THREE.MathUtils.degToRad(el);
 camera.position.set(center.x+d*Math.cos(e)*Math.sin(a),center.y+d*Math.sin(e),center.z+d*Math.cos(e)*Math.cos(a));
 camera.near=d/100;camera.far=d*10;camera.updateProjectionMatrix();camera.lookAt(center);renderer.render(scene,camera);
};
</script></body></html>`;
 const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable(),
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-background-networking','--disable-component-update']});
 try{
  const page=await (await browser.newContext({viewport:{width:size,height:size},deviceScaleFactor:1,offline:true})).newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='model.local')return route.abort('blockedbyclient');
   try{
    if(url.pathname==='/three.js')return route.fulfill({contentType:'application/javascript',body:await threeBundle()});
    if(url.pathname.startsWith('/files/')){
     const target=path.resolve(folder,decodeURIComponent(url.pathname.slice(7)));
     const rel=path.relative(folder,target);
     if(rel.startsWith('..')||path.isAbsolute(rel))return route.fulfill({status:403,body:'Outside the model folder'});
     return route.fulfill({body:await fs.readFile(target)});
    }
    return route.fulfill({status:404,body:'Not found'});
   }catch(e){errors.push(String(e));return route.fulfill({status:404,body:'Missing file'});}
  });
  await page.setContent(html,{waitUntil:'load'});
  if(errors.length)throw new Error('3D render errors: '+errors.join('; '));
  const stats=await page.evaluate(()=>(window as unknown as {ready:Promise<unknown>}).ready) as {meshes:number;triangles:number;size:number[];animations:number};
  const shot=async(az:number,el:number)=>{await page.evaluate(([a,e])=>(window as unknown as {shot:(a:number,e:number)=>void}).shot(a!,e!),[az,el]);
   return page.screenshot({type:'png',omitBackground:transparent,clip:{x:0,y:0,width:size,height:size}});};
  const images:{view:string;file:string}[]=[];
  for(const v of o.views){const file=await free(`${stem}-${v}.png`);await fs.writeFile(file,await shot(azimuth[v],v==='top'?75:o.elevation),{flag:'wx'});images.push({view:v,file});}
  let turntable:string|null=null;
  if(o.turntable>0){
   turntable=await free(`${stem}-turntable.${transparent?'mov':'mp4'}`);
   const args=['-hide_banner','-loglevel','error','-n','-f','image2pipe','-framerate',String(o.fps),'-c:v','png','-i','-',
    ...(transparent?['-c:v','prores_ks','-profile:v','4','-pix_fmt','yuva444p10le','-vendor','apl0']:['-c:v','libx264','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart']),turntable];
   const enc=spawn(ffmpeg,args,{windowsHide:true,stdio:['pipe','ignore','pipe']});let err='';enc.stderr.on('data',d=>err=(err+d).slice(-3000));
   const closed=new Promise<number>((res,rej)=>{enc.once('error',rej);enc.once('close',c=>res(c??1));});
   const count=Math.round(o.turntable*o.fps);
   for(let i=0;i<count;i++){const png=await shot(i/count*360,o.elevation);if(!enc.stdin.write(png))await new Promise(r=>enc.stdin.once('drain',r));}
   enc.stdin.end();if(await closed!==0)throw new Error('FFmpeg failed on the turntable: '+err);
  }
  if(errors.length)throw new Error('3D render errors: '+errors.join('; '));
  return {input:source,transparent,imageSize:size,meshes:stats.meshes,triangles:stats.triangles,modelSize:stats.size,animations:stats.animations,images,turntable};
 }finally{await browser.close();}
}
