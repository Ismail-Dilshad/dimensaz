import {parseArgs} from 'node:util';
import path from 'node:path';
import {load,dir,writeJSON} from '../engine/project.js';
import {preview} from '../renderer/render-controller.js';
const {values}=parseArgs({options:{project:{type:'string'}}});
if(!values.project)throw new Error('--project is required');
const p=await load(values.project),results=[];
for(const scale of [1,.5]){const start=performance.now();const result=await preview(p,scale);results.push({scale,elapsedMs:performance.now()-start,frames:result.files.length,pixelsPerFrame:p.config.width*p.config.height*scale*scale});}
const file=path.join(dir(p.id,p.config),'benchmark-'+Date.now()+'.json');await writeJSON(file,{note:'Single local sample; not a general speedup guarantee',results});console.log(JSON.stringify({file,results},null,2));
