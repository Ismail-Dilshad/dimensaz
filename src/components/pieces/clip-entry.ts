// Browser entry for a designed visual rendered on its own, with a transparent background, so it
// can be laid over footage (renderer/piece-clip.ts). The visual sits on a panel in the video's
// style (so its text reads over any footage), comes in with a short scale-up and leaves with a
// fade before the clip ends. Timing is the same buildPiece timing the motion renderer uses.
import {buildPiece} from './index.js';
import {skinFor} from './skins.js';
import type {Piece,PieceTheme} from '../../engine/scene-pieces-schema.js';

declare global{interface Window{setupClip:(o:{piece:Piece;theme:PieceTheme;w:number;h:number;dir:'ltr'|'rtl';duration:number})=>number;renderClip:(t:number)=>void}}
let frame:((t:number)=>void)|undefined;
window.setupClip=o=>{
 const sk=skinFor(o.theme.genome),t=sk.palette(o.theme),pad=Math.round(Math.min(o.w,o.h)*.06);
 const panel=document.createElement('div');
 panel.style.cssText=`position:absolute;left:0;top:0;width:${o.w}px;height:${o.h}px;box-sizing:border-box;padding:${pad}px;border-radius:${Math.round(Math.min(o.w,o.h)*.07)}px;`+
  `background:${t.background};box-shadow:0 ${pad*.4}px ${pad*1.4}px rgba(0,0,0,.35);opacity:0;transform-origin:50% 60%;overflow:hidden`;
 const built=buildPiece(o.piece,{theme:o.theme,box:{w:o.w-2*pad,h:o.h-2*pad},font:'VideoPrimary',dir:o.dir,assets:{}});
 panel.append(built.el);document.body.append(panel);
 const speed=Math.max(1,built.length/Math.max(.5,o.duration*.85));
 frame=x=>{const inq=Math.min(1,x/.25),out=Math.min(1,Math.max(0,(o.duration-x)/.3));const e=1-(1-inq)**3;
  panel.style.opacity=String(Math.min(e,out));panel.style.transform=`scale(${.92+.08*e}) translateY(${(1-e)*pad}px)`;built.render(x*speed);};
 frame(0);return built.length;
};
window.renderClip=x=>frame?.(x);
