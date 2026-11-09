import {describe,expect,it} from 'vitest';
import {captionFor,classifyRole,listIn,numbersIn,phrasesIn,splitSentences,storyboard,storyboardMarkdown} from '../src/engine/storyboard.js';
import {requestSchema} from '../src/engine/production.js';
import {sceneIndexFor,sceneVisualSchema} from '../src/engine/scene-pieces-schema.js';

const flowly=`Your team is drowning in messages, tasks and deadlines.
Meet Flowly, the workspace that keeps everything in one place.
Assign tasks to the right people in one click.
Track every project live on one dashboard.
Teams using Flowly ship 40% faster.
Start your free trial today.`;

describe('storyboard',()=>{
 it('splits sentences and keeps one per line',()=>{
  expect(splitSentences('One idea. Two ideas!\nThree?')).toEqual(['One idea.','Two ideas!','Three?']);
  expect(splitSentences('یەکەم. دووەم؟ سێیەم')).toHaveLength(3);
 });
 it('reads numbers without treating "one place" as a figure',()=>{
  expect(numbersIn('Teams ship 40% faster')[0]).toMatchObject({value:40,suffix:'%'});
  expect(numbersIn('Save $1,200 a month')[0]).toMatchObject({value:1200,prefix:'$'});
  expect(numbersIn('everything in one place')).toEqual([]);
  expect(numbersIn('three times more leads')[0]).toMatchObject({value:3,suffix:'×'});
  expect(numbersIn('فرۆشتن ٤٠٪ زیادی کرد')[0]).toMatchObject({value:40,suffix:'%'});
 });
 it('finds lists and captions',()=>{
  expect(listIn('Your team is drowning in messages, tasks and deadlines.')).toEqual(['Messages','Tasks','Deadlines']);
  expect(listIn('Meet Flowly, the workspace that keeps everything in one place.')).toEqual([]);
  expect(captionFor('Teams using Flowly ship 40% faster.')).toBe('Faster');
  expect(phrasesIn('Track every project live on one dashboard.')).toEqual(['Track','Project live','One dashboard']);
 });
 it('classifies meaning',()=>{
  expect(classifyRole('Your team is drowning in messages.',0,5)).toBe('problem');
  expect(classifyRole('Meet Flowly.',1,5)).toBe('reveal');
  expect(classifyRole('Assign tasks in one click.',2,5)).toBe('tasks');
  expect(classifyRole('Track every project live.',3,5)).toBe('track');
  expect(classifyRole('Revenue grew 3x this year.',3,5)).toBe('growth');
  expect(classifyRole('Reply to customers in seconds.',3,6)).toBe('support');
  expect(classifyRole('Start your free trial today.',4,5)).toBe('cta');
 });
 it('builds a valid request with a visual designed for every sentence',()=>{
  const sb=storyboard(flowly,{seed:'flowly'});
  expect(sb.scenes).toBe(6);
  expect(sb.plans.map(p=>p.role)).toEqual(['problem','reveal','tasks','track','speed','cta']);
  expect(sb.plans.every(p=>p.piece.kind==='compose'&&p.piece.designed)).toBe(true);
  expect(requestSchema.safeParse(sb.request).success).toBe(true);
  const scenes=sb.request.script.split('\n').map(text=>({text}));
  sb.request.sceneVisuals.forEach((v,i)=>{expect(sceneVisualSchema.safeParse(v).success).toBe(true);expect(sceneIndexFor(v,scenes)).toBe(i);});
  expect(sb.plans[4]!.piece.layers.find(l=>l.type==='number')).toMatchObject({value:40,suffix:'%'});
  const md=storyboardMarkdown(sb);
  expect(md).toContain('| 3 | Assign tasks');expect(md).toContain('Check before rendering');expect(md).not.toMatch(/recipe|sample|example/i);
 });
 it('designs right-to-left scripts from their own words',()=>{
  const ku=storyboard('تیمەکەت لە نامە و ئەرک و کاتی کۆتایی نقوم بووە.\nهەر ئێستا بەخۆڕایی تاقی بکەرەوە.',{seed:'ku'});
  expect(ku.language).toBe('ckb');expect(ku.plans[0]!.role).toBe('problem');
  expect(JSON.stringify(ku.request)).toContain('نامە');expect(JSON.stringify(ku.request)).not.toMatch(/Sign up|Slack|Your app/);
  const ar=storyboard('فريقك غارق في الرسائل والمهام والمواعيد.\nتعرّف على فلولي.\nارتفعت المبيعات ٤٠٪.\nجرّب مجاناً اليوم.',{seed:'ar'});
  expect(ar.language).toBe('ar');expect(ar.plans.map(p=>p.role)).toEqual(['problem','reveal','growth','cta']);
  expect(ar.plans[2]!.piece.layers.find(l=>l.type==='number')).toMatchObject({value:40,suffix:'%'});
  const fa=storyboard('تیم شما در پیام‌ها غرق شده است.\nهمین امروز رایگان شروع کنید.',{seed:'fa'});
  expect(fa.language).toBe('fa');expect(fa.plans.map(p=>p.role)).toEqual(['problem','cta']);
  for(const sb of [ku,ar,fa])expect(requestSchema.safeParse(sb.request).success).toBe(true);
 });
});
