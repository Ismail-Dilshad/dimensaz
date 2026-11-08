// `pnpm dimensaz storyboard SCRIPT.txt`: a script in, a video request with one animated
// piece per sentence out, plus storyboard.md for the user to approve. Nothing is rendered.
import fs from 'node:fs/promises';
import path from 'node:path';
import {storyboard,storyboardMarkdown,type Genre} from '../engine/storyboard.js';
import {requestSchema} from '../engine/production.js';

const usage=`Usage: dimensaz storyboard SCRIPT.txt|--text "..." [--product NAME] [--genre auto|saas-promo|app-launch|explainer|product-ad|tutorial|general]
  [--device auto|phone|browser] [--style auto|soft|glass|neon|brutal|editorial|clay|outline|pop] [--sound library|soft|digital|punchy|minimal] [--people "Sara,Omar"] [--url app.com] [--format 9:16|1:1|16:9] [--preset NAME] [--out DIR]

Splits the script into one sentence per scene, reads what each sentence means, and picks an
animated piece for it (notifications, a product mockup, tasks flying to people, a dashboard,
a chart, a counter, a chat, avatars, a checklist), using the brain's recipe for the genre.
Writes request.json and storyboard.md (never overwrites). Review, then run:
  pnpm video:create --manifest DIR/request.json`;

const GENRE_BY_RECIPE:Record<string,Genre>={'rc-saas-promo':'saas-promo','rc-app-launch':'app-launch','rc-explainer':'explainer','rc-product-ad':'product-ad','rc-tutorial':'tutorial'};

async function free(dir:string){for(let i=1;;i++){const d=i===1?dir:`${dir}-${i}`;try{await fs.access(d);}catch{return d;}}}

async function main(){
 const args=process.argv.slice(2);const v:Record<string,string>={};const pos:string[]=[];
 for(let i=0;i<args.length;i++){const a=args[i]!;if(a.startsWith('--')){v[a.slice(2)]=args[i+1]&&!args[i+1]!.startsWith('--')?args[++i]!:'true';}else pos.push(a);}
 if(v.help||(!pos[0]&&!v.text)){console.log(usage);return;}
 const script=v.text??await fs.readFile(pos[0]!,'utf8');
 // The brain: the genre's recipe and the lessons that always apply.
 let recipes:{id:string;title:string;use:string}[]=[],lessons:{id:string;title:string}[]=[];
 if(process.env.DIMENSAZ_STORYBOARD_NO_BRAIN!=='1'){
  try{const brain=await import('../engine/brain/brain.js');brain.sync();
   const r=brain.recall('recipe '+script.slice(0,1500),{limit:20}).items;
   recipes=r.filter(k=>k.kind==='recipe').slice(0,2);lessons=r.filter(k=>k.always).slice(0,6);
  }catch{/* the storyboard still works without the brain */}
 }
 let genre=(v.genre as Genre|'auto'|undefined)??'auto';
 // The design style: asked for (--style), or chosen from the brief, brand, brain and recent videos.
 const {chooseStyle,recentStyles,styleKnowledge,isStyle,isKit}=await import('../engine/style-choice.js');
 if(v.style&&!isStyle(v.style))throw new Error('Unknown --style '+v.style);if(v.sound&&!isKit(v.sound))throw new Error('Unknown --sound '+v.sound);
 const {detectGenre}=await import('../engine/storyboard.js');
 const choice=v.style?{style:v.style,why:['you asked for it']}:chooseStyle({brief:script,genre:v.genre&&v.genre!=='auto'?v.genre:detectGenre(script),recent:await recentStyles(),knowledge:process.env.DIMENSAZ_STORYBOARD_NO_BRAIN==='1'?[]:await styleKnowledge(script)});
 const styleOpts={style:choice.style,styleWhy:choice.why,...(v.sound?{soundKit:v.sound}:{})};
 const sbAuto=storyboard(script,{...styleOpts,genre,product:v.product,device:v.device as 'phone'|'browser'|'auto'|undefined,people:v.people?.split(',').map(s=>s.trim()).filter(Boolean),url:v.url});
 let sb=sbAuto;
 if(genre==='auto'&&sbAuto.genre==='general'){const g=recipes.map(r=>GENRE_BY_RECIPE[r.id]).find(Boolean);
  if(g){genre=g;sb=storyboard(script,{...styleOpts,genre,product:v.product,device:v.device as 'phone'|'browser'|'auto'|undefined,people:v.people?.split(',').map(s=>s.trim()).filter(Boolean),url:v.url});}}
 const request={...sb.request,...(v.format?{aspectRatio:v.format}:{}),...(v.preset?{preset:v.preset}:{})};
 const check=requestSchema.safeParse(request);
 if(!check.success)throw new Error('The storyboard request is not valid: '+check.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '));
 const recipe=recipes.find(r=>GENRE_BY_RECIPE[r.id]===sb.genre)??recipes[0];
 const used=[...(recipe?[recipe]:[]),...lessons];
 let md=storyboardMarkdown(sb,used);
 if(recipe)md=md.replace('\n| # |',`\nRecipe (${recipe.id}): ${recipe.use}\n\n| # |`);
 const outDir=await free(path.resolve(v.out??path.join(process.env.VIDEO_WORKSPACE||'workspace','storyboards',sb.request.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'storyboard')));
 await fs.mkdir(outDir,{recursive:true});
 await fs.writeFile(path.join(outDir,'request.json'),JSON.stringify(request,null,1)+'\n');
 await fs.writeFile(path.join(outDir,'storyboard.md'),md);
 console.log(JSON.stringify({ok:true,genre:sb.genre,device:sb.device,scenes:sb.scenes,request:path.join(outDir,'request.json'),storyboard:path.join(outDir,'storyboard.md'),
  style:sb.style,styleWhy:sb.styleWhy,soundKit:sb.soundKit,brainIds:used.map(u=>u.id),toCheck:sb.plans.reduce((n,p)=>n+p.check.length,0),
  scenesPlan:sb.plans.map(p=>({scene:p.index+1,role:p.role,piece:p.piece.kind+('screen' in p.piece?'/'+p.piece.screen.kind:''),sentence:p.sentence.slice(0,70)})),
  next:'Show storyboard.md to the user; after approval run pnpm video:create --manifest '+path.join(outDir,'request.json')},null,2));
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
