// Realistic 3D for scene visuals, built in code and rendered on the GPU (three.js, WebGL).
//
// One shared renderer serves every 3D layer (one GPU context, one studio environment, shaders
// compiled before any frame is captured); each layer draws into its own canvas, so 3D sits in the
// designed frame like any other layer. Everything is a function of time: same frame, same pixels.
//
// Craft rules (from three.js/Khronos material semantics and the img2threejs reconstruction guides):
// physical materials with real values (glass uses transmission, painted surfaces stay dielectric,
// candy colours keep low metalness so the hue survives), a filtered studio environment for
// reflections, key/fill/rim lights, soft contact shadows, ACES tone mapping, bevelled extrusions
// so edges catch light, and smooth organic forms instead of boxes.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Layer,PieceTheme} from '../../../engine/scene-pieces-schema.js';
import type {Genome} from '../genome.js';
import {ICON} from '../icons.js';
import {readableOn} from '../kit.js';

type Model=NonNullable<Layer['model']>;
type Preset=Exclude<Model['material'],'auto'>;

// ---------- the shared GPU host ----------
let host:{r:THREE.WebGLRenderer;env:THREE.Texture;info:string}|undefined;
function gpu(){
 if(host)return host;
 const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance',premultipliedAlpha:true});
 r.setPixelRatio(1);r.setClearColor(0x000000,0);
 r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1;
 r.shadowMap.enabled=true;r.shadowMap.type=THREE.VSMShadowMap; // soft, blurrable shadows
 const pm=new THREE.PMREMGenerator(r);const env=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();
 const gl=r.getContext(),dbg=gl.getExtension('WEBGL_debug_renderer_info');
 host={r,env,info:dbg?String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)):'webgl'};
 (globalThis as {TEMPOLOOM_GL?:string}).TEMPOLOOM_GL=host.info;
 return host;
}

// ---------- deterministic helpers ----------
function rng(seed:string){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);
 return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
const outCubic=(x:number)=>1-(1-clamp(x))**3;
const outBack=(x:number,k=1.6)=>{const t=clamp(x)-1;return 1+(k+1)*t**3+k*t**2;};
const outBounce=(x:number)=>{let t=clamp(x);const n=7.5625,d=2.75;if(t<1/d)return n*t*t;if(t<2/d)return n*(t-=1.5/d)*t+.75;if(t<2.5/d)return n*(t-=2.25/d)*t+.9375;return n*(t-=2.625/d)*t+.984375;};

// ---------- materials ----------
/** Physical starting values per finish (see docs/guides/scene-pieces.md#3d). */
function material(p:Preset,base:THREE.Color,dark:boolean):THREE.MeshPhysicalMaterial{
 const c=base.clone(),m=new THREE.MeshPhysicalMaterial({color:c,envMapIntensity:dark?.85:1});
 switch(p){
  case 'glossy':Object.assign(m,{roughness:.28,clearcoat:.4,clearcoatRoughness:.12,ior:1.5});break;
  case 'matte':Object.assign(m,{roughness:.7,ior:1.5});break;
  case 'clay':Object.assign(m,{roughness:.88,sheen:.5,sheenRoughness:.8});m.sheenColor=c.clone().lerp(new THREE.Color('#ffffff'),.5);break;
  case 'ceramic':Object.assign(m,{roughness:.24,clearcoat:.75,clearcoatRoughness:.08});break;
  case 'candy':Object.assign(m,{metalness:.35,roughness:.18,clearcoat:.6,clearcoatRoughness:.1,iridescence:.25,iridescenceIOR:1.3});break; // low metalness keeps the hue
  case 'chrome':m.color=c.lerp(new THREE.Color('#e8ecf2'),.55);Object.assign(m,{metalness:1,roughness:.1});m.envMapIntensity=1.2;break;
  case 'brushed':m.color=c.lerp(new THREE.Color('#d9dde3'),.45);Object.assign(m,{metalness:1,roughness:.34,anisotropy:.8});break;
  case 'gold':m.color=new THREE.Color('#E9B860');Object.assign(m,{metalness:1,roughness:.22});break;
  case 'glass':m.color=c.lerp(new THREE.Color('#ffffff'),.75);Object.assign(m,{transmission:1,roughness:.04,thickness:.9,ior:1.5,dispersion:.25,attenuationDistance:1.6});m.attenuationColor=base.clone();m.envMapIntensity=1.3;break;
  case 'frosted':m.color=c.lerp(new THREE.Color('#ffffff'),.6);Object.assign(m,{transmission:.85,roughness:.48,thickness:1,ior:1.5});m.attenuationColor=base.clone();break;
  case 'neon':m.color=c.clone().multiplyScalar(.35);m.emissive=c.clone();m.emissiveIntensity=2.2;m.roughness=.3;break;
 }
 return m;
}
/** The finish the video's style suggests (varied per layer). */
function presetFor(g:Genome|undefined,r:()=>number):Preset{
 const pick=(a:Preset[])=>a[Math.floor(r()*a.length)]!;
 if(!g)return pick(['glossy','ceramic','candy']);
 if(g.fill==='glass')return pick(['glass','frosted','glass']);
 if(g.shadow.kind==='glow')return pick(['neon','candy','chrome']);
 if(g.shadow.kind==='inset')return 'clay';
 if(g.shadow.kind==='offset')return pick(['glossy','matte']);
 if(g.shadow.kind==='lift')return pick(['ceramic','glossy']);
 if(g.tone==='paper')return pick(['ceramic','matte','gold']);
 if(g.tone==='dark')return pick(['chrome','candy','brushed']);
 return pick(['glossy','candy','ceramic']);
}

// ---------- geometry kit (all built in code) ----------
const svg=new SVGLoader();
/** Solid 3D text from HarfBuzz-shaped glyph outlines, bevelled so edges catch the light; one
 *  mesh per glyph (face and sides as separate materials) so letters can animate one by one. */
function textGroup(pr:NonNullable<Model['prepared']>,face:THREE.Material,side:THREE.Material){
 const u=pr.upem,g=new THREE.Group(),glyphs:THREE.Mesh[]=[];
 for(const gl of pr.glyphs){if(!gl.d)continue;
  const shapes=svg.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${gl.d}"/></svg>`).paths.flatMap(p=>SVGLoader.createShapes(p));
  if(!shapes.length)continue;
  const geo=new THREE.ExtrudeGeometry(shapes,{depth:.2*u,bevelEnabled:true,bevelThickness:.035*u,bevelSize:.02*u,bevelSegments:5,curveSegments:10});
  geo.translate(gl.x,gl.y,0);geo.computeBoundingBox();const bb=geo.boundingBox!,cx=(bb.min.x+bb.max.x)/2;
  geo.translate(-cx,0,0);const m=new THREE.Mesh(geo,[face,side]);m.position.x=cx;m.castShadow=true;g.add(m);glyphs.push(m);}
 return {group:g,glyphs};
}
/** A 3D icon: each stroke of the icon becomes a rounded tube (with round caps), like a bent-neon or clay icon. */
function iconGeometry(d:string){
 const parts:THREE.BufferGeometry[]=[],r=1.05;
 for(const path of svg.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="#000"/></svg>`).paths)
  for(const sp of path.subPaths){
   const pts=sp.getPoints(10).map(p=>new THREE.Vector3(p.x-12,12-p.y,0)).filter((p,i,a)=>i===0||p.distanceTo(a[i-1]!)>1e-3);if(pts.length<2)continue;
   const closed=pts[0]!.distanceTo(pts.at(-1)!)<.05;if(closed)pts.pop();
   const curve=new THREE.CurvePath<THREE.Vector3>();for(let i=0;i<pts.length-1;i++)curve.add(new THREE.LineCurve3(pts[i]!,pts[i+1]!));if(closed)curve.add(new THREE.LineCurve3(pts.at(-1)!,pts[0]!));
   parts.push(new THREE.TubeGeometry(curve,Math.max(16,pts.length*6),r,18,false));
   if(!closed)for(const e of [pts[0]!,pts.at(-1)!]){const s=new THREE.SphereGeometry(r,18,14);s.translate(e.x,e.y,e.z);parts.push(s);}
   else for(const p of pts){const s=new THREE.SphereGeometry(r,14,10);s.translate(p.x,p.y,p.z);parts.push(s);} // smooth joints
  }
 const geo=mergeGeometries(parts.map(p=>p.toNonIndexed()));geo.computeVertexNormals();return geo;
}
/** Smooth value noise (seeded) for organic blobs. */
function noise3(seed:number){const h=(x:number,y:number,z:number)=>{const s=Math.sin(x*127.1+y*311.7+z*74.7+seed*13.3)*43758.5453;return s-Math.floor(s);};
 return (x:number,y:number,z:number)=>{const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf);
  const l=(a:number,b:number,t:number)=>a+(b-a)*t;
  return l(l(l(h(xi,yi,zi),h(xi+1,yi,zi),u),l(h(xi,yi+1,zi),h(xi+1,yi+1,zi),u),v),l(l(h(xi,yi,zi+1),h(xi+1,yi,zi+1),u),l(h(xi,yi+1,zi+1),h(xi+1,yi+1,zi+1),u),v),w)*2-1;};}
function shapeObject(kind:NonNullable<Model['shape']>,mat:THREE.Material,accent:THREE.Material,r:()=>number,icon?:string):THREE.Object3D{
 const mesh=(g:THREE.BufferGeometry,m=mat)=>{const x=new THREE.Mesh(g,m);x.castShadow=true;x.receiveShadow=true;return x;};
 switch(kind){
  case 'orb':return mesh(new THREE.SphereGeometry(1,128,96));
  case 'blob':{const g=mergeVertices(new THREE.IcosahedronGeometry(1,40).deleteAttribute('normal').deleteAttribute('uv'));const n=noise3(r()*100),p=g.attributes.position!,v=new THREE.Vector3(),amp=.16+r()*.1,f=1.2+r()*.8;
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const k=1+amp*(n(v.x*f,v.y*f,v.z*f)*.7+n(v.x*f*2.1,v.y*f*2.1,v.z*f*2.1)*.3);v.multiplyScalar(k);p.setXYZ(i,v.x,v.y,v.z);}
   g.computeVertexNormals();return mesh(g);}
  case 'gem':{const g=new THREE.IcosahedronGeometry(1,1);const m=mesh(g);(m.material as THREE.MeshPhysicalMaterial).flatShading=true;return m;}
  case 'coin':{const pts=[[0,-.16],[.86,-.16],[.95,-.12],[1,-.05],[1,.05],[.95,.12],[.86,.16],[0,.16]].map(([x,y])=>new THREE.Vector2(x,y));const g=new THREE.LatheGeometry(pts,128);g.rotateX(Math.PI/2);return mesh(g);}
  case 'ring':return mesh(new THREE.TorusGeometry(.9,.3,64,180));
  case 'capsule':{const g=new THREE.CapsuleGeometry(.5,1.1,24,64);g.rotateZ(Math.PI/2.6);return mesh(g);}
  case 'cube':return mesh(new RoundedBoxGeometry(1.5,1.5,1.5,10,.24));
  case 'knot':return mesh(new THREE.TorusKnotGeometry(.8,.28,320,48,2,3));
  case 'arrow':{const s=new THREE.Shape([[-.25,-1],[.25,-1],[.25,.15],[.6,.15],[0,1],[-.6,.15],[-.25,.15]].map(([x,y])=>new THREE.Vector2(x,y)));
   const g=new THREE.ExtrudeGeometry(s,{depth:.35,bevelEnabled:true,bevelThickness:.08,bevelSize:.06,bevelSegments:6,curveSegments:8});g.center();g.rotateZ(-Math.PI/4);return mesh(g);}
  case 'stack':{const grp=new THREE.Group();for(let k=0;k<3;k++){const c=mesh(new RoundedBoxGeometry(1.9,1.2,.14,6,.07),k===2?accent:mat);c.position.set((k-1)*.18,(k-1)*.22,(k-1)*.28);c.rotation.z=(k-1)*.08;grp.add(c);}return grp;}
  case 'badge':{const grp=new THREE.Group();const coin=shapeObject('coin',mat,accent,r);grp.add(coin);
   if(icon&&ICON[icon]){const ig=iconGeometry(ICON[icon]!);ig.scale(.05,.05,.05);ig.translate(0,0,.2);grp.add(mesh(ig,accent));}return grp;}
 }
}

// ---------- the layer ----------
export type Scene3d={el:HTMLElement;render:(t:number)=>void;length:number};
/** Builds a 3D layer of w×h CSS pixels. render(t) takes seconds since the layer started entering. */
export function scene3d(l:Layer,theme:PieceTheme&{genome?:Genome},w:number,h:number,seedText:string,entrance:{from:string;dur:number;under?:string}={from:'pop',dur:.9}):Scene3d{
 const model:Model=l.model??{kind:'shape',shape:'orb',material:'auto',camera:'orbit'};
 const dpr=Math.min(2,(globalThis as {devicePixelRatio?:number}).devicePixelRatio??1),W=Math.max(2,Math.round(w*dpr)),H=Math.max(2,Math.round(h*dpr));
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;canvas.style.cssText='width:100%;height:100%;display:block';
 const ctx=canvas.getContext('2d')!;
 const G=gpu(),r=rng(seedText+JSON.stringify(model.text??model.icon??model.shape)),g=theme.genome,dark=g?.tone==='dark'||(theme.background&&new THREE.Color(theme.background).getHSL({h:0,s:0,l:0}).l<.25);
 // Thin forms (letters, icon strokes) lose their outline through glass or a mirror finish, so
 // the style's choice becomes a solid finish of the same family for them; shapes keep it.
 const thin=model.kind!=='shape',chosen:Preset=model.material==='auto'?presetFor(g,r):model.material;
 const preset:Preset=thin&&model.material==='auto'?({glass:'candy',frosted:'ceramic',chrome:'brushed'} as Partial<Record<Preset,Preset>>)[chosen]??chosen:chosen;
 // Colour: the layer's own, else the theme's; text stays readable against the frame.
 const pick=(ref:string|undefined,fallback:string)=>ref&&ref.startsWith('#')?ref:({primary:theme.primary,accent:theme.accent,text:theme.text,muted:theme.muted,surface:theme.surface,background:theme.background,white:'#ffffff',black:'#000000'} as Record<string,string>)[ref??'']??fallback;
 let main=pick(l.fill??l.color,theme.primary);if(thin)main=readableOn(main,entrance.under??theme.background,3);
 const baseColor=new THREE.Color(main),accentColor=new THREE.Color(pick(l.color&&l.fill?l.color:undefined,theme.accent));
 const mat=material(preset,baseColor,!!dark),side=material(preset==='glass'||preset==='frosted'?preset:preset==='neon'?'glossy':preset,baseColor.clone().lerp(new THREE.Color('#000000'),.28),!!dark);
 const acc=material(preset==='glass'||preset==='frosted'?'glossy':preset,accentColor,!!dark);
 // Scene.
 const scene=new THREE.Scene();scene.environment=G.env;scene.environmentIntensity=dark?.8:1;
 const pivot=new THREE.Group();scene.add(pivot);
 let glyphs:THREE.Mesh[]=[];let object:THREE.Object3D;
 if(model.kind==='text'&&model.prepared?.glyphs.length){const t=textGroup(model.prepared,mat,side);object=t.group;glyphs=t.glyphs;}
 else if(model.kind==='icon'&&model.icon&&ICON[model.icon]){const m=new THREE.Mesh(iconGeometry(ICON[model.icon]!),mat);m.castShadow=true;object=m;}
 else object=shapeObject(model.shape??'orb',mat,acc,r,model.icon);
 // Frame it: centre, fit to about 1.7 units, sit on the floor.
 const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
 const k=1.7/Math.max(size.x,size.y,size.z,1e-6);object.position.sub(centre.multiplyScalar(k));object.scale.setScalar(k);
 for(const gm of glyphs){gm.userData.x=gm.position.x;}
 pivot.add(object);const half=size.y*k/2;
 // Lights: warm key with a soft shadow, cool fill, bright rim to separate it from the frame.
 const key=new THREE.DirectionalLight('#fff1e0',dark?1.6:2.3);key.position.set(2.5,4.5,4);key.castShadow=true;
 key.shadow.mapSize.set(1024,1024);key.shadow.radius=9;key.shadow.blurSamples=16;key.shadow.bias=-.0004;
 const sc=key.shadow.camera as THREE.OrthographicCamera;sc.left=sc.bottom=-2.2;sc.right=sc.top=2.2;sc.near=.5;sc.far=14;
 const fill=new THREE.DirectionalLight('#dbe6ff',dark?.35:.55);fill.position.set(-4,1.5,2.5);
 const rim=new THREE.DirectionalLight('#ffffff',dark?2:1.2);rim.position.set(-1,3,-5);
 scene.add(key,fill,rim);
 // Soft contact shadow on an invisible floor.
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({opacity:dark?.32:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-half-.04;floor.receiveShadow=true;scene.add(floor);
 const aoTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d')!;const gr=x.createRadialGradient(64,64,4,64,64,62);gr.addColorStop(0,'rgba(0,0,0,0.55)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();
 const ao=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.1),new THREE.MeshBasicMaterial({map:aoTex,transparent:true,depthWrite:false,opacity:dark?.6:.45}));ao.rotation.x=-Math.PI/2;ao.position.y=-half-.035;scene.add(ao);
 // Camera: a product lens, framing the object with room for its motion.
 const cam=new THREE.PerspectiveCamera(30,w/h,.1,60);
 // Fit width and height separately (wide words, tall icons), with room for the turn and the motion.
 const tv=Math.tan(THREE.MathUtils.degToRad(15)),across=Math.max(size.x,size.z*.6)*k,tall=size.y*k;
 const fitDist=Math.max((tall/2)/tv,(across/2)/(tv*w/h))*1.22+Math.max(size.z*k,.3)/2;
 const az0=(r()-.5)*.5,glow=preset==='neon'||g?.shadow.kind==='glow';
 if(glow)canvas.style.filter=`drop-shadow(0 0 ${Math.round(Math.min(w,h)*.04)}px ${'#'+baseColor.getHexString()}aa)`;
 G.r.compile(scene,cam); // shaders ready before the first captured frame
 const entranceDur=Math.max(.45,entrance.dur),rtl=/\p{Script=Arabic}/u.test(model.text??''); // letters rise in reading order
 const render=(t:number)=>{
  // Entrance (from the layer's own entrance), then a living hold.
  const e=t/entranceDur;
  pivot.position.set(0,0,0);pivot.rotation.set(0,0,0);pivot.scale.setScalar(1);
  if(glyphs.length){glyphs.forEach((gm,i)=>{const q=clamp((t-(rtl?glyphs.length-1-i:i)*.06)/entranceDur);gm.position.y=(1-outBack(q))*-.9;gm.rotation.x=(1-outCubic(q))*-1.2;gm.scale.setScalar(Math.max(.001,outCubic(q)));gm.position.x=gm.userData.x as number;});}
  else switch(entrance.from){
   case 'spin':pivot.rotation.y=(1-outCubic(e))*-Math.PI*1.4;pivot.scale.setScalar(Math.max(.001,outBack(e)));break;
   case 'down':pivot.position.y=(1-outBounce(e))*2.2;break;
   case 'up':pivot.position.y=(1-outBack(e))*-1.6;pivot.scale.setScalar(Math.max(.001,outCubic(e)));break;
   case 'fade':case 'none':pivot.scale.setScalar(.92+.08*outCubic(e));break;
   default:pivot.scale.setScalar(Math.max(.001,outBack(e,2)));pivot.rotation.y=(1-outCubic(e))*-.8;
  }
  const hold=Math.max(0,t-entranceDur);
  pivot.rotation.y+=Math.sin(hold*.7)*.18+(model.camera==='float'?0:hold*.12);
  pivot.position.y+=Math.sin(hold*1.6)*.05;
  // Camera move.
  let az=az0,el=.18,dist=fitDist;
  switch(model.camera){
   case 'orbit':az+=-.35+.7*smooth(t/6);break;
   case 'push':dist*=1.12-.14*smooth(t/5);break;
   case 'reveal':el=-.05+.3*smooth(t/3);dist*=1.18-.18*smooth(t/3);break;
   case 'float':el=.12+Math.sin(t*.8)*.04;break;
  }
  cam.position.set(Math.sin(az)*Math.cos(el)*dist,Math.sin(el)*dist+.1,Math.cos(az)*Math.cos(el)*dist);cam.lookAt(0,0,0);
  // Draw on the shared GPU renderer, then into this layer's canvas.
  if(G.r.domElement.width!==W||G.r.domElement.height!==H)G.r.setSize(W,H,false);
  G.r.render(scene,cam);ctx.clearRect(0,0,W,H);ctx.drawImage(G.r.domElement,0,0,W,H);
 };
 render(0);
 return {el:canvas,render,length:entranceDur+.4};
}
