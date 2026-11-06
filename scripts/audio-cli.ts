import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {runAudioPython,analyzeProjectAudio,applyAudioAnalysis} from '../src/engine/audio-analysis.js';
import {ROOT} from '../src/engine/config.js';
import {load,writeJSON,dir} from '../src/engine/project.js';
const [command,...args]=process.argv.slice(2);
function value(name:string){const at=args.indexOf(name);return at<0?undefined:args[at+1];}
function required(name:string){const v=value(name);if(!v||v.startsWith('--'))throw new Error('Missing '+name);return v;}
let result:unknown;
switch(command){
 case 'doctor':result=await runAudioPython(['doctor']);break;
 case 'precision-probe':result=await runAudioPython(['precision-probe']);break;
 case 'setup':{
  const allowed=['--install-deps','--download-models','--repair','--convert','--validate-model'];
  const out=path.join(ROOT,'workspace/history','audio-setup-'+randomUUID()+'.json');
  const params=['setup','--output',out,...allowed.filter(flag=>args.includes(flag))];
  for(const flag of ['--model','--cache'])if(value(flag))params.push(flag,required(flag));
  result={receipt:out,result:await runAudioPython(params,60*60*1000)};break;
 }
 case 'analyze':{
  const backend=value('--backend')||'auto';
  if(!['auto','ctc','whisper','pauses'].includes(backend))throw new Error('Unknown audio backend');
  const device=value('--device')||'auto';if(!['auto','cpu','cuda'].includes(device))throw new Error('Unknown device');
  result=await analyzeProjectAudio(await load(required('--project')),{backend:backend as 'auto'|'ctc'|'whisper'|'pauses',model:value('--model'),download:args.includes('--allow-download'),refresh:args.includes('--refresh'),device:device as 'auto'|'cpu'|'cuda',computeType:value('--compute-type'),chunkSeconds:value('--chunk-seconds')?Number(required('--chunk-seconds')):undefined});break;
 }
 case 'benchmark':{
  const p=await load(required('--project'));
  const runs:unknown[]=[];
  const modes=[{backend:'ctc' as const,device:'cpu' as const},{backend:'ctc' as const,device:'cuda' as const},{backend:'whisper' as const,device:'cpu' as const,computeType:'int8_float32'},{backend:'whisper' as const,device:'cuda' as const,computeType:'int8_float32'}];
  for(const options of modes){
   const start=performance.now();
   try{runs.push({options,analysis:await analyzeProjectAudio(p,{...options,refresh:true}),elapsedSeconds:(performance.now()-start)/1000});}
   catch(error){runs.push({options,error:String(error),elapsedSeconds:(performance.now()-start)/1000});}
  }
  const file=path.join(dir(p.id,p.config),'audio-benchmark-'+randomUUID()+'.json');
  const report={project:p.id,runs,accuracy:'Not measured without reviewed acoustic samples',note:'Each analysis runs in a fresh Python process; failures are not successful inference timings'};
  await writeJSON(file,report);result={file,...report};break;
 }
 case 'evaluate':{
  const file=path.resolve(required('--file')),out=path.join(path.dirname(file),'reviewed-sample-evaluation-'+randomUUID()+'.json');
  result={file:out,result:await runAudioPython(['evaluate','--analysis',file,'--reference',path.resolve(required('--reference')),'--output',out])};break;
 }
 case 'correct':{
  const file=path.resolve(required('--file')),out=path.join(path.dirname(file),'alignment-corrected-'+randomUUID()+'.json');
  result=await runAudioPython(['correct','--analysis',file,'--patch',path.resolve(required('--patch')),'--reviewer',required('--reviewer'),'--output',out]);break;
 }
 case 'apply':result=await applyAudioAnalysis(required('--project'),path.resolve(required('--file')));break;
 default:throw new Error('Use audio doctor|setup|precision-probe|analyze|benchmark|evaluate|correct|apply');
}
console.log(JSON.stringify(result,null,2));
