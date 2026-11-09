// Automatic storyboard: script in, a ready video request out. Each sentence becomes one scene;
// its meaning (problem, product reveal, tasks, tracking, growth, a number, support, team,
// steps, call to action) picks an animated scene piece, filled from the sentence's own words
// and numbers. The genre recipe from the brain shapes the order and the device (phone or
// browser). Everything the agent guessed is listed for the user to check before rendering.
import {pieceSchema,type Piece} from './scene-pieces-schema.js';
import {detectLanguage,isRtl} from './languages.js';
import {skins} from '../components/pieces/skins.js';
import type {Genome} from '../components/pieces/genome.js';
import {assignLayouts} from '../components/pieces/layouts.js';
import {listTemplatesSync,fill,vary,type Template} from './composed-pieces.js';

export type Role='hook'|'problem'|'reveal'|'tasks'|'done'|'track'|'growth'|'number'|'speed'|'support'|'team'|'steps'|'alerts'|'cta'|'explain'|'pricing'|'quote'|'logos'|'calendar'|'map'|'compare'|'form'|'download';
export type Genre='saas-promo'|'app-launch'|'explainer'|'product-ad'|'tutorial'|'general';
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
 ['tasks',/\b(assign|assigns|task|tasks|to-?do|organi[sz]e|schedule|plan|planning|projects?|workflow|automate|automatically|delegate)\w*|ئەرک|کار|ڕێکخستن|مهام|مهمة|وزّع|نظّم|جدول|مشروع|مشاريع|وظایف|کارها|تکلیف|سازماندهی|پروژه/],
 ['speed',/\b(minutes?|seconds?|hours?|instantly|faster|fast|quick|quickly|in no time)\b|خولەک|چرکە|خێرا|دقائق|دقيقة|ثوان|ثواني|ساعات|أسرع|سريع|فوراً|دقیقه|ثانیه|سریع|سریع‌تر|فوری/],
 ['team',/\b(team|teams|together|collaborat\w*|people|everyone|community|customers|clients|users)\b|تیم|هاوکاری|کڕیار|فريق|فريقك|معاً|عملاء|العملاء|تیم|همکاری|مشتریان|کاربران/],
 ['steps',/\b(step|steps|first|then|finally|easy|simple|three|3 ways)\b|هەنگاو|سەرەتا|پاشان|خطوة|خطوات|أولاً|أخيراً|سهل|مرحله|گام|ابتدا|سپس|آسان/],
];
const NUMBER_WORDS:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,
 twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100,thousand:1000,million:1e6};
const toAscii=(s:string)=>s.replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0)).replace(/٪/g,'%').replace(/٫/g,'.');
export type Num={value:number;prefix?:string;suffix?:string;decimals:number};
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
export function detectGenre(script:string):Genre{
 const s=script.toLowerCase();
 if(/\b(app store|google play|download the app|mobile app|on your phone|iphone|android)\b/.test(s))return 'app-launch';
 if(/ئەپ|مۆبایل|ئایفۆن|ئەندرۆید/.test(s))return 'app-launch';
 if(/تیم|ئەرک|پڕۆژە|داشبۆرد/.test(s))return 'saas-promo';
 if(/\b(saas|software|platform|dashboard|workspace|team|teams|tasks|workflow|crm|tool)\b/.test(s))return 'saas-promo';
 if(/\b(step|steps|how to|tutorial|learn)\b/.test(s))return 'tutorial';
 if(/\b(buy|shop|order|price|discount|sale|product)\b/.test(s))return 'product-ad';
 if(/\b(why|how|what is|because|explain)\b/.test(s))return 'explainer';
 return 'general';
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
 const words=clean.split(/\s+/).filter(w=>!STOP.has(w.toLowerCase().replace(/[^\p{L}]/gu,''))&&w.replace(/[^\p{L}\p{N}]/gu,'').length>2);
 const chunks:string[]=[];for(let i=0;i<words.length&&chunks.length<max;i+=2)chunks.push(cap(words.slice(i,i+2).join(' ').replace(/[^\p{L}\p{N}\s'-]/gu,'')));
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
 const map:[RegExp,string][]=[[/fast|speed|quick|instant|خێرا|سريع|سریع/,'bolt'],[/secur|safe|privacy|protect|پارێز|آمن|امن/,'shield'],[/team|people|user|customer|تیم|فريق|تیم/,'users'],
  [/love|happy|care|دڵ|حب|عشق/,'heart'],[/chat|message|reply|نامە|رسال|پیام/,'chat'],[/price|pay|money|card|cost|پارە|سعر|قیمت/,'card'],[/time|hour|minute|clock|کات|وقت|زمان/,'clock'],
  [/global|world|country|جیهان|عالم|جهان/,'globe'],[/grow|chart|data|report|insight|گەشە|نمو|رشد/,'chart'],[/search|find|discover|گەڕان|بحث|جستجو/,'search'],[/ai|smart|auto|magic|زیرەک|ذكي|هوشمند/,'sparkle'],
  [/mobile|app|phone|مۆبایل|هاتف|موبایل/,'phone'],[/mail|inbox|ئیمەیڵ|بريد|ایمیل/,'mail'],[/calendar|date|schedule|ڕۆژ|موعد|تقویم/,'calendar'],[/award|best|win|trophy|خەڵات|جائزة|جایزه/,'trophy'],
  [/code|develop|api|کۆد|برمج|کد/,'code'],[/launch|ship|start|rocket|بڵاو|إطلاق|عرضه/,'rocket'],[/gift|reward|free|دیاری|هدية|هدیه/,'gift'],[/cloud|sync|هەور|سحاب|ابر/,'cloud'],[/lock|password|قفل/,'lock']];
 return map.find(([r])=>r.test(t))?.[1]??['sparkle','bolt','heart'][i%3]!;
}
/** A saved piece filled for this sentence and varied for this video (never reused as is). */
let varySeed='storyboard';
const varied=(t:Template,v:Record<string,string|number>)=>vary(fill(t,v),varySeed+':'+t.name+':'+Object.values(v).join('|'));
function templateNamed(name:string){const t=listTemplatesSync().find(x=>x.name===name);if(!t)throw new Error('Missing saved piece '+name);return t;}
/** The saved composed piece whose tags best fit the sentence (two or more matching words). */
export function templateFor(sentence:string){
 const w=new Set(sentence.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).flatMap(x=>[x,x.replace(/s$/,'')]));
 const scored=listTemplatesSync().map(t=>({t,hits:t.tags.filter(g=>w.has(g.toLowerCase())).length})).filter(x=>x.hits>=2).sort((a,b)=>b.hits-a.hits);
 return scored[0]?.t;
}
/** Fills a template's variables from the sentence where the names say what they are. */
function withVars(t:Template,sentence:string,list:string[],nums:Num[],product:string,_T:unknown){
 const v:Record<string,string|number>={};const n=nums[0];let li=0;
 for(const k of Object.keys(t.vars)){
  if(/^value$/.test(k)&&n)v[k]=n.value;else if(/^prefix$/.test(k)&&n)v[k]=n.prefix??'';else if(/^suffix$/.test(k)&&n)v[k]=n.suffix??'';
  else if(/^(label|subtitle)$/.test(k))v[k]=clip(captionFor(sentence)||sentence,40);else if(/^title$/.test(k))v[k]=clip(product,40);
  else if(/^(step|label|point|item)\d$/.test(k)&&list[li])v[k]=clip(list[li++]!,24);else if(/^icon\d?$/.test(k))v[k]=iconFor(list[Number(k.slice(4)||1)-1]??sentence,li);
 }
 return varied(t,v);
}
const cap=(s:string)=>s?s[0]!.toUpperCase()+s.slice(1):s;
const clip=(s:string,n:number)=>s.length<=n?s:s.slice(0,n-1).trimEnd()+'…';

export type StoryboardOptions={genre?:Genre|'auto';product?:string;people?:string[];device?:'auto'|'phone'|'browser';url?:string;
 /** The pieces' design style (chosen by the CLI from the brief, brand, brain and recent videos). */
 style?:string;styleWhy?:string[];soundKit?:string;
 /** The new style designed for this video (bred by the CLI); it goes into the request so the approved look is the rendered one. */
 genome?:Genome};
const SAMPLE_PEOPLE=['Sara','Omar','Lena','Dara'];
/** Example words for the parts a sentence does not give (flagged for the user to check). */
const SAMPLES={
 en:{starter:'Starter',pro:'Pro',perMonth:'/mo',features:['Unlimited projects','Live dashboards','Priority support'],quoteName:'Sara A.',quoteRole:'Customer',calendar:'This month',weekdays:undefined as string[]|undefined,event:'Launch',pickup:'Pickup',dropoff:'Drop-off',after:'After',beforePoints:['Spreadsheets','Lost emails','Missed deadlines'],afterPoints:['One workspace','Every task tracked','On time'],fields:[['Name','Sara Ali'],['Email','sara@company.com']],signup:'Sign up',welcomeShort:'Welcome!',dlSub:['Download on the','Get it on'],popular:'Popular',trusted:'Trusted by teams at',
  apps:['Slack','Mail','Calendar'],tasksDone:'Tasks done',onTime:'On time',onTrack:'Projects on track',updates:'Updates today',overview:'Overview',growth:'Growth',
  tasks:['Plan the launch','Review designs','Fix login bug'],timeSaved:'Time saved',before:'Before',with:(p:string)=>`With ${p}`,messages:'Messages',
  chat:['Can you help with my order?','Done! It\'s on its way.','Wow, that was fast 🙌'],team:'Your whole team',welcome:(p:string)=>`Welcome to ${p}!`,trial:'Your free trial has started.',
  cta:['Sign up in seconds','Invite your team','Start free']},
 ckb:{starter:'سەرەتایی',pro:'پرۆ',perMonth:'/مانگ',features:['پڕۆژەی بێسنوور','داشبۆردی ڕاستەوخۆ','پشتگیری خێرا'],quoteName:'سارا عەلی',quoteRole:'کڕیار',calendar:'ئەم مانگە',weekdays:['ش','ی','د','س','چ','پ','ه'],event:'بڵاوکردنەوە',pickup:'وەرگرتن',dropoff:'گەیاندن',after:'دواتر',beforePoints:['خشتەی ئێکسڵ','ئیمەیڵی ونبوو','کاتی دواکەوتوو'],afterPoints:['یەک شوێنی کار','هەموو ئەرکێک دیارە','لە کاتی خۆیدا'],fields:[['ناو','سارا عەلی'],['ئیمەیڵ','sara@company.com']],signup:'خۆتۆمارکردن',welcomeShort:'بەخێربێیت!',dlSub:['داونلۆد لە','دایبگرە لە'],popular:'باوترین',trusted:'متمانەپێکراوی تیمەکانی',
  apps:['نامە','ئیمەیڵ','ڕۆژژمێر'],tasksDone:'ئەرکی تەواوکراو',onTime:'لە کاتی خۆیدا',onTrack:'پڕۆژەی ڕێکوپێک',updates:'نوێکاری ئەمڕۆ',overview:'پوختە',growth:'گەشە',
  tasks:['پلانی بڵاوکردنەوە','پێداچوونەوەی دیزاین','چاککردنی هەڵە'],timeSaved:'کاتی پاشەکەوتکراو',before:'پێشتر',with:(p:string)=>`لەگەڵ ${p}`,messages:'نامەکان',
  chat:['دەتوانن یارمەتیم بدەن؟','تەواو! لە ڕێگادایە.','وای، چەند خێرا بوو 🙌'],team:'هەموو تیمەکەت',welcome:(p:string)=>`بەخێربێیت بۆ ${p}!`,trial:'تاقیکردنەوەی بەخۆڕاییت دەستی پێکرد.',
  cta:['خۆتۆمارکردن لە چەند چرکەیەکدا','تیمەکەت بانگهێشت بکە','بەخۆڕایی دەست پێبکە']},
 ar:{starter:'الأساسية',pro:'الاحترافية',perMonth:'/شهرياً',features:['مشاريع غير محدودة','لوحات مباشرة','دعم سريع'],quoteName:'سارة علي',quoteRole:'عميلة',calendar:'هذا الشهر',weekdays:['س','ح','ن','ث','ر','خ','ج'],event:'الإطلاق',pickup:'الاستلام',dropoff:'التسليم',after:'بعد',beforePoints:['جداول متفرقة','رسائل ضائعة','مواعيد فائتة'],afterPoints:['مساحة عمل واحدة','كل مهمة واضحة','في الموعد'],fields:[['الاسم','سارة علي'],['البريد','sara@company.com']],signup:'سجّل',welcomeShort:'أهلاً بك!',dlSub:['حمّله من','احصل عليه من'],popular:'الأكثر طلباً',trusted:'تثق به فرق في',
  apps:['الرسائل','البريد','التقويم'],tasksDone:'مهام منجزة',onTime:'في الموعد',onTrack:'مشاريع على المسار',updates:'تحديثات اليوم',overview:'نظرة عامة',growth:'النمو',
  tasks:['خطة الإطلاق','مراجعة التصاميم','إصلاح خطأ الدخول'],timeSaved:'الوقت الموفَّر',before:'قبل',with:(p:string)=>`مع ${p}`,messages:'الرسائل',
  chat:['هل يمكنكم مساعدتي في طلبي؟','تم! طلبك في الطريق.','واو، كان ذلك سريعاً 🙌'],team:'فريقك بالكامل',welcome:(p:string)=>`مرحباً بك في ${p}!`,trial:'بدأت تجربتك المجانية.',
  cta:['سجّل في ثوانٍ','ادعُ فريقك','ابدأ مجاناً']},
 fa:{starter:'پایه',pro:'حرفه‌ای',perMonth:'/ماه',features:['پروژه‌ی نامحدود','داشبورد زنده','پشتیبانی سریع'],quoteName:'سارا علوی',quoteRole:'مشتری',calendar:'این ماه',weekdays:['ش','ی','د','س','چ','پ','ج'],event:'عرضه',pickup:'مبدأ',dropoff:'مقصد',after:'بعد',beforePoints:['صفحه‌گسترده‌ها','ایمیل‌های گم‌شده','مهلت‌های ازدست‌رفته'],afterPoints:['یک فضای کاری','همه‌ی کارها پیداست','به‌موقع'],fields:[['نام','سارا علوی'],['ایمیل','sara@company.com']],signup:'ثبت‌نام',welcomeShort:'خوش آمدید!',dlSub:['دریافت از','دانلود از'],popular:'محبوب',trusted:'مورد اعتماد تیم‌های',
  apps:['پیام‌ها','ایمیل','تقویم'],tasksDone:'کارهای انجام‌شده',onTime:'به‌موقع',onTrack:'پروژه‌های در مسیر',updates:'به‌روزرسانی‌های امروز',overview:'نمای کلی',growth:'رشد',
  tasks:['برنامه‌ی عرضه','بررسی طرح‌ها','رفع خطای ورود'],timeSaved:'زمان صرفه‌جویی‌شده',before:'قبل',with:(p:string)=>`با ${p}`,messages:'پیام‌ها',
  chat:['می‌توانید در سفارشم کمکم کنید؟','انجام شد! در راه است.','وای، چه سریع بود 🙌'],team:'کل تیم شما',welcome:(p:string)=>`به ${p} خوش آمدید!`,trial:'دوره‌ی آزمایشی رایگان شما شروع شد.',
  cta:['ثبت‌نام در چند ثانیه','تیمت را دعوت کن','رایگان شروع کن']},
};
const TRANSITIONS:Record<Genre,Piece['transition'][]>={'saas-promo':['wipe','push','mask-reveal'],'app-launch':['circle-reveal','push','wipe'],explainer:['wipe','mask-reveal','fade'],'product-ad':['zoom-through','push','wipe'],tutorial:['push','wipe','fade'],general:['wipe','push','mask-reveal']};

/** Splits a script into one sentence per line (keeps lines that are already split). */
export function splitSentences(script:string){
 const lines=script.replace(/\r\n/g,'\n').split('\n').map(l=>l.trim()).filter(Boolean);
 return lines.flatMap(l=>l.split(/(?<=[.!?؟])\s+(?=\S)/u).map(s=>s.trim()).filter(Boolean));
}

export function storyboard(script:string,o:StoryboardOptions={}){
 const sentences=splitSentences(script);
 if(!sentences.length)throw new Error('The script is empty');
 const genre:Genre=!o.genre||o.genre==='auto'?detectGenre(script):o.genre;
 const product=o.product?.trim()||'Your app';
 const people=(o.people?.length?o.people:SAMPLE_PEOPLE).slice(0,4);
 const device=o.device&&o.device!=='auto'?o.device:genre==='app-launch'?'phone':'browser';
 const url=o.url??`${product.toLowerCase().replace(/[^a-z0-9]+/g,'')||'app'}.com`;
 const language=detectLanguage(script),rtl=isRtl(language,script);
 // Transitions follow the design style (a neon video snaps, an editorial one fades); else the genre.
 varySeed=(o.genome?.id??'storyboard')+':'+sentences.length;
 const transitions=o.genome?o.genome.transitions:o.style&&skins[o.style]?skins[o.style]!.transitions:TRANSITIONS[genre];
 const T=!rtl?SAMPLES.en:language==='ar'?SAMPLES.ar:language==='fa'?SAMPLES.fa:SAMPLES.ckb;
 const plans:Plan[]=[];let previous='';
 sentences.forEach((sentence,index)=>{
  let role=classifyRole(sentence,index,sentences.length);
  const nums=numbersIn(sentence),list=listIn(sentence),bits=list.length?list:phrasesIn(sentence);
  const check:string[]=[];let why='';let p:Record<string,unknown>;
  const wrap=(screen:Record<string,unknown>)=>device==='phone'?{kind:'phone',app:clip(product,30),screen,tilt:index%2?4:-4}:{kind:'browser',url:clip(url,60),screen};
  switch(role){
   case 'problem':case 'hook':case 'alerts':{
    const items=(bits.length?bits:[clip(sentence,40)]).slice(0,3).map((b,i)=>({app:T.apps[i]!,title:clip(b,60)}));
    p={kind:'notifications',items};why=role==='alerts'?'Reminders and alerts are shown as notifications arriving.':'A problem or hook: notifications pile up to show the pressure.';
    check.push('App names (Slack, Mail, Calendar) are examples; change them to the tools your audience uses.');break;}
   case 'reveal':{
    p=wrap({kind:'dashboard',title:clip(product,40),stats:[{label:T.tasksDone,value:nums[0]?.value??128,trend:'up'},{label:T.onTime,value:96,suffix:'%',trend:'up'}],chart:{type:'line',values:[12,18,15,26,31,38,44]}});
    p.cursor={path:[{x:.35,y:.45,at:1.1},{x:.7,y:.42,at:1.7,click:true}]};
    why=`The product appears in a ${device} mockup with a live dashboard and a cursor click.`;
    check.push('The dashboard numbers (128, 96%) and the chart are illustrative; replace them with real figures or keep them clearly as a demo.');break;}
   case 'tasks':case 'done':{
    if(!list.length)check.push('Task titles are examples; change them to real work your audience knows.');
    const tasks=(list.length?list:T.tasks).slice(0,3).map((t,i)=>({title:clip(t,60),assignee:people[i%people.length]}));
    p={kind:'tasks',tasks,people:people.slice(0,Math.min(3,people.length)).map(name=>({name})),flow:role==='done'?'complete':'assign'};
    why=role==='done'?'Work being finished: task cards tick off one by one.':'Work being organised: task cards fly to the people they belong to.';
    if(!o.people?.length)check.push(`People (${people.slice(0,3).join(', ')}) are sample names; use your team's or keep them generic.`);break;}
   case 'track':{p=wrap({kind:'dashboard',title:T.overview,stats:[{label:clip(list[0]??T.onTrack,30),value:nums[0]?.value??87,suffix:nums[0]?.suffix??'%',trend:'up'},{label:clip(list[1]??T.updates,30),value:24,trend:'none'}],chart:{type:'line',values:[8,14,13,22,27,33,41]}});
    why='Seeing and tracking: a live dashboard with counting numbers and a drawing chart.';check.push('Dashboard numbers are illustrative unless the sentence states them.');break;}
   case 'growth':{const n=nums[0]!;const end=n.suffix==='%'?100+n.value:n.value;const start=Math.max(1,Math.round(end/(n.suffix==='%'?1+n.value/100:2.2)));
    p={kind:'chart',type:'bar',title:clip(captionFor(sentence)||T.growth,40),values:[start,Math.round(start+(end-start)*.35),Math.round(start+(end-start)*.65),Math.round(end)],labels:['Q1','Q2','Q3','Q4'],...(n.suffix&&n.suffix!=='%'?{unit:n.suffix}:{})};
    why='Growth: bars rise to the final value; the last one is highlighted.';check.push(`The chart's earlier bars and the Q1–Q4 labels are illustrative; only the change (${n.prefix??''}${n.value}${n.suffix??''}) comes from the sentence.`);break;}
   case 'number':case 'speed':{const n=nums[0];
    if(role==='speed'&&!n){p={kind:'progress',title:T.timeSaved,items:[{label:T.before,value:100},{label:T.with(clip(product,20)),value:25}]};check.push('Before/after values are illustrative.');}
    else if(n&&previous!=='compose'){p=varied(templateNamed('stat-hero'),{value:n.value,prefix:n.prefix??'',suffix:n.suffix??'',label:clip(captionFor(sentence)||sentence,40),icon:iconFor(sentence,0)});}
    else{p={kind:'counter',to:n?.value??100,...(n?.prefix?{prefix:n.prefix}:{}),...(n?.suffix?{suffix:n.suffix}:{}),decimals:n?.decimals??0,caption:clip(captionFor(sentence),60)||undefined};}
    why=role==='speed'?'Speed: the time counts or shrinks on screen.':'One number, counted up big.';break;}
   case 'support':{
    p=device==='phone'||genre!=='saas-promo'?{kind:'phone',app:T.messages,screen:{kind:'chat',messages:[{from:'them',text:T.chat[0]!},{from:'me',text:T.chat[1]!},{from:'them',text:T.chat[2]!}]},tilt:-4}
     :{kind:'browser',url:clip(url,60),screen:{kind:'chat',messages:[{from:'them',text:T.chat[0]!},{from:'me',text:T.chat[1]!}]}};
    why='Customers and replies: a chat with typing dots and quick answers.';check.push('The chat messages are examples; write them in your brand voice'+(rtl?' and language.':'.'));break;}
   case 'team':{p={kind:'avatars',people:people.slice(0,4).map(name=>({name})),caption:clip(list[0]??T.team,60)};why='People: the team appears together.';
    if(!o.people?.length)check.push('Sample names; use real names or initials only with permission.');break;}
   case 'steps':case 'explain':{
    // A saved composed piece whose tags fit the sentence wins (the agent's own designs come back).
    const saved=templateFor(sentence);
    if(saved){p=withVars(saved,sentence,list,nums,product,T);why=`A composed piece made for this kind of sentence ("${saved.name}": ${saved.description})`;check.push(`Composed piece "${saved.name}": check its words and numbers.`);break;}
    if(role==='steps'&&list.length===3){p=withVars(templateNamed('step-flow'),sentence,list,nums,product,T);why='Steps: three numbered points joined by a line that draws through them.';break;}
    if(list.length>=2){const t=templateNamed('icon-trio');const items=list.slice(0,3);while(items.length<3)items.push(items[items.length-1]!);
     p=varied(t,Object.fromEntries(items.flatMap((x,i)=>[['label'+(i+1),clip(x,24)],['icon'+(i+1),iconFor(x,i)]])));why='Points of the sentence as three icon tiles.';
     check.push('Icons are picked from the words; change any that do not fit.');break;}
    const items=phrasesIn(sentence,3).slice(0,3);check.push('Checklist items are key words from the sentence; rewrite them as short points.');
    p={kind:'checklist',items:items.length?items.map(t=>clip(t,60)):[clip(sentence,60)]};why='Points of the sentence tick off as a checklist.';break;}
   case 'pricing':{
    const prices=nums.filter(n=>!n.suffix||n.suffix==='k').map(n=>n.value).slice(0,2),free=/\b(free)\b|بەخۆڕایی|مجان|رایگان/i.test(sentence);
    const per=/month|\/mo|مانگ|شهر|ماه/i.test(sentence)?T.perMonth:undefined,prefix=nums.find(n=>n.prefix)?.prefix??'$';
    const values=prices.length?(free&&prices.length===1?[0,prices[0]!]:prices):[0,12];
    const feats=list.length?list.slice(0,3):T.features;
    p={kind:'pricing',plans:values.map((v,i)=>({name:i===values.length-1&&values.length>1?T.pro:T.starter,price:v,prefix,...(per?{period:per}:{}),features:i===values.length-1?feats:feats.slice(0,1),
     highlight:i===values.length-1&&values.length>1,...(i===values.length-1&&values.length>1?{badge:T.popular}:{})})),cta:T.signup};
    why='Prices: plan cards rise, the price counts up and the features tick in.';
    if(!prices.length)check.push('Prices (0 and 12) are examples; use your real prices.');
    check.push('Plan names and features are '+(list.length?'from the sentence where it lists them; check the rest.':'examples; use your real plans.'));break;}
   case 'quote':{
    const m=sentence.match(/["“«]([^"“”«»]{8,})["”»]/);const text=clip((m?m[1]!:sentence).trim(),220);
    p={kind:'quote',text,name:T.quoteName,role:T.quoteRole,rating:5};why='What customers say: a review card with the words appearing, stars and the person.';
    check.push('Use a real customer\'s words, name and role, with their permission; the name and the 5-star rating are examples.');break;}
   case 'logos':{
    p={kind:'logos',title:clip(list.length?T.trusted:captionFor(sentence)||T.trusted,60),items:['Brightloop','Quillo','Nexora','Fernway','Tidewell','Ombra'].map(name=>({name}))};
    why='Social proof: a wall of customer logos lighting up one by one.';
    check.push('The company names are invented placeholders; replace them with logos of customers you have permission to show (as assets).');break;}
   case 'calendar':{
    const days=nums.map(n=>n.value).filter(v=>Number.isInteger(v)&&v>=1&&v<=31).slice(0,3);
    const words=sentence.replace(/[.!?؟]+$/,'').split(/\s+/).filter(w=>!/\d/.test(w)&&!STOP.has(w.toLowerCase())&&w.replace(/[^\p{L}]/gu,'').length>2);
    const labels=[words.length?cap(words.slice(0,2).join(' ').replace(/[^\p{L}\p{N}\s'-]/gu,'')):T.event];
    const events=(days.length?days:[14]).map((day,i)=>({day,label:clip(labels[i]??labels[0]!,40)}));
    p={kind:'calendar',title:T.calendar,days:30,firstDay:2,...(T.weekdays?{weekdays:T.weekdays}:{}),events,highlight:events.at(-1)!.day};
    why='Dates and scheduling: a month appears and the events land on their days.';
    check.push(days.length?'Event names come from key words of the sentence; check them.':'The date (14th) and event name are examples; use the real dates.');break;}
   case 'map':{
    const route=/deliver|route|pickup|from .+ to|گەیاندن|توصيل|تحویل/i.test(sentence);
    const names=list.length>=2?list:[T.pickup,T.dropoff];
    p={kind:'map',pins:names.slice(0,4).map((label,i)=>({x:[.24,.72,.5,.82][i]!,y:[.64,.3,.48,.7][i]!,label:clip(label,30)})),route};
    why=route?'Delivery or a route: pins drop on a map and the route draws between them.':'Places: pins drop on a map.';
    check.push('The map is a stylised city, not a real place; pin positions are examples.');break;}
   case 'compare':{
    // "No more X, Y and Z" or "instead of X" lists the old way; otherwise the list is the new way.
    const old=/\b(no more|instead of|used to|before|without)\b|لەبری|بدلاً|بدون|به جای|بدون/i.test(sentence);
    const items=list.slice(0,3).map(x=>cap(x.replace(/^(no more|instead of|without)\s+/i,'')));
    p={kind:'compare',before:{label:T.before,points:old&&items.length?items:T.beforePoints},after:{label:T.after,points:!old&&items.length?items:T.afterPoints}};
    why='Before and after: a slider sweeps from the old way to the new one.';
    check.push('The before and after points are '+(list.length?'partly ':'')+'examples; use your own.');break;}
   case 'form':{
    p={kind:'form',fields:T.fields.map(([label,value])=>({label:label!,value:value!})),button:T.signup,done:T.welcomeShort};
    why='Signing up or filling in details: the fields type themselves and the button is pressed.';
    check.push('The name and email in the form are examples.');break;}
   case 'download':{
    const rating=nums.find(n=>n.value>0&&n.value<=5&&n.decimals)?.value;
    p={kind:'download',buttons:[{sub:T.dlSub[0]!,label:'App Store'},{sub:T.dlSub[1]!,label:'Google Play'}],...(rating?{rating}:{}),caption:clip(product,60)};
    why='Download the app: store buttons pop in and one is pressed'+(rating?', then the rating fills.':'.');
    check.push('These are generic store buttons; if the app is in the stores, you can use the official badges instead (an image asset).');break;}
   case 'cta':{
    p=device==='phone'?{kind:'phone',app:clip(product,30),screen:{kind:'notifications',items:[{app:clip(product,30),title:T.welcome(clip(product,40)),body:T.trial}]},tilt:0}
     :{kind:'browser',url:clip(url,60),screen:{kind:'checklist',title:clip(product,40),items:T.cta},cursor:{path:[{x:.4,y:.75,at:1.2},{x:.5,y:.82,at:1.8,click:true}]}};
    why='Call to action: the product opens and a click starts it; end on the brand.';check.push('Make sure the words on screen match your real offer (free trial, price).','Add the brand end card in an edit or keep the logo visible on the last scene.');break;}
  }
  // Avoid the same piece twice in a row: alternate a device frame or a different kind.
  const kind=String(p!.kind);
  if(kind===previous&&!['phone','browser'].includes(kind)&&['dashboard','chat','checklist','notifications','counter'].includes(kind)){p=wrap({...p!});why+=' (Shown inside a device frame for variety.)';}
  const piece=pieceSchema.parse({...p!,transition:index===0&&!o.style&&!o.genome?'zoom-through':transitions[index%transitions.length]});
  previous=String(piece.kind);
  plans.push({index,sentence,role,piece,why,check});
 });
 // Layouts are chosen with the style, so the storyboard shows (and the request keeps) what will render.
 if(o.genome)assignLayouts(plans.map(pl=>pl.piece as never),o.genome.id);
 const request={schemaVersion:1,title:clip(sentences[0]!.replace(/[.!?؟]+$/,''),60),preset:'kinetic',aspectRatio:'9:16',script:sentences.join('\n'),
  ...(o.genome?{pieceGenome:o.genome}:o.style?{pieceStyle:o.style}:{}),...(o.soundKit?{soundKit:o.soundKit}:{}),
  sceneVisuals:plans.map(pl=>({match:matchFor(pl.sentence),piece:pl.piece})),thumbnail:{title:clip(sentences[0]!.replace(/[.!?؟]+$/,''),60)}};
 return {genre,product,device,language,scenes:plans.length,request,plans,style:o.genome?.name??(o.style?skins[o.style]?.name??o.style:undefined),genome:o.genome,styleWhy:o.styleWhy??[],soundKit:o.soundKit??(o.genome?o.genome.sound.kit+' (the style\'s)':o.style&&skins[o.style]?skins[o.style]!.sound+' (the style\'s)':'auto')};
}
/** A few distinctive words of the sentence for `match` (unique enough, short). */
function matchFor(sentence:string){
 const words=sentence.replace(/[.!?؟]+$/,'').split(/\s+/).filter(Boolean);
 return words.slice(0,Math.min(6,words.length)).join(' ');
}

export function storyboardMarkdown(sb:ReturnType<typeof storyboard>,recipes:{id:string;title:string}[]=[]){
 const rows=sb.plans.map(p=>`| ${p.index+1} | ${p.sentence.replace(/\|/g,'/')} | ${p.role} | ${p.piece.kind}${'screen' in p.piece?` → ${p.piece.screen.kind}`:''}${((('screen' in p.piece?p.piece.screen:p.piece) as {layout?:string}).layout)?` (${(('screen' in p.piece?p.piece.screen:p.piece) as {layout?:string}).layout})`:''}${p.piece.cursor?' + cursor':''} | ${p.piece.transition} | ${p.why} |`);
 const checks=sb.plans.flatMap(p=>p.check.map(c=>`- Scene ${p.index+1}: ${c}`));
 return `# Storyboard: ${sb.request.title}

Genre: **${sb.genre}** · Style: **${sb.style??'designed when the video is made'}** · Sound: **${sb.soundKit}** · Device: **${sb.device}** · Product: **${sb.product}** · Scenes: **${sb.scenes}** · Language: **${sb.language}**
${sb.style?`\nWhy this style: ${sb.styleWhy.join('; ')||'a new style for this video'}.${sb.genome?' It is new: it is not one of the examples and differs from every earlier video\'s style. Ask for a different one, or name an example to start from (soft, glass, neon, brutal, editorial, clay, outline, pop).':''}\n`:''}${recipes.length?`\nRecipes and knowledge used: ${recipes.map(r=>`\`${r.id}\` (${r.title})`).join(', ')}\n`:''}
| # | Sentence | Meaning | Piece | Transition in | Why |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Check before rendering

${checks.length?checks.join('\n'):'- Nothing guessed; every piece uses only the sentence\'s own words and numbers.'}

Approve, or say what to change (any scene's piece, words, numbers, people, device).
`;
}
