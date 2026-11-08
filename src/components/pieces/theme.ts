// The colours scene pieces use: the brand's (saved in config.pieces when the job is planned),
// or derived from the video's own colours.
import type {Config} from '../../engine/schema.js';
import type {PieceTheme} from '../../engine/scene-pieces-schema.js';
const isHex=(v:unknown):v is string=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function pieceThemeFor(c:Config):PieceTheme{
 if(c.pieces)return c.pieces;
 const dark=c.background==='black-grid';
 return {primary:c.primary,accent:'#F97316',
  surface:dark?'#1B1E24':'#FFFFFF',background:dark?'#111318':'#F6F7FB',text:isHex(c.ink)&&!dark?c.ink:dark?'#F5F6F8':'#111827',muted:dark?'#9AA1AD':'#6B7280',radius:Math.min(28,Math.max(10,c.radius||18))};
}
