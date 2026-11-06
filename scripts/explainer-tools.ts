import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {z} from 'zod';
import {defaults} from '../src/engine/config.js';
import {load,dir,writeJSON} from '../src/engine/project.js';
import {chooseExplainerTheme,readThemeHistory,duplicateReport} from '../src/engine/explainer-design.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';
import {explainerPreflight,encodedExplainerQA,newQAFolder} from '../src/renderer/explainer-qa.js';

const {positionals,values:v}=parseArgs({allowPositionals:true,options:{brief:{type:'string'},project:{type:'string'},video:{type:'string'},output:{type:'string'},review:{type:'string'},help:{type:'boolean'}}});
async function main(){
 const command=positionals[0];
 if(v.help||!command)return {commands:['theme --brief brief.json [--output theme.json]','duplicates --project ID','frame-qa --project ID [--video export.mp4]','critic --project ID --video export.mp4 --review review.json'],brief:{brief:{topic:'...',industry:'...',audience:'...',emotion:'...',tone:'...',domain:'commerce | nature | learning | productivity | general'},overrides:{}},review:{exportHash:'SHA256 of reviewed video',reviewed:true,reviewer:'agent/user identity',criteria:['clarity','repetition','smoothness','readability','visualBalance'].map(name=>({name,score:4,evidence:'Actual observations, not a generic pass.'})),limitations:['Describe untested audio/shaping/capability limits.']}};
 if(command==='theme'){
  if(!v.brief)throw new Error('Supply --brief');const result=chooseExplainerTheme(JSON.parse(await fs.readFile(v.brief,'utf8')),await readThemeHistory(await defaults()));if(v.output)await writeJSON(path.resolve(v.output),result);return result;
 }
 if(!v.project)throw new Error('Supply --project');const p=await load(v.project);if(!p.config.explainer)throw new Error('This helper requires a saved script-explainer project');
 if(command==='duplicates'){const report=duplicateReport(p.scenes);if(report.issues.length)process.exitCode=1;return report;}
 if(command==='frame-qa'){
  const renderer=await openRenderer(p,.5),folder=newQAFolder(p);try{const preflight=await explainerPreflight(p,renderer.page,folder);if(!preflight.passed)process.exitCode=1;return {folder,preflight,encoded:v.video?await encodedExplainerQA(p,path.resolve(v.video),renderer.page,path.join(folder,'encoded')):undefined};}finally{await renderer.close();}
 }
 if(command==='critic'){
  if(!v.video||!v.review)throw new Error('Supply --video and --review');
  if(!p.exports.some(f=>path.resolve(f)===path.resolve(v.video!)))throw new Error('Critic must review an export from this saved project');
  const criterion=z.enum(['clarity','repetition','smoothness','readability','visualBalance']);
  const review=z.object({exportHash:z.string(),reviewed:z.literal(true),reviewer:z.string().min(3),criteria:z.array(z.object({name:criterion,score:z.number().int().min(1).max(5),evidence:z.string().min(30)}).strict()).length(5),limitations:z.array(z.string())}).strict().parse(JSON.parse(await fs.readFile(v.review,'utf8')));
  const hash=createHash('sha256').update(await fs.readFile(v.video)).digest('hex');if(review.exportHash!==hash)throw new Error('Review is not bound to this exported video');
  if(new Set(review.criteria.map(c=>c.name)).size!==5||review.criteria.some(c=>c.score<4))throw new Error('Every criterion needs a distinct score of at least 4/5; revise failed work and inspect fresh output.');
  const file=path.join(dir(p.id,p.config),'critic-'+hash.slice(0,16)+'.json');await writeJSON(file,{...review,video:path.resolve(v.video)});return {accepted:true,file};
 }
 throw new Error('Unknown explainer command '+command);
}
main().then(result=>console.log(JSON.stringify(result,null,2))).catch(e=>{console.error(String(e));process.exitCode=1;});
