// `pnpm tempoloom write`: the script writer's research and checks. The agent writes the script from
// the brief; this command gathers the facts it may use and checks the script before `make`.
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from '../engine/config.js';
import {slugify} from '../engine/project.js';
import {languageSchema,type Language} from '../engine/languages.js';
import {research,brief,briefMarkdown,checkScript,type Brief} from '../engine/script-writer.js';
import * as D from '../engine/script-doctor.js';

const usage=`Usage: tempoloom write "TOPIC" | URL [--seconds 30] [--language en|ckb|ar|fa|kmr|badini] [--name NAME]
       tempoloom write --check SCRIPT.txt [--brief BRIEF.json] [--seconds N]
       tempoloom write --doctor SCRIPT.txt [--brief BRIEF.json] [--seconds N]
       tempoloom write --suggest SCRIPT.txt --line N --text "BETTER LINE" [--why "WHAT IT FIXES"]
       tempoloom write --source SCRIPT.txt --line N --claim "THE FIGURE OR CLAIM" --url URL [--note "..."]
       tempoloom write --keep|--decline SCRIPT.txt --id SUGGESTION_ID
       tempoloom write --accept SCRIPT.txt --why "WHY THE SCRIPT STAYS AS IT IS"

First form: reads the link (a product page, an article) or takes the topic, pulls out the facts a
script may use (name, what it does, features, figures, prices, quotations, each with its source
sentence), and writes a brief for a short video of the target length: the beats (hook, problem,
solution, proof, call to action), lines and words, and the rules. Saved to
workspace/scripts/<name>/brief.md and brief.json; write the script next to it as script.txt.

--check: the script's length (with a voice-over and without), a hook first and a call to action
last, every figure and quotation traceable to the brief's facts, lines short enough for headlines,
and the visual the designer will give each line. Fix what it reports, then:
pnpm tempoloom make workspace/scripts/<name>/script.txt

--doctor: every line scored 0-100 for its job (the hook, the call to action), clarity and how
long it takes to say, with what to change; every figure, price, date, quotation and claim with
its source, or flagged. Weak lines get better versions with --suggest (the user keeps or declines
each on the Studio page; --keep replaces the line); a figure gets its source with --source.
Never rewrite a script the user wrote: suggest instead.`;

const flag=(a:string[],n:string)=>{const i=a.indexOf(n);return i>=0&&a[i+1]&&!a[i+1]!.startsWith('--')?a[i+1]:undefined;};
async function main(){
 const a=process.argv.slice(2);const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
 if(!a.length||a[0]==='help'||a[0]==='--help')return console.log(usage);
 const seconds=flag(a,'--seconds')?Number(flag(a,'--seconds')):undefined;
 if(seconds!==undefined&&!(seconds>=10&&seconds<=120))throw new Error('--seconds must be between 10 and 120');
 const lang=flag(a,'--language'),language=lang?languageSchema.parse(lang) as Language:undefined;
const docFlags=['--doctor','--suggest','--source','--keep','--decline','--accept'];
 const which=docFlags.find(f=>a.includes(f));
 if(which){
  const file=flag(a,which);if(!file)throw new Error(which+' SCRIPT.txt');const f=path.resolve(file);
  const line=Number(flag(a,'--line')),id=flag(a,'--id')??'';
  switch(which){
   case '--doctor':{const r=D.doctorScript(f,{...(seconds?{seconds}:{}),...(flag(a,'--brief')?{brief:path.resolve(flag(a,'--brief')!)}:{})});
    out({score:r.score,verdict:r.verdict,seconds:r.seconds,weak:r.weak,unsourced:r.unsourced,issues:r.issues,
     lines:r.lines.map(l=>({line:l.n,score:l.score,verdict:l.verdict,text:l.text,seconds:l.seconds,...(l.notes.length?{notes:l.notes}:{}),...(l.claims.length?{claims:l.claims}:{}),...(l.suggestions.length?{suggestions:l.suggestions.map(x=>({id:x.id,text:x.text}))}:{})})),
     next:r.answered?'Every line is strong enough and every figure has a source.':`Rewrite the weak lines (${r.weak.join(', ')||'none'}) and give each figure a source or take it out. Your own script: edit it, then --doctor again. The user's script: --suggest each better line and --source each figure; the user keeps or declines them on the Studio page.`});
    if(!r.answered)process.exitCode=2;return;}
   case '--suggest':if(!line)throw new Error('--line N');return out(D.suggest(f,line,flag(a,'--text')??'',{...(flag(a,'--why')?{why:flag(a,'--why')!}:{})}));
   case '--source':if(!line)throw new Error('--line N');return out(D.addSource(f,line,flag(a,'--claim')??'',flag(a,'--url')??'',{...(flag(a,'--note')?{note:flag(a,'--note')!}:{})}));
   case '--keep':return out(D.keep(f,id));
   case '--decline':return out(D.decline(f,id));
   case '--accept':return out(D.acceptAsIs(f,flag(a,'--why')??''));
  }
 }
 if(a.includes('--check')){
  const file=flag(a,'--check');if(!file)throw new Error('--check SCRIPT.txt');
  const text=await fs.readFile(path.resolve(file),'utf8');
  // The brief beside the script is used when none is named.
  const named=flag(a,'--brief'),beside=path.join(path.dirname(path.resolve(file)),'brief.json');
  let b:Brief|undefined;const bf=named?path.resolve(named):beside;
  try{b=JSON.parse(await fs.readFile(bf,'utf8')) as Brief;}catch{if(named)throw new Error('Cannot read the brief: '+named);}
  const r=checkScript(text,b,{...(seconds?{seconds}:{}),...(language?{language}:{})});
  out({...r,brief:b?bf:'none (figures and quotations cannot be traced; give --brief)',
   next:r.passed?`pnpm tempoloom make ${path.relative(ROOT,path.resolve(file))}`:'Fix the hard issues and check again'});
  if(!r.passed)process.exitCode=2;return;
 }
 const input=a.filter((x,i)=>!x.startsWith('--')&&!['--seconds','--language','--name','--brief'].includes(a[i-1]??'')).join(' ').trim();
 if(!input)throw new Error('Give a topic or a link');
 const r=await research(input,{...(language?{language}:{})});const b=brief(r,{...(seconds?{seconds}:{}),...(language?{language}:{})});
 const name=(flag(a,'--name')??(slugify(r.title).slice(0,50)||`script-${Date.now()}`)).replace(/^-+|-+$/g,'');
 const dir=path.resolve(ROOT,process.env.VIDEO_WORKSPACE||'workspace','scripts',name);await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(path.join(dir,'brief.json'),JSON.stringify(b,null,1)+'\n');await fs.writeFile(path.join(dir,'brief.md'),briefMarkdown(b));
 out({brief:path.join(dir,'brief.md'),language:b.language,seconds:b.seconds,lines:b.lines,words:b.words,facts:Object.fromEntries(['name','what','feature','number','price','quote'].map(k=>[k,r.facts.filter(f=>f.kind===k).length])),notes:r.notes,
  next:`Write ${path.join(dir,'script.txt')} from the brief (one sentence a line), then: pnpm tempoloom write --check ${path.relative(ROOT,path.join(dir,'script.txt'))}`});
}
main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
