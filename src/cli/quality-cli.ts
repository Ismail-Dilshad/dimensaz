// `pnpm tempoloom quality`: render the test scripts in styles generated from zero and score them
// (text size, contrast, overlaps, cut-off text, empty frames, effect loudness), compared with
// the last run. `quality PROJECT` scores one project's frames.
import {runHarness,scoreProject} from '../engine/quality-harness.js';
import {load} from '../engine/project.js';

const usage=`Usage: tempoloom quality [--styles N] [--seed TEXT] [--learn] [SCRIPT.txt ...]
       tempoloom quality --project PROJECT_ID

Renders the test scripts in tests/fixtures/quality (or the ones given) in N new styles each (default 4)
and scores every scene once it has settled: text size, contrast, the sentence running into
the piece, text cut off or covered, empty frames, and the loudness and density of effects.
Saves workspace/quality/<time>/report.md and report.json and compares with the last run.
--learn marks the style traits of failing styles in the brain.`;

async function main(){
 const a=process.argv.slice(2);if(a.includes('--help')||a[0]==='help')return console.log(usage);
 const val=(k:string)=>{const i=a.indexOf(k);return i>=0?a[i+1]:undefined;};
 const project=val('--project');
 if(project){const q=await scoreProject(await load(project));console.log(JSON.stringify({score:q.score,passed:q.passed,issues:q.scenes.flatMap(s=>s.issues.map(i=>`${s.scene}: ${i.severity} ${i.kind}: ${i.detail}`))},null,2));if(!q.passed)process.exitCode=1;return;}
 const scripts=a.filter((x,i)=>!x.startsWith('--')&&!['--styles','--seed','--project'].includes(a[i-1]??''));
 const {report,dir}=await runHarness({styles:Number(val('--styles')??4),seed:val('--seed'),learn:a.includes('--learn'),scripts,onProgress:s=>console.error(s)});
 console.log(JSON.stringify({report:dir+'/report.md',score:report.summary.score,passRate:report.summary.passRate,hard:report.summary.hard,soft:report.summary.soft,byScript:report.summary.byScript,
  failingTraits:report.summary.failingTraits,previous:report.previous,failing:report.rows.filter(r=>!r.passed).map(r=>({script:r.script,style:r.style,score:r.score,worst:r.worst,sound:r.sound.issues}))},null,2));
 if(report.previous?.regression)process.exitCode=1;
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
