// Publish kit: a set of covers and titles to choose from, and a post package (the video in each
// platform's shape, its cover, captions, and the words to post, checked against each platform's
// limits). Nothing is posted: the user posts it. Inputs are never changed; nothing is overwritten.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../renderer/browser-path.js';
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';
import {mediaInfo} from './editor.js';
import {composeThumbnail,exportFormats,rankFrames,type ThumbLayout} from './finishing.js';
import {parseSrt,writeSrt} from './srt.js';

// ---------- the platforms ----------
/** Each platform's limits, as their help pages and upload guides gave them when checked. They change:
 *  the checks warn, they never block. */
export const PLATFORMS={
 tiktok:{name:'TikTok',shape:'9:16',maxSeconds:600,caption:4000,captionSafe:2200,title:0,hashtags:50,cover:'9:16'},
 reels:{name:'Instagram Reels',shape:'9:16',maxSeconds:180,caption:2200,captionSafe:2200,title:0,hashtags:30,cover:'9:16'},
 shorts:{name:'YouTube Shorts',shape:'9:16',maxSeconds:180,caption:5000,captionSafe:5000,title:100,hashtags:15,cover:'9:16'},
 youtube:{name:'YouTube',shape:'16:9',maxSeconds:43200,caption:5000,captionSafe:5000,title:100,hashtags:15,cover:'16:9'},
} as const;
export const LIMITS_CHECKED='2026-11-14';
export type Platform=keyof typeof PLATFORMS;
export const platformNames=Object.keys(PLATFORMS) as Platform[];

const tagsOf=(s:string)=>[...s.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)].map(m=>m[2]!);
/** What the words to post break (errors) or risk (warnings) on a platform. */
export function checkPost(p:Platform,o:{title?:string;caption?:string;tags?:string[];seconds?:number;coverKB?:number}){
 const P=PLATFORMS[p],errors:string[]=[],warnings:string[]=[];
 const tags=[...new Set([...(o.tags??[]),...tagsOf(o.caption??'')])],body=[o.caption??'',...(o.tags??[]).filter(t=>!tagsOf(o.caption??'').includes(t)).map(t=>'#'+t)].join(' ').trim();
 if(P.title){const n=[...(o.title??'')].length;if(!n)warnings.push('No title.');else if(n>P.title)errors.push(`The title is ${n} characters; ${P.name} allows ${P.title}.`);else if(n>60)warnings.push(`The title is ${n} characters; past about 60 it is cut short on phones.`);}
 const c=[...body].length;
 if(c>P.caption)errors.push(`The ${P.title?'description':'caption'} is ${c} characters; ${P.name} allows ${P.caption}.`);
 else if(c>P.captionSafe)warnings.push(`The caption is ${c} characters; ${P.captionSafe} is the safe length on ${P.name}.`);
 if(!P.title&&c>125)warnings.push('Only about the first 125 characters show before "more": put the point first.');
 if(tags.length>P.hashtags)errors.push(`${tags.length} hashtags; ${P.name} allows ${P.hashtags}.`);else if(tags.length>5)warnings.push(`${tags.length} hashtags; 3 to 5 that say what it is about work best.`);
 if(o.seconds!==undefined&&o.seconds>P.maxSeconds)errors.push(`The video is ${Math.round(o.seconds)} s; ${P.name} takes up to ${P.maxSeconds>=3600?P.maxSeconds/3600+' hours':P.maxSeconds>=120?P.maxSeconds/60+' minutes':P.maxSeconds+' s'}.`);
 if(p==='youtube'&&o.coverKB!==undefined&&o.coverKB>2048)errors.push(`The thumbnail is ${o.coverKB} KB; YouTube takes up to 2 MB.`);
 return {platform:p,name:P.name,ok:!errors.length,errors,warnings,text:body,tags};
}

// ---------- titles ----------
const QUESTION=/\?|؟|^(why|how|what|did you|have you|do you|would you|can you)\b/i;
const NUMBER=/\d|\b(one|two|three|five|ten|hundred|thousand|million|half|double|twice)\b/i;
const STRONG=/\b(mistake|mistakes|never|stop|secret|nobody|no one|everyone|worst|best|wrong|truth|actually|changed|free|money|lost|saved|why|how|only|first|biggest|fastest|simple|easy|hard|problem|fail|failed|wish)\b/i;
const WEAK=/^(and|but|so|then|also|this|that|it|they|hi|hello|hey|welcome|today|in this video|my name)\b/i;
/** Title ideas from what the video says: its strongest lines, short enough to read at a glance,
 *  each with why. A starting point for the user (or the studio's writer) to sharpen, not a final title. */
export function titleIdeas(text:string,o:{count?:number;max?:number}={}){
 const max=o.max??60,lines=text.replace(/\s+/g,' ').split(/(?<=[.!?؟])\s+/).map(s=>s.trim().replace(/^(um+|uh+|so|and|but|okay|ok|well),?\s+/i,'')).filter(s=>s.length>=12);
 const seen=new Set<string>(),out:{title:string;why:string[];score:number}[]=[];
 for(const l of lines){let t=l.replace(/[.!]+$/,'');
  if([...t].length>max){const cut=t.slice(0,max+1).replace(/\s+\S*$/,'');t=cut.replace(/[,;:]$/,'');if(t.length<12)continue;}
  const why:string[]=[];let score=0;
  if(QUESTION.test(t)){score+=2;why.push('asks a question');}
  if(NUMBER.test(t)){score+=2;why.push('has a number');}
  if(STRONG.test(t)){score+=1.5;why.push('makes a strong claim');}
  if(/\b(you|your)\b/i.test(t)){score+=1;why.push('speaks to the viewer');}
  if(WEAK.test(t)){score-=2;why.push('starts weakly');}
  if([...t].length<=45){score+=.5;why.push('short');}
  const key=t.toLowerCase();if(seen.has(key))continue;seen.add(key);
  out.push({title:t[0]!.toUpperCase()+t.slice(1),why,score:+score.toFixed(2)});}
 return out.sort((a,b)=>b.score-a.score).slice(0,o.count??5);
}

// ---------- the thumbnail and title set ----------
const shapeOf=(w:number,h:number)=>(w>h?'16:9':w===h?'1:1':'9:16') as '16:9'|'9:16'|'1:1';
async function freeDir(dir:string){let d=dir;for(let k=2;await fs.access(d).then(()=>true,()=>false);k++)d=`${dir}-${k}`;await fs.mkdir(d,{recursive:true});return d;}
/** Covers to choose from: the best frames (spread through the video) with each title, in turn in
 *  each layout, and one sheet with all of them side by side. */
export async function thumbnailSet(file:string,o:{at?:number;titles?:string[];count?:number;size?:'16:9'|'9:16'|'1:1';layouts?:ThumbLayout[];out?:string;logo?:boolean}={}){
 const src=path.resolve(file),info=await mediaInfo(src),size=o.size??shapeOf(info.width,info.height);
 const titles=(o.titles??[]).map(t=>t.trim()).filter(Boolean).slice(0,4),count=Math.max(1,Math.min(6,o.count??3));
 const layouts=o.layouts?.length?o.layouts:size==='9:16'?['bottom','big'] as ThumbLayout[]:['side','big','bottom'] as ThumbLayout[];
 const dir=await freeDir(path.resolve(o.out??src.replace(/\.[^.]+$/,'')+'-covers')),work=await fs.mkdtemp(path.join(os.tmpdir(),'tl-covers-'));
 const browser=await chromium.launch({headless:true,executablePath:chromiumExecutable()});
 try{
  // Frames far enough apart to be different pictures (an eighth of the video at least).
  const ranked=o.at!==undefined?[]:await rankFrames(src,info.duration,browser,work,Math.min(40,Math.max(12,count*8))),gap=Math.max(.5,info.duration/(count+1)),frames:{time:number;score:number}[]=[];
  if(o.at!==undefined)frames.push({time:Math.max(0,Math.min(info.duration-.05,o.at)),score:0});
  for(const f of o.at!==undefined?[]:ranked){if(frames.length>=count)break;if(frames.every(x=>Math.abs(x.time-f.time)>=gap))frames.push(f);}
  const covers:{name:string;at:number;title:string|null;layout:ThumbLayout;jpg:string;png:string;jpgKB:number}[]=[];
  let k=0;
  for(const [i,f] of frames.entries()){
   const frame=path.join(work,`f${i}.png`);await run(ffmpeg,['-hide_banner','-loglevel','error','-ss',f.time.toFixed(3),'-i',src,'-frames:v','1','-y',frame]);
   for(const [j,t] of (titles.length?titles:[null]).entries()){const layout=layouts[(i+j)%layouts.length]!,name=`cover-${i+1}${titles.length>1?String.fromCharCode(97+j):''}`;
    const c=await composeThumbnail(browser,frame,{title:t??undefined,size,layout,logo:o.logo,base:path.join(dir,name)});
    covers.push({name,at:f.time,title:t,layout:c.layout,jpg:c.jpg,png:c.png,jpgKB:c.jpgKB});k++;}}
  // The sheet: every cover, small, with its name, to compare at a glance.
  const cols=Math.min(covers.length,size==='9:16'?4:3),tw=size==='9:16'?240:size==='1:1'?300:400,th=Math.round(tw*(size==='9:16'?16/9:size==='1:1'?1:9/16));
  const page=await (await browser.newContext({viewport:{width:cols*(tw+16)+16,height:100},deviceScaleFactor:1})).newPage();
  const imgs=await Promise.all(covers.map(async c=>'data:image/jpeg;base64,'+(await fs.readFile(c.jpg)).toString('base64')));
  await page.setContent(`<body style="margin:0;padding:16px;background:#16181d;font:14px sans-serif;color:#e8e8e8;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:16px">${covers.map((c,i)=>`<figure style="margin:0"><img src="${imgs[i]}" style="width:${tw}px;height:${th}px;display:block;border-radius:6px"><figcaption style="margin-top:6px">${c.name}</figcaption></figure>`).join('')}</body>`);
  const sheet=path.join(dir,'covers-sheet.jpg');await page.screenshot({path:sheet,type:'jpeg',quality:85,fullPage:true});
  return {folder:dir,video:src,size,covers:covers.map(c=>({...c,jpg:c.jpg,png:c.png})),sheet,
   note:titles.length?'Each frame is shown with each title. Pick one, or ask for another frame (--at) or layout.':'No titles given: covers without text. Add --titles "One|Two" (the agent writes them; publish titles suggests some from the words).'};
 }finally{await browser.close();await fs.rm(work,{recursive:true,force:true});}
}

// ---------- the post package ----------
/** Everything to post one video: the video in each platform's shape, a cover for each shape, the
 *  captions file, and the words to post with each platform's checks. In a new folder. */
export async function postPackage(file:string,o:{platforms?:Platform[];title?:string;caption?:string;tags?:string[];cues?:{start:number;end:number;text:string}[];srt?:string;coverAt?:number;out?:string}={}){
 const src=path.resolve(file),info=await mediaInfo(src),platforms=o.platforms?.length?o.platforms:(['tiktok','reels','shorts'] as Platform[]);
 const dir=await freeDir(path.resolve(o.out??src.replace(/\.[^.]+$/,'')+'-post')),shapes=[...new Set(platforms.map(p=>PLATFORMS[p].shape))];
 const videos:Record<string,string>={},covers:Record<string,{jpg:string;kb:number}>={};
 const work=await fs.mkdtemp(path.join(os.tmpdir(),'tl-post-'));
 try{
  for(const sh of shapes){const target=path.join(dir,`video-${sh.replace(':','x')}.mp4`),own=shapeOf(info.width,info.height)===sh&&Math.abs(info.width/info.height-(sh==='9:16'?9/16:16/9))<.02;
   const r=own?null:await exportFormats(src,{to:[sh as '9:16'|'16:9'],outDir:work}),made=r?.formats[0]?.file;
   if(!made||made===src)await fs.copyFile(src,target);else await fs.rename(made,target).catch(async()=>{await fs.copyFile(made,target);});
   videos[sh]=target;
   const set=await thumbnailSet(target,{titles:o.title?[o.title]:[],count:1,size:sh as '9:16'|'16:9',out:path.join(work,'c-'+sh.replace(':','x')),...(o.coverAt!==undefined?{at:o.coverAt}:{})});
   const c=set.covers[0]!,name=path.join(dir,`${sh==='16:9'?'thumbnail':'cover'}-${sh.replace(':','x')}.jpg`);await fs.copyFile(c.jpg,name);covers[sh]={jpg:name,kb:c.jpgKB};}
  let srt:string|null=null;
  const cues=o.cues??(o.srt?parseSrt(await fs.readFile(path.resolve(o.srt),'utf8')):null);
  if(cues?.length){srt=path.join(dir,'captions.srt');await fs.writeFile(srt,writeSrt(cues),{flag:'wx'});}
  const checks=platforms.map(p=>checkPost(p,{title:o.title,caption:o.caption,tags:o.tags,seconds:info.duration,coverKB:covers[PLATFORMS[p].shape]?.kb}));
  const md=[`# ${o.title??path.basename(src)}`,'',`${info.duration.toFixed(1)} s. Limits checked ${LIMITS_CHECKED}; platforms change them, so look again if a post is refused.`,'',
   ...checks.flatMap(c=>{const P=PLATFORMS[c.platform];return [`## ${c.name}`,'',`- Video: ${path.basename(videos[P.shape]!)}`,`- ${P.shape==='16:9'?'Thumbnail':'Cover'}: ${path.basename(covers[P.shape]!.jpg)}`,
    ...(srt?[`- Captions: captions.srt`]:[]),...(P.title?[`- Title: ${o.title??'(write one)'}`]:[]),'',`${P.title?'Description':'Caption'}:`,'',c.text||'(write one)','',
    ...(c.errors.length?['Fix before posting:',...c.errors.map(e=>`- ${e}`),'']:[]),...(c.warnings.length?['Worth a look:',...c.warnings.map(e=>`- ${e}`),'']:[]),...(c.ok&&!c.warnings.length?['Ready.','']:[])];})];
  const postMd=path.join(dir,'post.md');await fs.writeFile(postMd,md.join('\n')+'\n',{flag:'wx'});
  await fs.writeFile(path.join(dir,'post.json'),JSON.stringify({video:src,seconds:+info.duration.toFixed(2),title:o.title??null,caption:o.caption??null,tags:o.tags??[],videos,covers,captions:srt,checks,limitsChecked:LIMITS_CHECKED},null,1)+'\n',{flag:'wx'});
  return {folder:dir,videos,covers:Object.fromEntries(Object.entries(covers).map(([k,v])=>[k,v.jpg])),captions:srt,post:postMd,checks:checks.map(({text:_t,...c})=>c),ready:checks.every(c=>c.ok)};
 }finally{await fs.rm(work,{recursive:true,force:true});}
}
