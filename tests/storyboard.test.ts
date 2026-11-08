import {describe,expect,it} from 'vitest';
import {captionFor,classifyRole,detectGenre,listIn,numbersIn,splitSentences,storyboard,storyboardMarkdown} from '../src/engine/storyboard.js';
import {requestSchema} from '../src/engine/production.js';
import {nowLabel} from '../src/components/pieces/content.js';
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
 });
 it('classifies meaning',()=>{
  expect(classifyRole('Your team is drowning in messages.',0,5)).toBe('problem');
  expect(classifyRole('Meet Flowly.',1,5)).toBe('reveal');
  expect(classifyRole('Assign tasks in one click.',2,5)).toBe('tasks');
  expect(classifyRole('Track every project live.',3,5)).toBe('track');
  expect(classifyRole('Revenue grew 3x this year.',3,5)).toBe('growth');
  expect(classifyRole('Reply to customers in seconds.',3,6)).toBe('support');
  expect(classifyRole('Start your free trial today.',4,5)).toBe('cta');
  expect(detectGenre(flowly)).toBe('saas-promo');
  expect(detectGenre('Download the app on your phone.')).toBe('app-launch');
 });
 it('builds a valid request with one piece per sentence',()=>{
  const sb=storyboard(flowly,{product:'Flowly'});
  expect(sb.scenes).toBe(6);
  expect(sb.plans.map(p=>p.piece.kind)).toEqual(['notifications','browser','tasks','browser','counter','browser']);
  expect(sb.plans.map(p=>p.role)).toEqual(['problem','reveal','tasks','track','speed','cta']);
  expect(requestSchema.safeParse(sb.request).success).toBe(true);
  const scenes=sb.request.script.split('\n').map(text=>({text}));
  sb.request.sceneVisuals.forEach((v,i)=>{expect(sceneVisualSchema.safeParse(v).success).toBe(true);expect(sceneIndexFor(v,scenes)).toBe(i);});
  const counter=sb.plans[4]!.piece;expect(counter).toMatchObject({kind:'counter',to:40,suffix:'%'});
  // Guessed content is always flagged for the user.
  expect(sb.plans[2]!.check.join(' ')).toMatch(/examples|sample/i);
  const md=storyboardMarkdown(sb,[{id:'rc-saas-promo',title:'SaaS promo'}]);
  expect(md).toContain('| 3 | Assign tasks');expect(md).toContain('rc-saas-promo');expect(md).toContain('Check before rendering');
 });
 it('uses a phone for app launches and never repeats a kind back to back',()=>{
  const sb=storyboard('Our new app is here.\nGet reminders before every deadline.\nSee your week at a glance.\nDownload the app today.',{product:'Plano'});
  expect(sb.genre).toBe('app-launch');expect(sb.device).toBe('phone');
  const kinds=sb.plans.map(p=>p.piece.kind+('screen' in p.piece?p.piece.screen.kind:''));
  kinds.slice(1).forEach((k,i)=>expect(k).not.toBe(kinds[i]));
  expect(requestSchema.safeParse(sb.request).success).toBe(true);
 });
 it('writes Kurdish example words for a Kurdish script',()=>{
  const sb=storyboard('تیمەکەت لە نامە و ئەرک و کاتی کۆتایی نقوم بووە.\nهەر ئێستا بەخۆڕایی تاقی بکەرەوە.',{product:'فلۆلی'});
  expect(sb.language).toBe('ckb');expect(sb.plans[0]!.role).toBe('problem');
  expect(JSON.stringify(sb.request)).not.toMatch(/Sign up|Slack/);
  expect(requestSchema.safeParse(sb.request).success).toBe(true);
 });
 it('fills Arabic and Persian storyboards in their own words',()=>{
  const ar=storyboard('فريقك غارق في الرسائل والمهام والمواعيد.\nتعرّف على فلولي.\nارتفعت المبيعات ٤٠٪.\nجرّب مجاناً اليوم.',{product:'Flowly'});
  expect(ar.language).toBe('ar');expect(ar.plans.map(p=>p.role)).toEqual(['problem','reveal','growth','cta']);
  expect(ar.plans[0]!.piece).toMatchObject({kind:'notifications',items:[{title:'الرسائل'},{title:'المهام'},{title:'المواعيد'}]});
  expect(JSON.stringify(ar.request)).toContain('ابدأ مجاناً');
  const fa=storyboard('تیم شما در پیام‌ها غرق شده است.\nهمین امروز رایگان شروع کنید.',{product:'Flowly'});
  expect(fa.language).toBe('fa');expect(fa.plans.map(p=>p.role)).toEqual(['problem','cta']);
  expect(JSON.stringify(fa.request)).toContain('رایگان شروع کن');
  for(const sb of [ar,fa])expect(requestSchema.safeParse(sb.request).success).toBe(true);
 });
 it('labels notification time in the right language',()=>{
  expect(nowLabel('نامە')).toBe('ئێستا');expect(nowLabel('پیام‌ها')).toBe('اکنون');expect(nowLabel('الرسائل')).toBe('الآن');expect(nowLabel('Mail')).toBe('now');
 });
});
