import {parseArgs} from 'node:util';import {revise,save} from '../engine/project.js';import {renderProfiles} from '../renderer/performance.js';import {configSchema} from '../engine/schema.js';import {preview} from '../renderer/render-controller.js';
const {values:v}=parseArgs({options:{project:{type:'string'},preset:{type:'string',default:'final'},fps:{type:'string'},width:{type:'string'},height:{type:'string'},codec:{type:'string'},workers:{type:'string'}}});
if(!v.project||!(v.preset! in renderProfiles))throw new Error('--project and draft|preview|final preset required');
const p=await revise(v.project),profile=renderProfiles[v.preset as keyof typeof renderProfiles];
p.config=configSchema.parse({...p.config,...profile,...(v.fps?{fps:Number(v.fps)}:{}),...(v.width?{width:Number(v.width)}:{}),...(v.height?{height:Number(v.height)}:{}),...(v.codec?{codec:v.codec}:{}),...(v.workers?{captureConcurrency:Number(v.workers)}:{})});
await save(p);console.log(JSON.stringify({project:p.id,config:{width:p.config.width,height:p.config.height,fps:p.config.fps,codec:p.config.codec},preview:await preview(p,.5)},null,2));
