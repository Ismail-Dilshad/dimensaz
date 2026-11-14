// Maps and routes from place names: the land and borders around the places (Natural Earth, public
// domain, through world-atlas), each place marked and named in the words you gave, and the route
// between them drawn as it is travelled, a marker riding along it. The framing fits the places.
import {createRequire} from 'node:module';
import {feature} from 'topojson-client';
import {findPlace,type Place} from './places.js';
import {renderHtmlClip,fontFaces,esc,SHAPES,type Shape} from '../../renderer/html-clip.js';
import {brandProfile} from '../brand.js';

const require=createRequire(import.meta.url);
type Geo={type:string;coordinates:unknown};type Topo=Parameters<typeof feature>[0];
export type MapOptions={seconds?:number;shape?:Shape;theme?:'light'|'dark';route?:boolean;out:string;draft?:boolean;fetcher?:typeof fetch;accent?:string};
const merc=(lon:number,lat:number)=>({x:lon,y:-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*Math.PI/360))*180/Math.PI});

/** The view: the places' box in map units, padded and stretched to the frame's shape. */
export function viewFor(places:{lat:number;lon:number}[],W:number,H:number){
 const pts=places.map(p=>merc(p.lon,p.lat)),xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
 let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 const span=Math.max(x1-x0,y1-y0,3),cx=(x0+x1)/2,cy=(y0+y1)/2,pad=span*.45;
 let w=Math.max(x1-x0,span*.5)+2*pad,h=Math.max(y1-y0,span*.5)+2*pad;
 if(w/h>W/H)h=w*H/W;else w=h*W/H;
 x0=cx-w/2;x1=cx+w/2;y0=cy-h/2;y1=cy+h/2;
 return {x0,y0,w,h,scale:W/w,project:(lon:number,lat:number)=>{const m=merc(lon,lat);return {x:(m.x-x0)*W/w,y:(m.y-y0)*H/h};}};
}
/** The land and borders inside the view, as SVG path data. Finer coastlines when the view is small. */
export function landPaths(view:ReturnType<typeof viewFor>,W:number,H:number){
 const fine=view.w<30,topo=require(fine?'world-atlas/countries-50m.json':'world-atlas/countries-110m.json') as Topo&{objects:Record<string,unknown>};
 const fc=feature(topo,topo.objects.countries as never) as unknown as {features:{geometry:Geo|null;properties:{name?:string}}[]};
 const out:string[]=[];
 for(const f of fc.features){if(!f.geometry)continue;
  const polys=(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[]) as number[][][][];
  let d='';
  for(const poly of polys)for(const ring of poly){
   const pts=ring.map(([lon,lat])=>view.project(lon!,lat!));
   if(pts.every(p=>p.x<-W*.2)||pts.every(p=>p.x>W*1.2)||pts.every(p=>p.y<-H*.2)||pts.every(p=>p.y>H*1.2))continue;
   // A ring that wraps the date line would draw a band across the map: skip its jumps.
   d+='M'+pts.map((p,i)=>(i&&Math.abs(p.x-pts[i-1]!.x)>W*1.5?'M':'')+p.x.toFixed(1)+','+p.y.toFixed(1)).join('L').replace(/LM/g,'M')+'Z';
  }
  if(d)out.push(d);
 }
 return out;
}

export async function mapMotion(names:string[],o:MapOptions){
 if(!names.length)throw new Error('Name at least one place');if(names.length>12)throw new Error('At most 12 places');
 const places:Place[]=[];for(const n of names)places.push(await findPlace(n,{...(o.fetcher?{fetcher:o.fetcher}:{})}));
 const shape=o.shape??'9:16',[W,H]=SHAPES[shape],seconds=Math.max(3,Math.min(30,o.seconds??(4+2*places.length))),dark=o.theme==='dark';
 const view=viewFor(places,W,H),land=landPaths(view,W,H),pts=places.map(p=>view.project(p.lon,p.lat));
 const accent=o.accent??(await brandProfile().then(b=>b.colors?.accent).catch(()=>undefined))??'#FF6B4A';
 const f=await fontFaces(places.map(p=>p.name).join(' '));
 const route=o.route!==false&&places.length>1;
 // Each leg bends a little to one side, the next to the other, like a flight path.
 const legs=route?pts.slice(1).map((b,i)=>{const a=pts[i]!,mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,k=(i%2?-1:1)*.18;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)}Q${(mx-dy*k).toFixed(1)},${(my+dx*k).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;}):[];
 const C=dark?{sea:'#0e1726',land:'#1d2a3f',border:'#33476a',label:'#f2f5fb',halo:'#0e1726'}:{sea:'#dfe7ef',land:'#fbfaf6',border:'#b4bfcc',label:'#1b2230',halo:'#fbfaf6'};
 const fs=Math.round(Math.min(W,H)*.042),r=Math.round(Math.min(W,H)*.012);
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>${f.css}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${C.sea}}
svg{position:absolute;inset:0}.land{fill:${C.land};stroke:${C.border};stroke-width:${Math.max(1,W/900)};stroke-linejoin:round}
.leg{fill:none;stroke:${accent};stroke-width:${Math.max(4,W/180)};stroke-linecap:round}
.lbl{font:700 ${fs}px ${f.family};fill:${C.label};stroke:${C.halo};stroke-width:${Math.round(fs*.22)};paint-order:stroke fill;stroke-linejoin:round}
</style></head><body><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g id="cam">
${land.map(d=>`<path class="land" d="${d}"/>`).join('')}
${legs.map((d,i)=>`<path class="leg" id="leg${i}" d="${d}"/>`).join('')}
${pts.map((p,i)=>`<g class="pin" id="pin${i}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})"><circle r="${r*2.4}" fill="${accent}" opacity=".18"/><circle r="${r}" fill="${accent}" stroke="${C.halo}" stroke-width="${r*.45}"/>
 <text class="lbl" x="0" y="${-r*2.2}" text-anchor="middle" direction="${f.rtl?'rtl':'ltr'}">${esc(places[i]!.name)}</text></g>`).join('')}
${route?`<circle id="rider" r="${r*1.5}" fill="#fff" stroke="${accent}" stroke-width="${r*.6}"/>`:''}
</g></svg>
<script>
const D=${seconds},N=${places.length},L=${legs.length},ease=x=>x<0?0:x>1?1:1-Math.pow(1-x,3),io=x=>x<0?0:x>1?1:x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2,back=x=>{if(x<=0)return 0;if(x>=1)return 1;const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
const legs=[...Array(L)].map((_,i)=>document.getElementById('leg'+i)),len=legs.map(l=>l.getTotalLength());legs.forEach((l,i)=>{l.style.strokeDasharray=len[i];});
// The first place, then each leg drawn in turn (the route takes three quarters of the clip), each place as it is reached.
const start=.5,travel=Math.max(.5,D*.75-start),per=L?travel/L:0,arrive=i=>i===0?.15:start+i*per;
window.render=t=>{document.getElementById('cam').setAttribute('transform','translate(${W/2},${H/2}) scale('+(1.06-.06*io(t/D))+') translate(${-W/2},${-H/2})');
 for(let i=0;i<N;i++){const s=back((t-arrive(i))/.45),g=document.getElementById('pin'+i),p=g.getAttribute('transform').replace(/ scale\\(.*\\)/,'');g.setAttribute('transform',p+' scale('+s+')');g.style.opacity=s>0?1:0;}
 for(let i=0;i<L;i++){const u=io((t-start-i*per)/per);legs[i].style.strokeDashoffset=len[i]*(1-u);legs[i].style.opacity=u>0?1:0;}
 const rider=document.getElementById('rider');if(rider){const k=Math.min(L-1,Math.max(0,Math.floor((t-start)/per))),u=io((t-start-k*per)/per),pt=legs[k].getPointAtLength(len[k]*u);rider.setAttribute('cx',pt.x);rider.setAttribute('cy',pt.y);rider.style.opacity=t<start||t>start+travel+.6?0:1;}};
</script></body></html>`;
 const res=await renderHtmlClip({html,width:W,height:H,duration:seconds,out:o.out,...(o.draft?{draft:true}:{})});
 return {...res,places:places.map(p=>({name:p.name,lat:p.lat,lon:p.lon,from:p.source})),route,
  note:'Coastlines and borders: Natural Earth (public domain). Built-in places are approximate, for drawing a map.'};
}
