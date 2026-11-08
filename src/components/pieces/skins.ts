// Design styles for scene pieces. A style is a whole design language, not a colour swap:
// its own palette (built from the brand's colours), surfaces, corners, depth, type, marks,
// motion character, a backdrop behind the piece, transitions and a sound kit.
// Pieces never hard-code a look; they draw through kit.ts, which reads the active style.
import type {PieceTheme} from '../../engine/scene-pieces-schema.js';
import type {Piece} from '../../engine/scene-pieces-schema.js';
import {h,alpha,mix,on,type SkinLike} from './kit.js';

export type SoundKitId='library'|'soft'|'digital'|'punchy'|'minimal';
export type Skin=SkinLike&{
 name:string;
 /** What it suits; matched against the brief, the genre and the brand. */
 mood:string[];
 palette:(brand:PieceTheme)=>PieceTheme;
 /** Bundled open fonts for titles and numbers (fall back to the video font for other scripts). */
 fonts:{display?:string;numbers?:string};
 backdrop?:(t:PieceTheme,w:number,h:number)=>HTMLElement;
 transitions:Piece['transition'][];
 sound:SoundKitId;
 dark:boolean;
};

const lum=(c:string)=>{const [r,g,b]=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));return (r!*299+g!*587+b!*114)/1000;};
/** Keeps a brand colour readable on a light or dark surface by moving it toward black or white. */
const readable=(c:string,onDark:boolean)=>onDark?(lum(c)<110?mix(c,'#ffffff',.45):c):(lum(c)>170?mix(c,'#000000',.4):c);
const FONT={inter:'assets/fonts/open/Inter-Variable.ttf',grotesk:'assets/fonts/open/SpaceGrotesk-Variable.ttf',serif:'assets/fonts/open/DMSerifDisplay-Regular.ttf',round:'assets/fonts/open/Fredoka-Variable.ttf'};
const blob=(color:string,x:string,y:string,size:number,blur:number)=>h('div',`position:absolute;left:${x};top:${y};width:${size}px;height:${size}px;margin:-${size/2}px;border-radius:50%;background:${color};filter:blur(${blur}px)`);

export const skins:Record<string,Skin>={
 soft:{id:'soft',name:'Soft cards',mood:['clean','friendly','saas','product','modern','startup','default','light'],dark:false,
  palette:b=>b,fonts:{},
  surface:(t,l)=>`background:${t.surface};border:1px solid ${alpha(t.text,.07)};box-shadow:0 2px 0 ${alpha(t.text,.04)},0 ${8+l*10}px ${24+l*24}px ${alpha(t.text,.08+l*.06)}`,
  radius:px=>px,shadow:(t,l)=>`box-shadow:0 ${4+l*8}px ${12+l*20}px ${alpha(t.text,.08+l*.05)}`,
  avatar:'circle',avatarRing:s=>`0 0 0 ${Math.max(2,s*.06)}px #fff,0 6px 16px ${alpha('#000000',.18)}`,
  motion:{curve:'back',distance:1,scale:.94,rotate:0},type:{titleWeight:700,case:'none',tracking:0},tick:'round',
  transitions:['wipe','push','mask-reveal'],sound:'library'},

 glass:{id:'glass',name:'Glass',mood:['premium','ai','fintech','elegant','calm','luxury','futuristic','sleek','modern'],dark:false,
  palette:b=>({...b,surface:'#FFFFFF',background:mix(b.primary,'#ffffff',.9),text:readable(mix(b.primary,'#0B1020',.65),false),muted:mix(b.primary,'#5B6475',.7)}),fonts:{},
  surface:(t,l)=>`background:linear-gradient(140deg,${alpha('#ffffff',.72)},${alpha('#ffffff',.34)});backdrop-filter:blur(${14+l*6}px) saturate(1.5);border:1px solid ${alpha('#ffffff',.85)};box-shadow:inset 0 1px 0 ${alpha('#ffffff',.9)},0 ${10+l*10}px ${30+l*20}px ${alpha(t.primary,.16)}`,
  radius:px=>px*1.25,shadow:(t,l)=>`box-shadow:0 ${6+l*8}px ${20+l*16}px ${alpha(t.primary,.14)}`,
  avatar:'circle',avatarRing:s=>`0 0 0 ${Math.max(2,s*.05)}px ${alpha('#ffffff',.9)},0 8px 20px ${alpha('#000000',.12)}`,
  motion:{curve:'cubic',distance:.6,scale:.97,rotate:0},type:{titleWeight:600,case:'none',tracking:-.01},tick:'round',
  backdrop:(t,w,hh)=>{const b=h('div','position:absolute;inset:-6%;overflow:hidden;pointer-events:none');const z=Math.min(w,hh);
   b.append(blob(alpha(t.primary,.55),'22%','30%',z*.7,z*.12),blob(alpha(t.accent,.5),'80%','70%',z*.6,z*.12),blob(alpha(mix(t.primary,t.accent,.5),.35),'60%','15%',z*.45,z*.1));return b;},
  transitions:['fade','zoom-through','circle-reveal'],sound:'soft'},

 neon:{id:'neon',name:'Midnight neon',mood:['tech','developer','ai','gaming','crypto','night','bold','futuristic','dark','cyber','code'],dark:true,
  palette:b=>({...b,primary:readable(b.primary,true),accent:readable(b.accent,true),surface:'#11151F',background:'#070A10',text:'#E8EDF7',muted:'#7D889C'}),fonts:{numbers:FONT.grotesk,display:FONT.grotesk},
  surface:(t,l)=>`background:${t.surface};border:1px solid ${alpha(t.primary,.6)};box-shadow:0 0 0 1px ${alpha(t.primary,.12)},0 0 ${18+l*14}px ${alpha(t.primary,.32)},inset 0 0 ${16+l*8}px ${alpha(t.primary,.08)}`,
  radius:px=>px*.55,shadow:(t,l)=>`box-shadow:0 0 ${10+l*10}px ${alpha(t.primary,.45)}`,
  avatar:'squircle',avatarRing:s=>`0 0 0 ${Math.max(2,s*.05)}px #070A10,0 0 ${s*.4}px ${alpha('#7DF9FF',.35)}`,
  motion:{curve:'snap',distance:.55,scale:1,rotate:0},type:{display:true,numbers:true,titleWeight:600,case:'upper',tracking:.06},tick:'square',
  backdrop:(t,w,hh)=>{const b=h('div',`position:absolute;inset:-5%;border-radius:${Math.min(w,hh)*.06}px;background:radial-gradient(120% 90% at 50% 0%,${alpha(t.primary,.22)},transparent 60%),#070A10;`+
   `background-image:radial-gradient(120% 90% at 50% 0%,${alpha(t.primary,.22)},transparent 60%),linear-gradient(${alpha(t.primary,.08)} 1px,transparent 1px),linear-gradient(90deg,${alpha(t.primary,.08)} 1px,transparent 1px);background-size:100% 100%,${w/14}px ${w/14}px,${w/14}px ${w/14}px;pointer-events:none`);return b;},
  transitions:['wipe','zoom-through','push'],sound:'digital'},

 brutal:{id:'brutal',name:'Brutalist',mood:['bold','fashion','streetwear','agency','creative','loud','edgy','youth','magazine','punk'],dark:false,
  palette:b=>({...b,surface:'#FFFFFF',background:'#FFF8E6',text:'#0A0A0A',muted:'#3F3F46',primary:readable(b.primary,false),accent:b.accent}),fonts:{display:FONT.grotesk,numbers:FONT.grotesk},
  surface:(t,l)=>`background:${t.surface};border:${l>0?3:2}px solid #0A0A0A;box-shadow:${l>0?`${4+l*3}px ${4+l*3}px 0 #0A0A0A`:'none'}`,
  radius:()=>0,shadow:(_t,l)=>`box-shadow:${3+l*3}px ${3+l*3}px 0 #0A0A0A`,
  avatar:'square',avatarRing:()=>'0 0 0 3px #0A0A0A,4px 4px 0 #0A0A0A',
  motion:{curve:'snap',distance:1.4,scale:.9,rotate:-3},type:{display:true,numbers:true,titleWeight:800,case:'upper',tracking:.02},tick:'square',
  transitions:['push','wipe','none'],sound:'punchy'},

 editorial:{id:'editorial',name:'Editorial paper',mood:['luxury','editorial','finance','law','consulting','culture','calm','classic','premium','report','news'],dark:false,
  palette:b=>({...b,surface:'#FBF8F1',background:'#F2ECE0',text:'#1C1917',muted:'#78716C',primary:readable(mix(b.primary,'#1C1917',.25),false)}),fonts:{display:FONT.serif,numbers:FONT.serif},
  surface:(t,l)=>`background:${t.surface};border:1px solid ${alpha(t.text,l>0?.2:.12)};box-shadow:${l>1?`0 1px 0 ${alpha(t.text,.08)}`:'none'}`,
  radius:px=>Math.min(px*.25,6),shadow:()=>'box-shadow:none',
  avatar:'circle',avatarRing:s=>`0 0 0 ${Math.max(1,s*.03)}px #1C1917`,
  motion:{curve:'smooth',distance:.45,scale:1,rotate:0},type:{display:true,numbers:true,titleWeight:400,case:'none',tracking:0},tick:'round',
  transitions:['fade','mask-reveal','wipe'],sound:'minimal'},

 clay:{id:'clay',name:'Clay',mood:['playful','kids','education','friendly','fun','soft','health','food','casual','cute','3d'],dark:false,
  palette:b=>({...b,surface:mix(b.primary,'#ffffff',.9),background:mix(b.accent,'#ffffff',.88),text:readable(mix(b.primary,'#22223B',.6),false),muted:mix(b.primary,'#6B6B80',.75)}),fonts:{display:FONT.round,numbers:FONT.round},
  surface:(t,l)=>`background:${t.surface};border:none;box-shadow:inset ${-4-l*2}px ${-6-l*2}px ${12+l*4}px ${alpha('#000000',.07)},inset ${4+l*2}px ${6+l*2}px ${12+l*4}px ${alpha('#ffffff',.95)},0 ${10+l*8}px ${24+l*10}px ${alpha(t.primary,.22)}`,
  radius:px=>Math.max(18,px*1.8),shadow:(t,l)=>`box-shadow:0 ${6+l*6}px ${16+l*8}px ${alpha(t.primary,.25)}`,
  avatar:'squircle',avatarRing:s=>`inset -3px -4px 8px ${alpha('#000000',.12)},0 ${s*.12}px ${s*.3}px ${alpha('#000000',.15)}`,
  motion:{curve:'elastic',distance:1.2,scale:.7,rotate:0},type:{display:true,numbers:true,titleWeight:600,case:'none',tracking:0},tick:'round',
  transitions:['circle-reveal','zoom-through','push'],sound:'soft'},

 outline:{id:'outline',name:'Blueprint outline',mood:['technical','engineering','minimal','architecture','data','developer','precise','b2b','infrastructure'],dark:false,
  palette:b=>({...b,surface:'#FFFFFF',background:mix(b.primary,'#ffffff',.94),text:readable(b.primary,false),muted:mix(b.primary,'#8A94A6',.6)}),fonts:{numbers:FONT.grotesk},
  surface:(t,l)=>`background:${alpha(t.background,.75)};border:${l>0?2:1.5}px solid ${t.primary};box-shadow:none`,
  radius:px=>px*.4,shadow:()=>'box-shadow:none',
  avatar:'circle',avatarRing:s=>`0 0 0 ${Math.max(2,s*.05)}px #ffffff,0 0 0 ${Math.max(3,s*.08)}px currentColor`,
  motion:{curve:'smooth',distance:.5,scale:.98,rotate:0},type:{numbers:true,titleWeight:600,case:'upper',tracking:.1},tick:'square',
  backdrop:(t,w)=>h('div',`position:absolute;inset:-4%;pointer-events:none;background-image:radial-gradient(${alpha(t.primary,.28)} 1.2px,transparent 1.4px);background-size:${w/22}px ${w/22}px`),
  transitions:['wipe','mask-reveal','fade'],sound:'minimal'},

 pop:{id:'pop',name:'Pop colour',mood:['playful','consumer','social','retail','sale','music','fun','energetic','food','marketing','loud'],dark:false,
  palette:b=>{const card=readable(b.primary,false);const fg=on(card);return {...b,surface:card,text:fg,muted:mix(fg,card,.32),primary:b.accent===card?'#FFD43B':b.accent,accent:'#FFD43B',background:mix(card,'#ffffff',.82)};},fonts:{display:FONT.grotesk,numbers:FONT.grotesk},
  surface:(t,l)=>`background:${t.surface};border:none;box-shadow:0 ${4+l*4}px 0 ${mix(t.surface,'#000000',.35)},0 ${14+l*8}px ${24+l*10}px ${alpha('#000000',.18)}`,
  radius:px=>px*1.4,shadow:(t,l)=>`box-shadow:0 ${3+l*3}px 0 ${mix(t.surface,'#000000',.35)}`,
  avatar:'squircle',avatarRing:s=>`0 ${s*.08}px 0 ${alpha('#000000',.3)}`,
  motion:{curve:'back',distance:1.4,scale:.6,rotate:4},type:{display:true,numbers:true,titleWeight:800,case:'none',tracking:-.01},tick:'round',
  transitions:['zoom-through','circle-reveal','push'],sound:'punchy'},
};
export const skinIds=Object.keys(skins);
export const skinFor=(id:string|undefined)=>skins[id??'soft']??skins.soft!;
