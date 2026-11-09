// `pnpm dimensaz storyboard SCRIPT.txt`: a script in, a video request with a visual designed from
// zero for every sentence, plus storyboard.md for the user to approve. Nothing is rendered.
import fs from 'node:fs/promises';
import path from 'node:path';
import {storyboard,storyboardMarkdown} from '../engine/storyboard.js';
import {requestSchema} from '../engine/production.js';

const usage=`Usage: dimensaz storyboard SCRIPT.txt|--text "..." [--look "dark and glowing"] [--seed TEXT]
  [--sound library|soft|digital|punchy|minimal] [--format 9:16|1:1|16:9] [--preset NAME] [--out DIR]

Splits the script into one sentence per scene, reads what each sentence means and says, and
designs a new visual for it from layers, using only the sentence's own words and numbers. The
style is generated from zero for this video (--look steers it). Writes request.json and
storyboard.md (never overwrites: a second run goes to DIR-2). Review, then run:
  pnpm video:create --manifest DIR/request.json`;

async function free(dir:string){for(let i=1;;i++){const d=i===1?dir:`${dir}-${i}`;try{await fs.access(d);}catch{return d;}}}

async function main(){
 const args=process.argv.slice(2);const v:Record<string,string>={};const pos:string[]=[];
 for(let i=0;i<args.length;i++){const a=args[i]!;if(a.startsWith('--')){v[a.slice(2)]=args[i+1]&&!args[i+1]!.startsWith('--')?args[++i]!:'true';}else pos.push(a);}
 if(v.help||(!pos[0]&&!v.text)){console.log(usage);return;}
 const script=v.text??await fs.readFile(pos[0]!,'utf8');
 const {designStyle,styleKnowledge,usedGenomes,learnedTraits,isKit}=await import('../engine/style-choice.js');
 if(v.sound&&!isKit(v.sound))throw new Error('Unknown --sound '+v.sound);
 // A new style for this video; the seed changes every run, so asking again gives another one.
 const noBrain=process.env.DIMENSAZ_STORYBOARD_NO_BRAIN==='1',learned=noBrain?{}:await learnedTraits();
 const seed=v.seed??`${Date.now()}-${Math.random()}`;
 const designed=designStyle({seed,brief:script,direction:v.look,used:await usedGenomes(),knowledge:noBrain?[]:await styleKnowledge(script),learned});
 const sb=storyboard(script,{genome:designed.genome,styleWhy:designed.why,learned,seed,...(v.sound?{soundKit:v.sound}:{})});
 const request={...sb.request,...(v.format?{aspectRatio:v.format}:{}),...(v.preset?{preset:v.preset}:{})};
 const check=requestSchema.safeParse(request);
 if(!check.success)throw new Error('The storyboard request is not valid: '+check.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '));
 const outDir=await free(path.resolve(v.out??path.join(process.env.VIDEO_WORKSPACE||'workspace','storyboards',sb.request.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,40)||'storyboard')));
 await fs.mkdir(outDir,{recursive:true});
 await fs.writeFile(path.join(outDir,'request.json'),JSON.stringify(request,null,1)+'\n');
 await fs.writeFile(path.join(outDir,'storyboard.md'),storyboardMarkdown(sb));
 console.log(JSON.stringify({ok:true,scenes:sb.scenes,request:path.join(outDir,'request.json'),storyboard:path.join(outDir,'storyboard.md'),
  style:sb.style,genome:sb.genome?.id,styleWhy:sb.styleWhy,soundKit:sb.soundKit,toCheck:sb.plans.reduce((n,p)=>n+p.check.length,0),
  scenesPlan:sb.plans.map(p=>({scene:p.index+1,role:p.role,composition:p.piece.designed?.archetype,sentence:p.sentence.slice(0,70)})),
  next:'Show storyboard.md to the user; after approval run pnpm video:create --manifest '+path.join(outDir,'request.json')},null,2));
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
