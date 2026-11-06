import {describe,it,expect} from 'vitest';
import {direction,words,graphemes} from '../src/engine/rtl-layout.js';
import {parseScript} from '../src/engine/script-parser.js';
import {defaults} from '../src/engine/config.js';
import {checkGlyphs} from '../src/engine/text-shaper.js';
describe('Sorani typography',()=>{
 it('preserves every script character and whitespace',()=>{for(const s of ['\nسڵاو TikTok 2026!\n\nچۆنیت؟\n','**هەڵە** [[ئەمە]]','Hello\r\nWorld',' سڵاو ڕ ڵ ۆ ێ ە '])expect(parseScript(s).join('')).toBe(s);});
 it('detects first strong RTL/LTR direction',()=>{expect(direction('2026 سڵاو TikTok')).toBe('rtl');expect(direction('TikTok سڵاو')).toBe('ltr');});
 it('keeps grapheme clusters',()=>expect(graphemes('a\u0301')[0].text).toBe('a\u0301'));
 it('reports offsets into original mixed text',()=>{const t='سڵاو TikTok 2026';for(const w of words(t))expect(t.slice(w.start,w.end)).toBe(w.text);});
 it('checks the Kurdish default font cmap',async()=>expect(checkGlyphs('سڵاو ڕ ڵ ۆ ێ ە TikTok 2026!',await defaults({language:'ckb'})).fallbackGlyphs).toEqual([]));
 it('never silently falls back for emoji',async()=>expect(()=>checkGlyphs('🧑',awaitedConfig!)).toThrow());
});
let awaitedConfig:Awaited<ReturnType<typeof defaults>>;awaitedConfig=await defaults();
