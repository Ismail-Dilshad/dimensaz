import fs from 'node:fs/promises';import path from 'node:path';import {defaults,roots} from '../src/engine/config.js';import {registerTestDirectory,cleanupTestArtifacts} from '../src/engine/test-artifacts.js';
const {workspace}=roots(await defaults()),projects=path.join(workspace,'projects'),history=path.join(workspace,'history');
for(const entry of await fs.readdir(projects,{withFileTypes:true})){if(!entry.isDirectory()||entry.isSymbolicLink())continue;const folder=path.join(projects,entry.name);let p;try{p=JSON.parse(await fs.readFile(path.join(folder,'project.json'),'utf8'));}catch{continue;}if(p.config?.renderPurpose!=='test')continue;
 for(const name of ['renders','render-cache'])registerTestDirectory(path.join(folder,name),folder,history);
 registerTestDirectory(path.join(workspace,'cache','test-exports',entry.name),path.join(workspace,'cache','test-exports'),history);
}
console.log(JSON.stringify({deleted:await cleanupTestArtifacts()},null,2));
