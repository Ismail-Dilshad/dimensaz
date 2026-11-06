import {it,expect} from 'vitest';
import {parseAnswers,briefSchema} from '../engine/conversation.js';
it('parses simple numbered replies',()=>{expect(parseAnswers('1 Auto, 2 White Grid, 3 High Energy, 4 Animated Objects, 5 9:16').preferences).toEqual({style:'auto',visual:'white-grid',energy:'high',assets:'objects',format:'9:16'});});
it('allows autonomous defaults',()=>expect(parseAnswers('surprise me').auto).toBe(true));
it('preserves supplied script exactly',()=>{const s='\u0633\u06b5\u0627\u0648\n\n';expect(briefSchema.parse({title:'test',script:s}).script).toBe(s);});
it('rejects unknown preference values',()=>expect(()=>parseAnswers('3 Extreme')).toThrow());
it('accepts optional reliable timing metadata',()=>expect(briefSchema.parse({title:'timing',script:'x',alignment:[{text:'x',start:0,end:2}]}).alignment).toHaveLength(1));
