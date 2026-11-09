// Automatic quality checks on rendered frames: text size, contrast, the sentence running into
// the piece, text cut off, and empty frames. Run on each scene once it has settled, during the
// preview, so a bad combination is caught before anyone looks at it.
import type {Page} from 'playwright';

export type FrameIssue={kind:'small-text'|'contrast'|'overlap'|'cut-off'|'empty';detail:string;severity:'hard'|'soft'};
export type SceneQuality={scene:string;time:number;score:number;issues:FrameIssue[];stats:{minTextPx:number;minContrast:number;overlap:number;spread:number}};
export type Quality={score:number;passed:boolean;scenes:SceneQuality[];hard:number;soft:number;sound?:SoundQuality};
export type SoundQuality={integratedLufs:number|null;truePeakDb:number|null;cuesPerSecond:number|null;issues:string[]};

/** DOM checks for the current frame (call after window.render(t)). */
// tsx/esbuild may wrap named functions in __name(); the page needs it defined.
const NAME_SHIM='window.__name=window.__name||(function(f){return f;})';
export async function checkFrame(page:Page){
 await page.evaluate(NAME_SHIM);
 return page.evaluate(()=>{
  const W=innerWidth,H=innerHeight,stage=document.getElementById('stage')!;
  const parse=(c:string):[number,number,number,number]|null=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);return [v[0]!,v[1]!,v[2]!,v[3]??1];};
  const lin=(v:number)=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};
  const lum=(c:number[])=>.2126*lin(c[0]!)+.7152*lin(c[1]!)+.0722*lin(c[2]!);
  const ratio=(a:number[],b:number[])=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const over=(top:number[],bottom:number[])=>{const a=top[3]??1;return [top[0]!*a+bottom[0]!*(1-a),top[1]!*a+bottom[1]!*(1-a),top[2]!*a+bottom[2]!*(1-a),1];};
  const frameBg=parse(getComputedStyle(document.getElementById('background')??stage).backgroundColor)??[255,255,255,1];
  /** The colour behind an element: what is under its centre (shapes beside it included),
   *  composited from the top down to the frame. */
  const behind=(el:Element)=>{const r=el.getBoundingClientRect(),layers:number[][]=[];
   const stack=document.elementsFromPoint(r.left+r.width/2,r.top+r.height/2).filter(x=>x!==el&&!el.contains(x)&&stage.contains(x)&&x!==stage);
   for(const e of [el,...stack]){const cs=getComputedStyle(e);if(Number(cs.opacity)<.05)continue;
    // A see-through element (a faint blob at 10%) only tints what is beneath it.
    const seen=opacity(e);if(seen<.02)continue;
    const solid=parse(cs.backgroundColor);if(solid&&solid[3]>0)layers.push([solid[0],solid[1],solid[2],solid[3]*seen]);
    const img=cs.backgroundImage;if(img&&img!=='none'&&!img.startsWith('url')){const cols=[...img.matchAll(/rgba?\([^)]+\)/g)].map(m=>parse(m[0])!).filter(Boolean);
     if(cols.length){const avg=[0,1,2,3].map(k=>cols.reduce((s,c)=>s+c[k]!,0)/cols.length);avg[3]=avg[3]!*seen;layers.push(avg);}}
    if(layers.length&&layers[layers.length-1]![3]!>=.98)break;}
   let col=frameBg;for(const l of layers.reverse())col=over(l,col) as typeof col;return col;};
  const opacity=(el:Element)=>{let o=1;for(let e:Element|null=el;e&&e!==stage;e=e.parentElement){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return 0;o*=Number(cs.opacity);}return o;};
  const leaves=[...stage.querySelectorAll<HTMLElement>('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent!.trim().length>0));
  const visible=leaves.map(e=>({e,r:e.getBoundingClientRect(),o:opacity(e)})).filter(x=>x.r.width>1&&x.r.height>1&&x.o>.9);
  const issues:{kind:string;detail:string;severity:string}[]=[];let minPx=1e9,minC=1e9;
  const pieceWrap=document.querySelector<HTMLElement>('[data-style]');
  const visiblePiece=[...document.querySelectorAll<HTMLElement>('[data-style]')].find(p=>opacity(p)>.5&&p.getBoundingClientRect().width>0);
  for(const {e,r} of visible){
   const cs=getComputedStyle(e),scale=e.offsetWidth?r.width/e.offsetWidth:1,px=parseFloat(cs.fontSize)*scale,text=e.textContent!.trim().slice(0,40);
   if(/^[•·|/“”"«»‘’\\-]+$/.test(text))continue; // decorative marks
   minPx=Math.min(minPx,px);
   if(px<H*.0095)issues.push({kind:'small-text',detail:`"${text}" is ${px.toFixed(1)}px (under ${(H*.0095).toFixed(0)}px)`,severity:px<H*.0075?'hard':'soft'});
   const fg=parse(cs.color);if(fg&&fg[3]>.4){const c=ratio(over(fg,behind(e)),behind(e));minC=Math.min(minC,c);
    const large=px>=H*.028||px>=H*.022&&Number(cs.fontWeight)>=600;const need=large?3:4.5;
    if(c<need)issues.push({kind:'contrast',detail:`"${text}" contrast ${c.toFixed(2)}:1 (needs ${need}:1)`,severity:c<need-1.2?'hard':'soft'});}
   if(r.left<-2||r.top<-2||r.right>W+2||r.bottom>H+2)issues.push({kind:'cut-off',detail:`"${text}" leaves the frame`,severity:'hard'});
   // Something else drawn over the text (a device bezel, another card): hidden or clipped.
   const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   if(top&&top!==e&&!e.contains(top)&&!top.contains(e)&&!top.closest('svg')&&Number(getComputedStyle(top).opacity)>.5&&getComputedStyle(top).pointerEvents!=='none'&&parse(getComputedStyle(top).backgroundColor)?.[3]!>.5)
    {issues.push({kind:'cut-off',detail:`"${text}" is covered by another element`,severity:'hard'});continue;}
   const wrap=e.closest<HTMLElement>('[data-style]');if(wrap){const b=wrap.getBoundingClientRect();if(r.left<b.left-3||r.right>b.right+3||r.top<b.top-3||r.bottom>b.bottom+3)issues.push({kind:'cut-off',detail:`"${text}" spills out of its piece`,severity:'soft'});}
   if((cs.overflow==='hidden'||cs.overflowX==='hidden')&&cs.textOverflow!=='ellipsis'&&e.scrollWidth>e.clientWidth+2)issues.push({kind:'cut-off',detail:`"${text}" is clipped`,severity:'soft'});
  }
  // The sentence must not run into the piece.
  let overlap=0;
  const words=[...stage.querySelectorAll<HTMLElement>('[data-kinetic] span,[data-word]')].filter(w=>opacity(w)>.9&&w.getBoundingClientRect().width>0&&!w.closest('[data-style]'));
  if(visiblePiece&&words.length){const b=visiblePiece.getBoundingClientRect();let hit=0,area=0;
   for(const w of words){const r=w.getBoundingClientRect(),a=r.width*r.height;area+=a;hit+=Math.max(0,Math.min(r.right,b.right)-Math.max(r.left,b.left))*Math.max(0,Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top));}
   overlap=area?hit/area:0;if(overlap>.04)issues.push({kind:'overlap',detail:`${Math.round(overlap*100)}% of the sentence sits on the piece`,severity:overlap>.15?'hard':'soft'});}
  void pieceWrap;
  return {issues,stats:{minTextPx:minPx===1e9?0:Number(minPx.toFixed(1)),minContrast:minC===1e9?0:Number(minC.toFixed(2)),overlap:Number(overlap.toFixed(3))}};
 }) as Promise<{issues:FrameIssue[];stats:{minTextPx:number;minContrast:number;overlap:number}}>;
}

/** How much is on screen: the spread of brightness in a screenshot (a blank frame is near 0). */
export async function spread(page:Page,png:Buffer){
 await page.evaluate(NAME_SHIM);
 return page.evaluate(async b64=>{
  const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
  const w=Math.min(240,img.width),h=Math.round(img.height*w/img.width),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d')!;x.drawImage(img,0,0,w,h);
  const d=x.getImageData(0,0,w,h).data;let s=0,s2=0;const n=d.length/4;
  for(let i=0;i<d.length;i+=4){const l=.299*d[i]!+.587*d[i+1]!+.114*d[i+2]!;s+=l;s2+=l*l;}
  return Math.sqrt(Math.max(0,s2/n-(s/n)**2));
 },png.toString('base64'));
}

const PENALTY={'small-text':12,contrast:18,overlap:15,'cut-off':15,empty:60};
export function sceneScore(issues:FrameIssue[]){
 let score=100;const seen=new Map<string,number>();
 for(const i of issues){const n=seen.get(i.kind)??0;seen.set(i.kind,n+1);score-=PENALTY[i.kind]*(i.severity==='hard'?1.5:1)/(1+n*.6);}
 return Math.max(0,Math.round(score));
}
export function summarize(scenes:SceneQuality[]):Quality{
 const hard=scenes.reduce((n,s)=>n+s.issues.filter(i=>i.severity==='hard').length,0),soft=scenes.reduce((n,s)=>n+s.issues.filter(i=>i.severity==='soft').length,0);
 const score=scenes.length?Math.round(scenes.reduce((a,s)=>a+s.score,0)/scenes.length):100;
 return {score,passed:hard===0&&scenes.every(s=>s.score>=60),scenes,hard,soft};
}
