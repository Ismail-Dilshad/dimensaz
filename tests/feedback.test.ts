import {it,expect,beforeEach,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dz-fb-'));
process.env.DIMENSAZ_KNOWLEDGE_DIR=dir;process.env.DIMENSAZ_FEEDBACK_NO_BRAIN='1';
const fb=await import('../src/engine/feedback.js');
const md=()=>fs.readFileSync(path.join(dir,'memory.md'),'utf8');
beforeEach(()=>{fs.writeFileSync(path.join(dir,'memory.md'),'# Production memory\n\n- **sorani-shaping** · keep me\n\n## Other section\n\nkeep this too\n');fs.rmSync(path.join(dir,'feedback.jsonl'),{force:true});});
afterAll(()=>fs.rmSync(dir,{recursive:true,force:true}));

it('saves a rule with the user\'s words and keeps the rest of memory',async()=>{
 const r=await fb.addFeedback({said:'Too slow, it is just text on a background',rule:'Every sentence gets a designed visual; nothing static over 1.5 s',verdict:'reject',job:'flowly'});
 expect(r.action).toBe('added');expect(r.lesson.id).toMatch(/^fb-/);
 expect(r.lesson.topics).toEqual(expect.arrayContaining(['pacing','motion']));
 const text=md();
 expect(text).toContain('- **sorani-shaping** · keep me');expect(text).toContain('## Other section\n\nkeep this too');
 expect(text).toContain(fb.SECTION);
 expect(fb.parseLessons(text)).toEqual([r.lesson]);
 const log=fs.readFileSync(path.join(dir,'feedback.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
 expect(log[0]).toMatchObject({verdict:'reject',job:'flowly',said:'Too slow, it is just text on a background',lesson:r.lesson.id});
});

it('merges the same point, counts it, and keeps the newest wording',async()=>{
 const a=await fb.addFeedback({said:'captions are too low',rule:'Keep captions above the bottom 300 px safe area',verdict:'revise'});
 const b=await fb.addFeedback({said:'captions still sit too low',rule:'Keep captions above the bottom 320 px safe area of the frame',verdict:'revise'});
 expect(b.action).toBe('strengthened');expect(b.lesson.id).toBe(a.lesson.id);expect(b.lesson.count).toBe(2);
 expect(fb.parseLessons(md())).toHaveLength(1);expect(fb.parseLessons(md())[0]!.rule).toContain('320 px');
 const c=await fb.addFeedback({said:'love the music',rule:'Upbeat electronic music at 120 BPM suits SaaS promos',verdict:'approve'});
 expect(c.action).toBe('added');expect(fb.formatLesson(c.lesson)).toMatch(/· Keep,/);
});

it('returns strong rules always and others when the brief matches',async()=>{
 await fb.addFeedback({said:'just text, no design',rule:'Never deliver text on a plain background',verdict:'reject'});
 await fb.addFeedback({said:'Kurdish line breaks are wrong',rule:'Break Sorani captions at phrase boundaries, max 3 words per line',verdict:'revise'});
 await fb.addFeedback({said:'music too loud',rule:'Keep music 20 dB under the voice',verdict:'revise'});
 const promo=await fb.lessonsFor('30 s SaaS promo in English, 9:16');
 expect(promo.map(l=>l.apply)).toEqual(['Never deliver text on a plain background']);
 expect(promo[0]!.always).toBe(true);
 const kurdish=await fb.lessonsFor('Sorani explainer with captions and music');
 expect(kurdish.map(l=>l.apply)).toEqual(expect.arrayContaining(['Never deliver text on a plain background','Break Sorani captions at phrase boundaries, max 3 words per line','Keep music 20 dB under the voice']));
 expect((await fb.lessonsFor('')).length).toBe(3);
});

it('forgets a rule and survives quotes and dashes in the text',async()=>{
 const r=await fb.addFeedback({said:'he said "no" — twice',rule:'Use the word "free" only with proof — never alone',verdict:'revise',id:'free-claim'});
 expect(r.lesson.id).toBe('fb-free-claim');
 const back=fb.parseLessons(md())[0]!;expect(back.quote).toBe('he said "no" — twice');expect(back.rule).toBe('Use the word "free" only with proof — never alone');
 await fb.forget('fb-free-claim');expect(fb.parseLessons(md())).toEqual([]);
 await expect(fb.forget('fb-nope')).rejects.toThrow(/No lesson/);
 await expect(fb.addFeedback({said:'  '})).rejects.toThrow(/user's words/);
});

it('reads memory saved with Windows line endings',async()=>{
 await fb.addFeedback({said:'too slow',rule:'Never deliver text on a plain background',verdict:'reject'});
 fs.writeFileSync(path.join(dir,'memory.md'),md().replace(/\n/g,'\r\n'));
 expect(await fb.listLessons()).toHaveLength(1);
 expect((await fb.lessonsFor('promo'))[0]!.apply).toBe('Never deliver text on a plain background');
 await fb.addFeedback({said:'music too loud',rule:'Keep music 20 dB under the voice',verdict:'revise'});
 expect(await fb.listLessons()).toHaveLength(2);
});
