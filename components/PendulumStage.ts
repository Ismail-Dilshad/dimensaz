import type {Project} from '../engine/schema.js';

// Both headline layers use the very same two endpoints as the visible cord.
export async function pendulumStage(project:Project, root:HTMLElement){
 const {width:w,height:h,pendulum:style,reducedMotion}=project.config;
 if(!style)throw new Error('Missing pendulum style');
 const px=(n:number)=>n+'px';
 const green=style.referenceLook==='green-saas-pendulum';
 const editorial=style.referenceLook==='light-editorial-pendulum';
 const monochrome=green&&style.palette==='monochrome-blue-answers';
 const questionInk=monochrome?'#202020':editorial?'#292d34':green?'#1a3314':'#101924',replyInk=monochrome||editorial?'#2878ed':green?'#fff':'#f8fbff';
 root.style.cssText='position:relative;overflow:hidden;width:'+px(w)+';height:'+px(h)+';background:radial-gradient(ellipse at 50% 54%,'+style.center+' 0%,'+style.edge+' 85%)';
 if(editorial)root.style.background='#ecf2f5';
 if(green){
  // Clean background samples fit a nearly circular Gaussian field at source size 720x1280.
  const stops=Array.from({length:21},(_,i)=>{
   const gain=Math.exp(-((i/10)**2));
   const neutral=Math.round(218+34*gain);
   const rgb=monochrome?[neutral,neutral,neutral]:[38+89*gain,73+123*gain,25+63*gain].map(Math.round);
   return 'rgb('+rgb.join(',')+') '+i*10+'%';
  });
  root.style.background='radial-gradient(ellipse '+px(w*595/720)+' '+px(h*597/1280)+' at 49.4% 50.05%,'+stops.join(',')+')';
 }
 function block(css:string,parent=root){
  const el=document.createElement('div');el.style.cssText='position:absolute;'+css;parent.append(el);return el;
 }
 async function artwork(id:string){
  const media=project.media.find(m=>m.id===id&&m.kind==='image');
  if(!media)throw new Error('Missing imported pendulum logo image');
  const image=new Image();image.alt='';image.src='/media/'+encodeURIComponent(media.id);
  await image.decode();return image;
 }
 if(style.showTopBrand!==false && style.topImageId){
  const image=await artwork(style.topImageId);
  image.alt=style.brand;
  image.style.cssText='position:absolute;left:50%;top:11.5%;width:21%;height:auto;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 2px #071834aa)';
  if(green)Object.assign(image.style,{top:'11.91%',width:'35.8%',filter:'none'});
  if(editorial)Object.assign(image.style,{left:'52.5%',top:'29.88%',width:'17.5%',filter:'none'});
  root.append(image);
 }else if(style.showTopBrand!==false){
  const logo=block('top:9.6%;left:5%;width:90%;text-align:center;color:#c4e9ff;font:900 '+px(w*.080)+' Arial,sans-serif;letter-spacing:-.055em');
  logo.textContent=style.brand;logo.dir='ltr';
 }
 const footer=block('top:84.1%;width:100%;text-align:center;color:white;font:700 '+px(w*.035)+' VideoPrimary');
 footer.textContent=style.footer;footer.dir=project.scenes[0].direction;
 if(style.footer.length>40)Object.assign(footer.style,{left:'8%',width:'84%',textWrap:'balance',lineHeight:'1.45'});
 if(editorial){
  Object.assign(footer.style,{color:questionInk,left:'6%',width:'88%',top:'79.03%',transform:'translateY(-50%)',fontSize:px(w*.027),lineHeight:'1.1',whiteSpace:'pre',textWrap:'nowrap'});
  while(footer.scrollWidth>footer.clientWidth && parseFloat(footer.style.fontSize)>w*.019)footer.style.fontSize=px(parseFloat(footer.style.fontSize)-.5);
 }
 if(green){
  const breaks=Array.from(style.footer.matchAll(/ - /g));
  const split=breaks.length>1?breaks[1].index+2:style.footer.length;
  footer.replaceChildren();Object.assign(footer.style,{top:'84.8%',left:'8%',width:'84%',lineHeight:'1.14',fontSize:px(w*.033)});
  for(const [i,line] of [style.footer.slice(0,split),style.footer.slice(split)].entries()){
   const span=document.createElement('span');span.textContent=line;
   span.style.cssText='display:block;white-space:pre-wrap;margin-bottom:'+px(h*.006)+'px;color:'+(monochrome?(i?'#444':'#202020'):i?'#baff80':'#f4ffed');
   footer.append(span);
  }
 }
 function headline(color:string, reply=false){
  const mask=block('inset:0');
  const text=block('left:'+(reply?'24%;width:52%':'15%;width:70%')+';top:45.6%;transform:translateY(-50%);text-align:center;text-wrap:balance;line-height:1.12;font-family:VideoPrimary;font-weight:bold;color:'+color,mask);
  text.dir=project.scenes[0].direction;
  const svg=green||editorial?document.createElementNS('http://www.w3.org/2000/svg','svg'):undefined;
  if(svg){
   svg.setAttribute('viewBox','0 0 720 1280');svg.style.cssText='position:absolute;inset:0;width:100%;height:100%';
   mask.append(svg);text.style.visibility='hidden';
  }
  return {mask,text,svg};
 }
 const dark=headline(questionInk),light=headline(replyInk,true);
 const phrases=project.scenes.map(s=>s.text.trim());
 const measure=green||editorial?document.createElement('canvas').getContext('2d'):null;
 // Choose each complete phrase's size once, after the compositor loads the font.
 const sizes=phrases.map((phrase,index)=>{
  const text=index%2?light.text:dark.text;
  text.textContent=phrase;
  let size=w*.119;
  while(size>w*.058){text.style.fontSize=px(size);if(text.offsetHeight<=size*2.34&&text.scrollWidth<=text.clientWidth+1)break;size-=1;}
  return size;
 });
 function show(layer:ReturnType<typeof headline>,i:number){
  if(layer.text.dataset.index===String(i))return;
  layer.text.dataset.index=String(i);layer.text.textContent=phrases[i];layer.text.style.fontSize=px(sizes[i]);
  if(layer.svg){
   // The source headline occupies two lines. Fit the complete shaped words
   // into its measured ink bounds; crop only the parent during the cord wipe.
   const words=phrases[i].split(/\s+/);
   const cut=Math.max(1,Math.floor(words.length/2));
   const lines=[words.slice(0,cut).join(' '),words.slice(cut).join(' ')].filter(Boolean);
   const group=document.createElementNS('http://www.w3.org/2000/svg','g');
   layer.svg.replaceChildren(group);
   for(const [n,line] of lines.entries()){
    const row=document.createElementNS('http://www.w3.org/2000/svg','text');
    row.setAttribute('text-anchor','middle');row.setAttribute('direction',project.scenes[i].direction);
    row.setAttribute('y',String(n*77));row.textContent=line;
    row.style.cssText='font:900 83px VideoPrimary;fill:currentColor;stroke:currentColor;stroke-width:'+(editorial?'3.2':'1.8')+';stroke-linejoin:round;paint-order:stroke fill';
    group.append(row);
   }
   const box=group.getBBox(),index=Math.floor(i/2);
   // SVG's text bounding box includes font ascenders and descenders even
   // when no glyph touches them. Size and center the visible ink instead.
   if(measure){
    measure.font='900 83px VideoPrimary';
    measure.direction=project.scenes[i].direction;
    const metrics=lines.map(line=>measure.measureText(line));
    box.y=Math.min(...metrics.map((m,n)=>n*77-m.actualBoundingBoxAscent));
    box.height=Math.max(...metrics.map((m,n)=>n*77+m.actualBoundingBoxDescent))-box.y;
   }
   const targetWidth=editorial?(i%2?198:278):i%2?312:([452,475,452,419,416][index]??452);
   const fitX=targetWidth/Math.max(1,box.width),fitY=(lines.length===1?62:132)/Math.max(1,box.height);
   const scale=style?.headlineFit==='proportional'?String(Math.min(1,fitX,fitY)):`${fitX} ${fitY}`;
   group.setAttribute('transform',`translate(360 ${editorial?648:584}) scale(${scale}) translate(${-box.x-box.width/2} ${-box.y-box.height/2})`);
   if(editorial)layer.svg.style.filter='drop-shadow('+px(w*.010)+' '+px(w*.013)+' '+px(w*.004)+' #36414d36) drop-shadow('+px(w*.013)+' '+px(w*.014)+' '+px(w*.008)+' #36414d29)';
  }
 }
 const cord=block('top:0;height:1px;background:#101d2c;transform-origin:0 50%;box-shadow:'+px(-w*.016)+' '+px(w*.008)+' '+px(w*.009)+' #091d3b40');
 const badge=block('display:grid;place-content:center;width:'+px(w*.181)+';height:'+px(w*.181)+';border-radius:26%;background:#101d2c;color:#a4d9ff;box-shadow:'+px(-w*.015)+' '+px(w*.023)+' '+px(w*.031)+' #071b343d;text-align:center;white-space:pre-line;line-height:.98;font:900 '+px(w*.040)+'/.98 Arial,sans-serif;letter-spacing:-.04em');
 badge.textContent=style.brand.replace(/\s+(\S+)$/,'\n$1');badge.dir='ltr';
 if(green){badge.style.background='#0f2a0e';badge.style.boxShadow=px(-w*.015)+' '+px(w*.023)+' '+px(w*.031)+' #16331244';cord.style.background='#132610';cord.style.boxShadow=px(-w*.018)+' '+px(w*.009)+' '+px(w*.009)+' #15331338';}
 if(monochrome){
  badge.style.background='#202020';badge.style.boxShadow=px(-w*.015)+' '+px(w*.023)+' '+px(w*.031)+' #17171744';
  cord.style.background='#242424';cord.style.boxShadow=px(-w*.018)+' '+px(w*.009)+' '+px(w*.009)+' #17171738';
 }
 const badgeSize=w*(editorial?150/720:.181);
 if(editorial){
  Object.assign(badge.style,{width:px(badgeSize),height:px(badgeSize),background:'#292e34',borderRadius:'26%',boxShadow:px(w*.031)+' '+px(w*.036)+' '+px(w*.019)+' #33415140'});
  Object.assign(cord.style,{background:'#22252d',boxShadow:px(w*.025)+' '+px(w*.033)+' '+px(w*.018)+' #34405239'});
 }
 if(style.badgeImageId){
  const image=await artwork(style.badgeImageId);
  image.style.cssText='position:absolute;left:10%;top:10%;width:80%;height:80%;object-fit:contain';
  if(green)Object.assign(image.style,{left:'18%',top:'18%',width:'64%',height:'64%'});
  if(editorial)Object.assign(image.style,{left:'17%',top:'17%',width:'66%',height:'66%'});
  badge.replaceChildren(image);
 }
 window.TOTAL=project.scenes.at(-1)!.start+project.scenes.at(-1)!.duration;
 window.render=async (t:number)=>{
  const frame=Math.min(style.samples.length-1,Math.max(0,t*style.sampleFps));
  const a=style.samples[Math.floor(frame)],b=style.samples[Math.ceil(frame)];
  const v=a.map((n,i)=>n+(b[i]-n)*(frame%1));
  const x=v[0]*w,y=v[1]*h,top=v[2]*w,bottom=top+(x-top)*h/y;
  let index=project.scenes.findIndex(s=>t<s.start+s.duration);
  if(index<0)index=phrases.length-1;
  const next=Math.min(index+1,phrases.length-1);
  show(dark,index%2?next:index);show(light,index%2?index:next);
  const final=index===phrases.length-1;
  light.text.style.width=final?'70%':'52%';light.text.style.left=final?'15%':'24%';
  light.text.style.color=final?questionInk:replyInk;
  if(dark.svg)dark.svg.style.color=questionInk;
  if(light.svg)light.svg.style.color=final?questionInk:replyInk;
  if(reducedMotion){show(dark,index);dark.mask.style.clipPath='none';light.mask.hidden=true;cord.hidden=true;badge.style.left=px((1-.181)*w/2);badge.style.top=px(.60*h);}
  else{
   const left='polygon(0 0,'+px(top)+' 0,'+px(bottom)+' 100%,0 100%)',right='polygon('+px(top)+' 0,100% 0,100% 100%,'+px(bottom)+' 100%)';
   dark.mask.style.clipPath=editorial?right:left;light.mask.style.clipPath=editorial?left:right;
   const thickness=w*(editorial?17/720:.009);
   cord.style.left=px(top);cord.style.width=px(Math.hypot(x-top,y));cord.style.height=px(thickness);
   cord.style.transform='rotate('+Math.atan2(y,x-top)+'rad)';
   if(editorial)cord.style.top=px(-thickness/2);
   if(editorial){
    // box-shadow rotates with the cord; convert the light's screen direction
    // to cord-local coordinates so the shadow stays down and right.
    const angle=Math.atan2(y,x-top),dx=w*.028,dy=w*.032;
    cord.style.boxShadow=px(dx*Math.cos(angle)+dy*Math.sin(angle))+' '+px(-dx*Math.sin(angle)+dy*Math.cos(angle))+' '+px(w*.018)+' #34405239';
   }
   badge.style.left=px(x-badgeSize/2);badge.style.top=px(y-badgeSize/2);
   badge.style.transform='rotate('+(-Math.atan2(x-top,y)*(editorial?.572:1))+'rad)';
  }
  window.qa={font:document.fonts.check('32px VideoPrimary'),texts:project.scenes.map(s=>s.text),scene:project.scenes[index].id};
 };
}

