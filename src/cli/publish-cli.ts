// tempoloom publish: covers and titles to choose from, and a post package for each platform.
import fs from 'node:fs/promises';
import path from 'node:path';

const args=process.argv.slice(2),command=args[0],rest=args.slice(1);
const flag=(k:string)=>{const i=rest.indexOf(k);return i>=0?rest[i+1]:undefined;};
const number=(k:string)=>{const v=flag(k);if(v===undefined)return undefined;const n=Number(v);if(!Number.isFinite(n))throw new Error(k+' must be a number');return n;};
const positional=()=>rest.find((x,i)=>!x.startsWith('--')&&!(rest[i-1]?.startsWith('--')&&!['--plan'].includes(rest[i-1]!)));
const list=(k:string)=>flag(k)?.split(k==='--titles'?'|':',').map(s=>s.trim()).filter(Boolean);
const usage=`Usage: tempoloom publish titles FILE.txt | --edit TEXT-EDIT [--count 5]
       tempoloom publish covers VIDEO [--titles "One|Two"] [--count 3] [--size 16:9|9:16|1:1] [--at SECONDS] [--layouts side,big,bottom] [--out FOLDER]
       tempoloom publish package VIDEO | --edit TEXT-EDIT [--for tiktok,reels,shorts,youtube] [--title T] [--caption TEXT | --caption-file F] [--tags a,b] [--srt F] [--cover-at S] [--out FOLDER]
       tempoloom publish check --for tiktok,reels [--title T] [--caption TEXT] [--tags a,b] [--seconds S]
       tempoloom publish platforms

Nothing is posted: the package is for you to post. A timeline for another editor: tempoloom edit export.`;

async function main(){
 const P=await import('../editor/publish.js');
 const platforms=()=>{const f=list('--for');if(!f)return undefined;const bad=f.filter(x=>!P.platformNames.includes(x as never));if(bad.length)throw new Error('Unknown platform: '+bad.join(', ')+'. Use '+P.platformNames.join(', '));return f as import('../editor/publish.js').Platform[];};
 const fromEdit=async()=>{const id=flag('--edit');return id?(await import('../editor/text-edit.js')).forPublish(id):null;};
 switch(command){
  case 'platforms':return {checked:P.LIMITS_CHECKED,platforms:P.PLATFORMS};
  case 'titles':{const e=await fromEdit(),f=positional(),text=e?.text??(f?await fs.readFile(path.resolve(f),'utf8'):flag('--text'));
   if(!text)throw new Error(usage);return {ideas:P.titleIdeas(text,{count:number('--count')}),note:'Ideas from the words: sharpen them, keep the strongest under 60 characters.'};}
  case 'covers':{const f=positional();if(!f)throw new Error(usage);const size=flag('--size') as '16:9'|'9:16'|'1:1'|undefined;if(size&&!['16:9','9:16','1:1'].includes(size))throw new Error('--size is 16:9, 9:16 or 1:1');
   const layouts=list('--layouts') as import('../editor/finishing.js').ThumbLayout[]|undefined;if(layouts?.some(l=>!['side','big','bottom'].includes(l)))throw new Error('--layouts are side, big, bottom');
   return P.thumbnailSet(f,{titles:list('--titles'),count:number('--count'),size,at:number('--at'),layouts,out:flag('--out'),logo:!rest.includes('--no-logo')});}
  case 'package':{const e=await fromEdit(),video=positional()??e?.video;if(!video)throw new Error(e?'Make the edit first: nothing has been made from this text edit yet.\n'+usage:usage);
   const caption=flag('--caption-file')?await fs.readFile(path.resolve(flag('--caption-file')!),'utf8'):flag('--caption');
   return P.postPackage(video,{platforms:platforms(),title:flag('--title'),caption:caption?.trim(),tags:list('--tags')?.map(t=>t.replace(/^#/,'')),srt:flag('--srt'),...(e&&!flag('--srt')&&!positional()?{cues:e.cues}:{}),coverAt:number('--cover-at'),out:flag('--out')});}
  case 'check':{const ps=platforms()??P.platformNames;return ps.map(p=>{const {text:_t,...c}=P.checkPost(p,{title:flag('--title'),caption:flag('--caption'),tags:list('--tags'),seconds:number('--seconds')});return c;});}
  default:throw new Error(usage);
 }
}
main().then(r=>{console.log(JSON.stringify(r,null,2));},e=>{console.error((e as Error).message);process.exit(1);});
