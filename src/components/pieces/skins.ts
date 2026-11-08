// Turns a style genome (genome.ts) into the skin pieces draw with: palette from the brand,
// surfaces, corners, depth, type, marks, motion, backdrop, transitions and sound kit.
// Every video's genome is new; the named examples are only where breeding starts.
import type {PieceTheme} from '../../engine/scene-pieces-schema.js';
import type {Piece} from '../../engine/scene-pieces-schema.js';
import {h,alpha,mix,on,type SkinLike} from './kit.js';
import {examples,exampleIds,exampleGenome,type Genome} from './genome.js';

export type SoundKitId=Genome['sound']['kit'];
export type Skin=SkinLike&{
 name:string;mood:string[];genome:Genome;
 palette:(brand:PieceTheme)=>PieceTheme;
 /** Bundled open fonts for titles and numbers (fall back to the video font for other scripts). */
 fonts:{display?:string;numbers?:string};
 backdrop?:(t:PieceTheme,w:number,h:number)=>HTMLElement;
 transitions:Piece['transition'][];sound:SoundKitId;dark:boolean;
};

const lum=(c:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));return (r!*299+g!*587+b!*114)/1000;};
const readable=(c:string,onDark:boolean)=>onDark?(lum(c)<110?mix(c,'#ffffff',.45):c):(lum(c)>170?mix(c,'#000000',.4):c);
const FONT:Record<string,string|undefined>={video:undefined,inter:'assets/fonts/open/Inter-Variable.ttf',grotesk:'assets/fonts/open/SpaceGrotesk-Variable.ttf',serif:'assets/fonts/open/DMSerifDisplay-Regular.ttf',round:'assets/fonts/open/Fredoka-Variable.ttf'};
const blob=(color:string,x:string,y:string,size:number,blur:number)=>h('div',`position:absolute;left:${x};top:${y};width:${size}px;height:${size}px;margin:-${size/2}px;border-radius:50%;background:${color};filter:blur(${blur}px)`);
/** Rotates a colour's hue by `deg` (for complementary accents). */
function hue(c:string,deg:number){
 const [r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255) as [number,number,number];const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;
 let H=0;const S=d?d/(1-Math.abs(2*l-1)):0;if(d){H=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;H*=60;}H=(H+deg+360)%360;
 const C=(1-Math.abs(2*l-1))*S,X=C*(1-Math.abs((H/60)%2-1)),m=l-C/2;const [R,G,B]=H<60?[C,X,0]:H<120?[X,C,0]:H<180?[0,C,X]:H<240?[0,X,C]:H<300?[X,0,C]:[C,0,X];
 return '#'+[R,G,B].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
}

export function skinFromGenome(g:Genome,mood:string[]=[]):Skin{
 const dark=g.tone==='dark';
 const palette=(b:PieceTheme):PieceTheme=>{
  const accent={brand:b.accent,warm:mix(b.accent,'#FF7A45',.6),cool:mix(b.accent,'#22D3EE',.65),yellow:'#FFD43B',complement:hue(b.primary,180)}[g.accent];
  switch(g.tone){
   case 'dark':return {...b,primary:readable(b.primary,true),accent:readable(accent,true),background:mix(b.primary,'#05070C',.9+g.tint*.05-.05),surface:mix(b.primary,'#10141C',.92-g.tint*.12),text:'#E9EDF5',muted:'#8A93A6'};
   case 'paper':return {...b,primary:readable(mix(b.primary,'#1C1917',.2),false),accent,background:mix('#F2ECE0',b.primary,g.tint*.06),surface:'#FBF8F1',text:'#1C1917',muted:'#78716C'};
   case 'tinted':return {...b,accent,background:mix(accent,'#ffffff',.86),surface:mix(b.primary,'#ffffff',.94-g.tint*.08),text:readable(mix(b.primary,'#22223B',.6),false),muted:mix(b.primary,'#6B6B80',.75)};
   case 'brand':{const card=readable(b.primary,false),fg=on(card);return {...b,surface:card,text:fg,muted:mix(fg,card,.32),primary:accent===card?'#FFD43B':accent,accent:g.accent==='brand'?'#FFD43B':accent,background:mix(card,'#ffffff',.82)};}
   default:return {...b,accent,background:mix(b.primary,'#ffffff',.95-g.tint*.07),surface:mix(b.primary,'#ffffff',1-g.tint*.06),text:b.text&&lum(b.text)<120?b.text:'#111827',muted:'#6B7280'};
  }
 };
 const ink=(t:PieceTheme)=>dark?t.text:'#0A0A0A';
 const borderColor=(t:PieceTheme)=>({text:alpha(t.text,.08+g.border.w*.05),primary:alpha(t.primary,.65),ink:ink(t),light:alpha('#ffffff',dark?.25:.85)})[g.border.color];
 const d=g.shadow.depth,sx=g.shadow.dir;
 const shadowCss=(t:PieceTheme,l:number)=>{switch(g.shadow.kind){
  case 'soft':return `0 ${(4+l*9)*d}px ${(14+l*22)*d}px ${alpha(dark?'#000000':t.text,(.07+l*.06)*(dark?2:1))}`;
  case 'offset':return `${((3+l*3)*d*(sx||1)).toFixed(1)}px ${((3+l*3)*d).toFixed(1)}px 0 ${ink(t)}`;
  case 'glow':return `0 0 0 1px ${alpha(t.primary,.12)},0 0 ${(14+l*14)*d}px ${alpha(t.primary,.35)}`;
  case 'inset':return `inset ${-4-l*2}px ${-6-l*2}px ${12+l*4}px ${alpha('#000000',.07)},inset ${4+l*2}px ${6+l*2}px ${12+l*4}px ${alpha('#ffffff',dark?.12:.9)},0 ${(8+l*8)*d}px ${(20+l*10)*d}px ${alpha(t.primary,.2)}`;
  case 'lift':return `0 ${(3+l*4)*d}px 0 ${mix(t.surface,'#000000',.32)},0 ${(10+l*8)*d}px ${(20+l*10)*d}px ${alpha('#000000',.16)}`;
  default:return 'none';}};
 const fillCss=(t:PieceTheme,l:number)=>g.fill==='glass'?`background:linear-gradient(140deg,${alpha(dark?t.surface:'#ffffff',dark?.7:.72)},${alpha(dark?t.surface:'#ffffff',dark?.35:.32)});backdrop-filter:blur(${12+l*6}px) saturate(1.4)`
  :g.fill==='gradient'?`background:linear-gradient(${150+sx*30}deg,${t.surface},${mix(t.surface,t.primary,.1+g.tint*.12)})`:`background:${t.surface}`;
 const backdrop=g.backdrop.kind==='none'?undefined:(t:PieceTheme,w:number,hh:number)=>{
  const a=g.backdrop.amount,z=Math.min(w,hh),b=h('div','position:absolute;inset:-5%;overflow:hidden;pointer-events:none');
  if(dark)b.style.background=mix(t.background,'#000000',.2);b.style.borderRadius=Math.min(w,hh)*.05*Math.min(1,g.radius)+'px';
  switch(g.backdrop.kind){
   case 'orbs':b.append(blob(alpha(t.primary,.5*a),'22%','30%',z*.7,z*.12),blob(alpha(t.accent,.45*a),'80%','70%',z*.6,z*.12),blob(alpha(mix(t.primary,t.accent,.5),.3*a),'60%','15%',z*.45,z*.1));break;
   case 'grid':b.style.backgroundImage=`radial-gradient(120% 90% at 50% 0%,${alpha(t.primary,.2*a)},transparent 60%),linear-gradient(${alpha(t.primary,.1*a)} 1px,transparent 1px),linear-gradient(90deg,${alpha(t.primary,.1*a)} 1px,transparent 1px)`;b.style.backgroundSize=`100% 100%,${w/14}px ${w/14}px,${w/14}px ${w/14}px`;break;
   case 'dots':b.style.backgroundImage=`radial-gradient(${alpha(t.primary,.32*a)} 1.2px,transparent 1.4px)`;b.style.backgroundSize=`${w/22}px ${w/22}px`;break;
   case 'stripes':b.style.backgroundImage=`repeating-linear-gradient(${-35+sx*20}deg,${alpha(t.primary,.08*a)} 0 ${z*.02}px,transparent ${z*.02}px ${z*.05}px)`;break;
   case 'gradient':b.style.backgroundImage=`linear-gradient(${140+sx*40}deg,${alpha(t.primary,.32*a)},${alpha(t.accent,.28*a)})`;break;
   case 'rings':for(const [k,s] of [[0,.9],[1,.62],[2,.36]] as const)b.append(h('div',`position:absolute;left:50%;top:50%;width:${z*s}px;height:${z*s}px;margin:-${z*s/2}px;border-radius:50%;border:${Math.max(1,z*.004)}px solid ${alpha(k%2?t.accent:t.primary,.25*a)}`));break;
  }
  return b;};
 const rad=(px:number)=>g.radius<.08?0:px*g.radius;
 return {id:g.id,name:g.name,mood,genome:g,dark,palette,fonts:{display:FONT[g.type.display],numbers:FONT[g.type.numbers]},
  surface:(t,l)=>`${fillCss(t,l)};border:${g.border.w<.3?'none':`${(g.border.w*(l>0?1:.75)).toFixed(2)}px solid ${borderColor(t)}`};box-shadow:${shadowCss(t,l)}`,
  radius:rad,shadow:(t,l)=>`box-shadow:${shadowCss(t,l*.6)}`,
  avatar:g.avatar,avatarRing:s=>g.shadow.kind==='offset'?`0 0 0 ${Math.max(2,s*.05)}px #0A0A0A,${Math.max(2,s*.06)}px ${Math.max(2,s*.06)}px 0 #0A0A0A`
   :g.shadow.kind==='glow'?`0 0 0 ${Math.max(2,s*.05)}px ${dark?'#070A10':'#ffffff'},0 0 ${s*.4}px ${alpha('#7DF9FF',.35)}`
   :`0 0 0 ${Math.max(1.5,s*.05)}px ${dark?alpha('#ffffff',.15):'#ffffff'},0 ${s*.08}px ${s*.24}px ${alpha('#000000',.16)}`,
  motion:g.motion,type:{display:!!FONT[g.type.display],numbers:!!FONT[g.type.numbers],titleWeight:g.type.weight,case:g.type.upper?'upper':'none',tracking:g.type.tracking},tick:g.tick,
  backdrop,transitions:g.transitions,sound:g.sound.kit};
}

/** The named examples as skins (for listing and as breeding stock; videos get bred genomes). */
export const skins:Record<string,Skin>=Object.fromEntries(exampleIds.map(id=>[id,skinFromGenome(exampleGenome(id),examples[id]!.mood)]));
export const skinIds=exampleIds;
/** The skin for a theme: its bred genome, else a named example, else soft. */
export function skinFor(id:string|undefined,genome?:Genome){
 if(genome)return skinFromGenome(genome);
 return skins[id??'soft']??skins.soft!;
}
