import {it,expect} from 'vitest';
import {parseScript} from '../src/engine/script-parser.js';
it('preserves standalone CR, blank lines and diacritics',()=>{for(const s of ['\rسڵاو\r\n\nڕ\r','هەڵە\u200c ڵ\u0650'])expect(parseScript(s).join('')).toBe(s);});
