// Automatic storyboard: script in, a ready video request out. Each sentence becomes one scene
// whose visual is designed from zero (piece-designer.ts) from what the sentence means and says:
// its key phrase, list, numbers, a before→after turn or a quotation. Only the sentence's own
// words and numbers appear; nothing is a ready-made piece or a sample. The style is new for
// every video too (genome.ts), and the brain steers both from verdicts.
import {pieceSchema,type Piece} from './scene-pieces-schema.js';
import {detectLanguage} from './languages.js';
import type {Genome} from '../components/pieces/genome.js';
import {designPiece,type Role,type Num} from './piece-designer.js';
export type {Role,Num};
export type Plan={index:number;sentence:string;role:Role;piece:Piece;why:string;check:string[]};

const has=(s:string,re:RegExp)=>re.test(s.toLowerCase());
const DOWNLOAD=/\b(app store|google play|download the app|get the app|on iphone and android)\b|ئەپەکە داونلۆد|حمّل التطبيق|حمل التطبيق|دانلود اپ|دانلود برنامه/;
const PRICING=/\b(price|prices|pricing|plans?|per month|\/mo|a month|subscription|costs?)\b|نرخ|پلان|مانگانە|السعر|الأسعار|خطة|شهري|قیمت|اشتراک|ماهانه/;
const QUOTE=/\b(says|said|testimonial|review|reviews|customers say|in their words)\b|دەڵێت|وتی|يقول|قال|می‌گوید|گفت/;
const ROLE_RULES:[Role,RegExp][]=[
 ['cta',/\b(try|start|get started|sign up|signup|download|join|book a demo|visit|order now|free trial|today|link in bio|call us)\b|هەر ئێستا|داونلۆد|بەشداربە|سەردان|جرّب|جرب|ابدأ|حمّل|حمل التطبيق|سجّل|سجل الآن|انضم|اليوم|امتحان کن|امتحان کنید|شروع کن|شروع کنید|دانلود|ثبت‌نام|همین امروز/],
 ['alerts',/\b(notification|notifications|alert|alerts|reminder|reminders|remind|ping)\b|ئاگادار|تنبيه|إشعار|تذكير|اعلان|اعلان‌ها|یادآور/],
 ['logos',/\b(trusted by|used by|loved by|teams at|companies like|brands|partners)\b|متمانە|تثق به|يستخدمه|مورد اعتماد|شرکت‌های/],
 ['compare',/\b(before|instead of|vs\.?|versus|compared|old way|no more|used to)\b|لەبری|بەراورد|بدلاً من|مقارنة|به جای|مقایسه/],
 ['calendar',/\b(calendar|meeting|meetings|appointment|appointments|booking|book a|deadline on|every (?:monday|tuesday|wednesday|thursday|friday)|dates?)\b|ڕۆژژمێر|کۆبوونەوە|چاوپێکەوتن|موعد|اجتماع|تقويم|حجز|تقویم|جلسه|قرار ملاقات|نوبت/],
 ['map',/\b(near you|nearby|location|locations|cities|city|deliver|delivery|map|route|pickup|anywhere in)\b|نزیک|شوێن|شار|گەیاندن|بالقرب|موقع|مدينة|توصيل|نزدیک|مکان|شهر|تحویل/],
 ['form',/\b(fill in|fill out|form|register|enter your|apply|create an account|your details)\b|فۆرم|تۆماربکە|سجّل بياناتك|نموذج|فرم|ثبت کنید/],
 ['problem',/\b(drown|drowning|waste|wasted|losing|lose|lost|chaos|messy|manual|struggle|stuck|overwhelm|overwhelmed|too many|tired of|missed|miss|slow|pain|frustrat|juggl|endless|forget)\w*|کێشە|ماندوو|نقوم|پەرێشان|بێسەروبەر|شڵەژا|بێزار|ون دەبێت|دواکەوت|مشكلة|مشاكل|تضيع|ضياع|فوضى|غارق|غرق|مرهق|ممل|مشکل|هدر|شلوغ|خسته|سردرگم/],
 ['support',/\b(reply|replies|answer|support|chat|message|messages|customers? ask|hear back|respond|inbox|conversation)\w*|نامە|وەڵام|پەیوەندی|رسائل|رسالة|الرد|دعم|محادثة|پیام|پاسخ|پشتیبانی|گفتگو/],
 ['done',/\b(done|finished|complete|completed|checked|shipped|delivered|ready)\b|تەواو|منجز|انجام شد|تمام/],
 ['track',/\b(track|tracking|see|watch|dashboard|insight|insights|analytics|report|reports|real[- ]time|live|overview|monitor)\w*|بینین|ڕاپۆرت|چاودێری|تابع|متابعة|لوحة|تقرير|تقارير|مباشر|گزارش|داشبورد|ببین|پیگیری/],
 ['tasks',/\b(assign|assigns|task|tasks|to-?do|organi[sz]e|schedule|plans?|planning|projects?|workflows?|automates?|automated|automatically|delegate[sd]?)(?:s|d|ing)?\b|ئەرک|کار|ڕێکخستن|مهام|مهمة|وزّع|نظّم|جدول|مشروع|مشاريع|وظایف|کارها|تکلیف|سازماندهی|پروژه/],
 ['speed',/\b(minutes?|seconds?|hours?|instantly|faster|fast|quick|quickly|in no time)\b|خولەک|چرکە|خێرا|دقائق|دقيقة|ثوان|ثواني|ساعات|أسرع|سريع|فوراً|دقیقه|ثانیه|سریع|سریع‌تر|فوری/],
 ['team',/\b(team|teams|together|collaborat\w*|people|everyone|community|customers|clients|users)\b|تیم|هاوکاری|کڕیار|فريق|فريقك|معاً|عملاء|العملاء|تیم|همکاری|مشتریان|کاربران/],
 ['steps',/\b(step|steps|first|then|finally|easy|simple|three|3 ways)\b|هەنگاو|سەرەتا|پاشان|خطوة|خطوات|أولاً|أخيراً|سهل|مرحله|گام|ابتدا|سپس|آسان/],
];
const NUMBER_WORDS:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,
 twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100,thousand:1000,million:1e6};
const toAscii=(s:string)=>s.replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0)).replace(/٪/g,'%').replace(/٫/g,'.');
/** Numbers in the sentence (digits, Arabic-Indic digits, and English number words). */
export function numbersIn(sentence:string):Num[]{
 const s=toAscii(sentence),out:Num[]=[];
 for(const m of s.matchAll(/([$€£])?\s?(\d+(?:[.,]\d+)*)\s?(%|x|×|k|m|\+)?(?:\s?(percent|times))?/gi)){
  const raw=m[2]!;const value=Number(raw.includes('.')&&!raw.includes(',')?raw:raw.replace(/,/g,''));if(!Number.isFinite(value))continue;
  const unit=(m[3]??'').toLowerCase(),word=(m[4]??'').toLowerCase();
  out.push({value,prefix:m[1]||undefined,suffix:unit==='%'||word==='percent'?'%':unit==='x'||unit==='×'||word==='times'?'×':unit==='k'?'k':unit==='m'?'M':unit==='+'?'+':undefined,decimals:raw.includes('.')?1:0});
 }
 if(!out.length){
  const words=s.toLowerCase().split(/[^a-z-]+/);let cur=0,total=0,seen=false;
  for(const w of words.flatMap(x=>x.split('-'))){const v=NUMBER_WORDS[w];if(v===undefined){if(seen&&w!=='and')break;continue;}seen=true;
   if(v===100||v===1000||v===1e6){cur=(cur||1)*v;if(v>=1000){total+=cur;cur=0;}}else cur+=v;}
  // "one place", "one click" are not figures: number words count from two.
  const value=total+cur;
  if(seen&&value>=2)out.push({value,suffix:/percent/.test(s.toLowerCase())?'%':/times/.test(s.toLowerCase())?'×':undefined,decimals:0});
 }
 return out;
}
export function classifyRole(sentence:string,index:number,total:number):Role{
 if(index===total-1&&total>1&&has(sentence,ROLE_RULES[0]![1]))return has(sentence,DOWNLOAD)?'download':'cta';
 if(has(sentence,DOWNLOAD))return 'download';
 if(has(sentence,PRICING))return 'pricing';
 // Dates are numbers too, but a calendar shows them better than a counter.
 if(has(sentence,ROLE_RULES.find(r=>r[0]==='calendar')![1]))return 'calendar';
 if(/["“”«»]/.test(sentence)&&/["“«][^"“”«»]{8,}["”»]/.test(sentence)||has(sentence,QUOTE))return 'quote';
 const nums=numbersIn(sentence);
 if(nums.length){if(has(sentence,/\b(grew|grow|growth|increase|more|up|revenue|sales|boost|doubled|tripled)\b|زیاد|گەشە|نمو|زاد|زادت|ارتفع|ارتفعت|ضاعف|رشد|افزایش/))return 'growth';if(has(sentence,ROLE_RULES.find(r=>r[0]==='speed')![1]))return 'speed';return 'number';}
 if(has(sentence,/\b(meet|introducing|say hello|this is|with)\b|ئەمە|بناسە|تعرّف|تعرف على|نقدّم|نقدم|معرفی|آشنا شوید/)&&index<=2)return 'reveal';
 for(const [role,re] of ROLE_RULES.slice(1))if(has(sentence,re))return role;
 if(index===total-1&&total>2)return 'cta';
 if(index===0)return 'hook';
 return 'explain';
}
const STOP=new Set('the a an and or of to in on for with your you our we is are be it this that at by from as into every all can will just more most than then them they their its my me i not no so too very each any have has had get got do does did'.split(' '));
/** Short phrases from the sentence: list items when there is a list, else key words. */
export function phrasesIn(sentence:string,max=3){
 const clean=sentence.replace(/[.!?؟]+$/,'').trim();
 const parts=clean.split(/\s*(?:,|،|;|؛|\band\b|\bor\b|\s+و\s+|\s+و(?=ال))\s*/i).map(p=>p.trim()).filter(p=>p.length>1);
 if(parts.length>=2&&parts.slice(1).every(p=>p.split(/\s+/).length<=4)){
  // "Your team is drowning in messages, tasks and deadlines": the lead clause belongs to the
  // sentence, not the list; keep only as many words of it as the other items have.
  const rest=parts.slice(1),n=Math.max(...rest.map(p=>p.split(/\s+/).length));
  const first=parts[0]!.split(/\s+/);if(first.length>n+1)parts[0]=first.slice(-n).join(' ');
  return parts.slice(0,max).map(cap);
 }
 // No list: runs of content words between fillers ("Track every project live on one dashboard" →
 // Track · Project live · One dashboard), at most three words each.
 const runs:string[][]=[[]];for(const w of clean.split(/\s+/)){const bare=w.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  if(!bare||STOP.has(bare)){if(runs.at(-1)!.length)runs.push([]);continue;}const r=runs.at(-1)!;if(r.length>=3)runs.push([w]);else r.push(w);}
 const chunks=runs.filter(r=>r.length&&r.join('').replace(/[^\p{L}\p{N}]/gu,'').length>2).slice(0,max).map(r=>cap(r.join(' ').replace(/[^\p{L}\p{N}\s'-]/gu,'')));
 return chunks.filter(Boolean);
}
/** List items when the sentence has a list ("messages, tasks and deadlines"), else []. */
export function listIn(sentence:string,max=4){
 const clean=sentence.replace(/[.!?؟]+$/,'').trim();
 const parts=clean.split(/\s*(?:,|،|;|؛|\band\b|\bor\b|\s+و\s+|\s+و(?=ال))\s*/i).map(p=>p.trim()).filter(p=>p.length>1);
 if(parts.length<2||!parts.slice(1).every(p=>p.split(/\s+/).length<=4))return [];
 return phrasesIn(sentence,max);
}
/** The words around a figure: "Teams using Flowly ship 40% faster" → "Faster". */
export function captionFor(sentence:string){
 const s=toAscii(sentence).replace(/[.!?؟]+$/,'');const m=s.match(/[$€£]?\d[\d.,]*\s?(%|x|×|k|m|\+)?(\s?(percent|times))?/i);
 if(!m)return '';const after=s.slice(m.index!+m[0].length).trim().split(/\s+/).filter(Boolean).slice(0,4).join(' ');
 const before=s.slice(0,m.index).trim().split(/\s+/).filter(Boolean).slice(-4).join(' ');
 return cap(after.split(/\s+/).length>=1&&after?after:before);
}
/** Icon for a phrase by meaning (the composed pieces' icon set). */
export function iconFor(text:string,i:number){
 const t=text.toLowerCase();
 const map:[RegExp,string][]=[[/sun|solar|light|day|خۆر|شمس|خورشید/,'sun'],[/energy|power|electric|charge|وزە|طاقة|انرژی/,'bolt'],[/battery|باتری|بطارية/,'battery'],[/car|drive|vehicle|ئۆتۆمبێل|سيارة|ماشین/,'car'],
  [/money|save|saving|dollar|cost|cheap|پارە|مال|پول/,'money'],[/water|rain|ئاو|ماء|آب/,'water'],[/health|heart rate|doctor|تەندروست|صحة|سلامت/,'heartbeat'],[/learn|book|read|course|school|فێر|تعلم|آموزش/,'book'],
  [/work|job|business|office|کار|عمل|کسب/,'briefcase'],[/ship|deliver|order|parcel|گەیاندن|توصيل|ارسال/,'truck'],[/goal|target|aim|focus|ئامانج|هدف/,'target'],[/planet|earth|world|global|جیهان|عالم|جهان/,'globe'],[/home|house|roof|ماڵ|منزل|خانه/,'home'],[/green|nature|eco|clean|plant|سەوز|بيئة|سبز/,'leaf'],
  [/fast|speed|quick|instant|خێرا|سريع|سریع/,'bolt'],[/secur|safe|privacy|protect|پارێز|آمن|امن/,'shield'],[/team|people|user|customer|تیم|فريق|تیم/,'users'],
  [/love|happy|care|دڵ|حب|عشق/,'heart'],[/chat|message|reply|نامە|رسال|پیام/,'chat'],[/price|pay|money|card|cost|پارە|سعر|قیمت/,'card'],[/time|hour|minute|clock|کات|وقت|زمان/,'clock'],
  [/global|world|country|جیهان|عالم|جهان/,'globe'],[/grow|chart|data|report|insight|گەشە|نمو|رشد/,'chart'],[/search|find|discover|گەڕان|بحث|جستجو/,'search'],[/ai|smart|auto|magic|زیرەک|ذكي|هوشمند/,'sparkle'],
  [/mobile|app|phone|مۆبایل|هاتف|موبایل/,'phone'],[/mail|inbox|ئیمەیڵ|بريد|ایمیل/,'mail'],[/calendar|date|schedule|ڕۆژ|موعد|تقویم/,'calendar'],[/award|best|win|trophy|خەڵات|جائزة|جایزه/,'trophy'],
  [/code|develop|api|کۆد|برمج|کد/,'code'],[/launch|ship|start|rocket|بڵاو|إطلاق|عرضه/,'rocket'],[/gift|reward|free|دیاری|هدية|هدیه/,'gift'],[/cloud|sync|هەور|سحاب|ابر/,'cloud'],[/lock|password|قفل/,'lock']];
 return map.find(([r])=>r.test(t))?.[1]??['sparkle','bolt','heart'][i%3]!;
}
/** The heart of a sentence in a few words: its fullest clause, fillers dropped, at most six words. */
export function keyPhrase(sentence:string){
 const clauses=sentence.replace(/[.!?؟]+$/,'').split(/\s*[,;:—–]\s*|\s+-\s+/).filter(Boolean);
 const best=clauses.sort((a,b)=>b.split(/\s+/).filter(w=>!STOP.has(w.toLowerCase())).length-a.split(/\s+/).filter(w=>!STOP.has(w.toLowerCase())).length)[0]??sentence;
 const words=best.split(/\s+/);const lead=words.findIndex(w=>!STOP.has(w.toLowerCase()));
 return cap(words.slice(Math.max(0,lead),Math.max(0,lead)+6).join(' '));
}

const cap=(s:string)=>s?s[0]!.toUpperCase()+s.slice(1):s;
const clip=(s:string,n:number)=>s.length<=n?s:s.slice(0,n-1).trimEnd()+'…';

/** Splits a script into one sentence per line (keeps lines that are already split). */
export function splitSentences(script:string){
 const lines=script.replace(/\r\n/g,'\n').split('\n').map(l=>l.trim()).filter(Boolean);
 return lines.flatMap(l=>l.split(/(?<=[.!?؟])\s+(?=\S)/u).map(s=>s.trim()).filter(Boolean));
}

const GENERAL=new Set(['sparkle','bolt','heart']);
/** Designs a visual for each line, from zero: what the line means picks the composition, and only
 *  its words, numbers and matching icons fill it. Scenes in one video use different compositions. */
export function designScenes(lines:string[],o:{seed:string;genome?:Genome;learned?:Record<string,number>}):Plan[]{
 const transitions=o.genome?.transitions??['wipe','push','fade'];const taken:string[]=[];
 return lines.map(l=>l.trim()).map((sentence,index)=>{
  const role=classifyRole(sentence,index,lines.length),nums=numbersIn(sentence),list=listIn(sentence);
  const num=role!=='calendar'?nums[0]:undefined;
  const label=num?(captionFor(sentence)||keyPhrase(sentence)):keyPhrase(sentence);
  const items=(list.length>=2?list:phrasesIn(sentence,3)).map(x=>clip(x,24));
  const d=designPiece(sentence,{seed:o.seed,role,label,items,num,icon:iconFor,taken,learned:o.learned});taken.push(d.archetype);
  const piece=pieceSchema.parse({kind:'compose',layers:d.layers,designed:{archetype:d.archetype,description:d.description},transition:transitions[index%transitions.length]});
  const general=d.layers.filter(l=>l.type==='icon'&&GENERAL.has(String(l.icon))&&!/^(sparkle)$/.test(String(l.icon))||l.type==='icon'&&l.icon==='sparkle'&&(l.w as number)>.07).length;
  const check=general?['An icon is a general mark (no word in the sentence names one); swap it if a better one fits.']:[];
  return {index,sentence,role,piece,why:`Designed for this sentence (${role}): ${d.description}`,check};
 });
}

export type StoryboardOptions={
 /** The new style designed for this video (by the CLI); it goes into the request so the approved look is the rendered one. */
 genome?:Genome;styleWhy?:string[];soundKit?:string;learned?:Record<string,number>;seed?:string};
export function storyboard(script:string,o:StoryboardOptions={}){
 const sentences=splitSentences(script);
 if(!sentences.length)throw new Error('The script is empty');
 const language=detectLanguage(script);
 const plans=designScenes(sentences,{seed:o.seed??o.genome?.id??'storyboard',genome:o.genome,learned:o.learned});
 const title=clip(sentences[0]!.replace(/[.!?؟]+$/,''),60);
 const request={schemaVersion:1,title,preset:'kinetic',aspectRatio:'9:16',script:sentences.join('\n'),
  ...(o.genome?{pieceGenome:o.genome}:{}),...(o.soundKit?{soundKit:o.soundKit}:{}),
  sceneVisuals:plans.map(pl=>({match:matchFor(pl.sentence),piece:pl.piece})),thumbnail:{title}};
 return {language,scenes:plans.length,request,plans,style:o.genome?.name,genome:o.genome,styleWhy:o.styleWhy??[],soundKit:o.soundKit??(o.genome?o.genome.sound.kit+' (the style\'s)':'auto')};
}
/** A few distinctive words of the sentence for `match` (unique enough, short). */
function matchFor(sentence:string){
 const words=sentence.replace(/[.!?؟]+$/,'').split(/\s+/).filter(Boolean);
 return words.slice(0,Math.min(6,words.length)).join(' ');
}

export function storyboardMarkdown(sb:ReturnType<typeof storyboard>){
 const rows=sb.plans.map(p=>`| ${p.index+1} | ${p.sentence.replace(/\|/g,'/')} | ${p.role} | ${p.piece.designed?.archetype??'composed'} | ${p.piece.transition} | ${p.why.replace(/\|/g,'/')} |`);
 const checks=sb.plans.flatMap(p=>p.check.map(c=>`- Scene ${p.index+1}: ${c}`));
 return `# Storyboard: ${sb.request.title}

Style: **${sb.style??'designed when the video is made'}** · Sound: **${sb.soundKit}** · Scenes: **${sb.scenes}** · Language: **${sb.language}**
${sb.style?`\nWhy this style: ${sb.styleWhy.join('; ')||'a new style for this video'}. It was generated from zero for this video and differs from every earlier one; run the storyboard again for another, or describe the look you want.\n`:''}
| # | Sentence | Meaning | Composition | Transition in | Why |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Check before rendering

${checks.length?checks.join('\n'):'- Nothing guessed: every visual uses only the sentence\'s own words and numbers.'}

Approve, or say what to change (any scene's visual, its words, numbers or the look).
`;
}
