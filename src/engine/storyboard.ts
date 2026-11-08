// Automatic storyboard: script in, a ready video request out. Each sentence becomes one scene;
// its meaning (problem, product reveal, tasks, tracking, growth, a number, support, team,
// steps, call to action) picks an animated scene piece, filled from the sentence's own words
// and numbers. The genre recipe from the brain shapes the order and the device (phone or
// browser). Everything the agent guessed is listed for the user to check before rendering.
import {pieceSchema,type Piece} from './scene-pieces-schema.js';
import {detectLanguage,isRtl} from './languages.js';

export type Role='hook'|'problem'|'reveal'|'tasks'|'done'|'track'|'growth'|'number'|'speed'|'support'|'team'|'steps'|'alerts'|'cta'|'explain';
export type Genre='saas-promo'|'app-launch'|'explainer'|'product-ad'|'tutorial'|'general';
export type Plan={index:number;sentence:string;role:Role;piece:Piece;why:string;check:string[]};

const has=(s:string,re:RegExp)=>re.test(s.toLowerCase());
const ROLE_RULES:[Role,RegExp][]=[
 ['cta',/\b(try|start|get started|sign up|signup|download|join|book a demo|visit|order now|free trial|today|link in bio|call us)\b|هەر ئێستا|داونلۆد|بەشداربە|سەردان/],
 ['alerts',/\b(notification|notifications|alert|alerts|reminder|reminders|remind|ping)\b|ئاگادار/],
 ['problem',/\b(drown|drowning|waste|wasted|losing|lose|lost|chaos|messy|manual|struggle|stuck|overwhelm|overwhelmed|too many|tired of|missed|miss|slow|pain|frustrat|juggl|endless|forget)\w*|کێشە|ماندوو|نقوم|پەرێشان|بێسەروبەر|شڵەژا|بێزار|ون دەبێت|دواکەوت/],
 ['support',/\b(reply|replies|answer|support|chat|message|messages|customers? ask|hear back|respond|inbox|conversation)\w*|نامە|وەڵام|پەیوەندی/],
 ['done',/\b(done|finished|complete|completed|checked|shipped|delivered|ready)\b|تەواو/],
 ['track',/\b(track|tracking|see|watch|dashboard|insight|insights|analytics|report|reports|real[- ]time|live|overview|monitor)\w*|بینین|ڕاپۆرت|چاودێری/],
 ['tasks',/\b(assign|assigns|task|tasks|to-?do|organi[sz]e|schedule|plan|planning|projects?|workflow|automate|automatically|delegate)\w*|ئەرک|کار|ڕێکخستن/],
 ['speed',/\b(minutes?|seconds?|hours?|instantly|faster|fast|quick|quickly|in no time)\b|خولەک|چرکە|خێرا/],
 ['team',/\b(team|teams|together|collaborat\w*|people|everyone|community|customers|clients|users)\b|تیم|هاوکاری|کڕیار/],
 ['steps',/\b(step|steps|first|then|finally|easy|simple|three|3 ways)\b|هەنگاو|سەرەتا|پاشان/],
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
 if(index===total-1&&total>1&&has(sentence,ROLE_RULES[0]![1]))return 'cta';
 const nums=numbersIn(sentence);
 if(nums.length){if(has(sentence,/\b(grew|grow|growth|increase|more|up|revenue|sales|boost|doubled|tripled)\b|زیاد|گەشە/))return 'growth';if(has(sentence,ROLE_RULES.find(r=>r[0]==='speed')![1]))return 'speed';return 'number';}
 if(has(sentence,/\b(meet|introducing|say hello|this is|with)\b|ئەمە|بناسە/)&&index<=2)return 'reveal';
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
 const parts=clean.split(/\s*(?:,|،|;|؛|\band\b|\bor\b|\s+و\s+)\s*/i).map(p=>p.trim()).filter(p=>p.length>1);
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
 const parts=clean.split(/\s*(?:,|،|;|؛|\band\b|\bor\b|\s+و\s+)\s*/i).map(p=>p.trim()).filter(p=>p.length>1);
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
const cap=(s:string)=>s?s[0]!.toUpperCase()+s.slice(1):s;
const clip=(s:string,n:number)=>s.length<=n?s:s.slice(0,n-1).trimEnd()+'…';

export type StoryboardOptions={genre?:Genre|'auto';product?:string;people?:string[];device?:'auto'|'phone'|'browser';url?:string};
const SAMPLE_PEOPLE=['Sara','Omar','Lena','Dara'];
/** Example words for the parts a sentence does not give (flagged for the user to check). */
const SAMPLES={
 en:{apps:['Slack','Mail','Calendar'],tasksDone:'Tasks done',onTime:'On time',onTrack:'Projects on track',updates:'Updates today',overview:'Overview',growth:'Growth',
  tasks:['Plan the launch','Review designs','Fix login bug'],timeSaved:'Time saved',before:'Before',with:(p:string)=>`With ${p}`,messages:'Messages',
  chat:['Can you help with my order?','Done! It\'s on its way.','Wow, that was fast 🙌'],team:'Your whole team',welcome:(p:string)=>`Welcome to ${p}!`,trial:'Your free trial has started.',
  cta:['Sign up in seconds','Invite your team','Start free']},
 ckb:{apps:['نامە','ئیمەیڵ','ڕۆژژمێر'],tasksDone:'ئەرکی تەواوکراو',onTime:'لە کاتی خۆیدا',onTrack:'پڕۆژەی ڕێکوپێک',updates:'نوێکاری ئەمڕۆ',overview:'پوختە',growth:'گەشە',
  tasks:['پلانی بڵاوکردنەوە','پێداچوونەوەی دیزاین','چاککردنی هەڵە'],timeSaved:'کاتی پاشەکەوتکراو',before:'پێشتر',with:(p:string)=>`لەگەڵ ${p}`,messages:'نامەکان',
  chat:['دەتوانن یارمەتیم بدەن؟','تەواو! لە ڕێگادایە.','وای، چەند خێرا بوو 🙌'],team:'هەموو تیمەکەت',welcome:(p:string)=>`بەخێربێیت بۆ ${p}!`,trial:'تاقیکردنەوەی بەخۆڕاییت دەستی پێکرد.',
  cta:['خۆتۆمارکردن لە چەند چرکەیەکدا','تیمەکەت بانگهێشت بکە','بەخۆڕایی دەست پێبکە']},
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
 const transitions=TRANSITIONS[genre];
 const T=rtl&&language!=='ar'&&language!=='fa'?SAMPLES.ckb:SAMPLES.en;
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
    else{p={kind:'counter',to:n?.value??100,...(n?.prefix?{prefix:n.prefix}:{}),...(n?.suffix?{suffix:n.suffix}:{}),decimals:n?.decimals??0,caption:clip(captionFor(sentence),60)||undefined};}
    why=role==='speed'?'Speed: the time counts or shrinks on screen.':'One number, counted up big.';break;}
   case 'support':{
    p=device==='phone'||genre!=='saas-promo'?{kind:'phone',app:T.messages,screen:{kind:'chat',messages:[{from:'them',text:T.chat[0]!},{from:'me',text:T.chat[1]!},{from:'them',text:T.chat[2]!}]},tilt:-4}
     :{kind:'browser',url:clip(url,60),screen:{kind:'chat',messages:[{from:'them',text:T.chat[0]!},{from:'me',text:T.chat[1]!}]}};
    why='Customers and replies: a chat with typing dots and quick answers.';check.push('The chat messages are examples; write them in your brand voice'+(rtl?' and language.':'.'));break;}
   case 'team':{p={kind:'avatars',people:people.slice(0,4).map(name=>({name})),caption:clip(list[0]??T.team,60)};why='People: the team appears together.';
    if(!o.people?.length)check.push('Sample names; use real names or initials only with permission.');break;}
   case 'steps':case 'explain':{const items=(list.length>=2?list:phrasesIn(sentence,3)).slice(0,3);if(list.length<2)check.push('Checklist items are key words from the sentence; rewrite them as short points.');
    p={kind:'checklist',items:items.length?items.map(t=>clip(t,60)):[clip(sentence,60)]};why='Points of the sentence tick off as a checklist.';break;}
   case 'cta':{
    p=device==='phone'?{kind:'phone',app:clip(product,30),screen:{kind:'notifications',items:[{app:clip(product,30),title:T.welcome(clip(product,40)),body:T.trial}]},tilt:0}
     :{kind:'browser',url:clip(url,60),screen:{kind:'checklist',title:clip(product,40),items:T.cta},cursor:{path:[{x:.4,y:.75,at:1.2},{x:.5,y:.82,at:1.8,click:true}]}};
    why='Call to action: the product opens and a click starts it; end on the brand.';check.push('Make sure the words on screen match your real offer (free trial, price).','Add the brand end card in an edit or keep the logo visible on the last scene.');break;}
  }
  // Avoid the same piece twice in a row: alternate a device frame or a different kind.
  const kind=String(p!.kind);
  if(kind===previous&&!['phone','browser'].includes(kind)&&['dashboard','chat','checklist','notifications','counter'].includes(kind)){p=wrap({...p!});why+=' (Shown inside a device frame for variety.)';}
  if(rtl&&p!.kind!=='phone')check.push('Kurdish/Arabic text: the piece layout is left-to-right; check that it reads naturally.');
  const piece=pieceSchema.parse({...p!,transition:index===0?'zoom-through':transitions[index%transitions.length]});
  previous=String(piece.kind);
  plans.push({index,sentence,role,piece,why,check});
 });
 const request={schemaVersion:1,title:clip(sentences[0]!.replace(/[.!?؟]+$/,''),60),preset:'kinetic',aspectRatio:'9:16',script:sentences.join('\n'),
  sceneVisuals:plans.map(pl=>({match:matchFor(pl.sentence),piece:pl.piece})),thumbnail:{title:clip(sentences[0]!.replace(/[.!?؟]+$/,''),60)}};
 return {genre,product,device,language,scenes:plans.length,request,plans};
}
/** A few distinctive words of the sentence for `match` (unique enough, short). */
function matchFor(sentence:string){
 const words=sentence.replace(/[.!?؟]+$/,'').split(/\s+/).filter(Boolean);
 return words.slice(0,Math.min(6,words.length)).join(' ');
}

export function storyboardMarkdown(sb:ReturnType<typeof storyboard>,recipes:{id:string;title:string}[]=[]){
 const rows=sb.plans.map(p=>`| ${p.index+1} | ${p.sentence.replace(/\|/g,'/')} | ${p.role} | ${p.piece.kind}${'screen' in p.piece?` → ${p.piece.screen.kind}`:''}${p.piece.cursor?' + cursor':''} | ${p.piece.transition} | ${p.why} |`);
 const checks=sb.plans.flatMap(p=>p.check.map(c=>`- Scene ${p.index+1}: ${c}`));
 return `# Storyboard: ${sb.request.title}

Genre: **${sb.genre}** · Device: **${sb.device}** · Product: **${sb.product}** · Scenes: **${sb.scenes}** · Language: **${sb.language}**
${recipes.length?`\nRecipes and knowledge used: ${recipes.map(r=>`\`${r.id}\` (${r.title})`).join(', ')}\n`:''}
| # | Sentence | Meaning | Piece | Transition in | Why |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Check before rendering

${checks.length?checks.join('\n'):'- Nothing guessed; every piece uses only the sentence\'s own words and numbers.'}

Approve, or say what to change (any scene's piece, words, numbers, people, device).
`;
}
