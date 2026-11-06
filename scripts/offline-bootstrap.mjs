// Local validation helper: COPY already-installed packages, without network.
// Normal setup is pnpm install; the copied node_modules directory is ignored.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const [runtime,store]=process.argv.slice(2);
if(!runtime||!store)throw new Error('Usage: node scripts/offline-bootstrap.mjs RUNTIME_NODE_MODULES PNPM_VIRTUAL_STORE');
fs.mkdirSync('node_modules',{recursive:true});const visited=new Set();
function resolvePackage(name,source){
 const require=createRequire(path.join(source,'package.json'));let entry;
 try{entry=require.resolve(name+'/package.json');}catch{try{entry=require.resolve(name);}catch{return;}}
 let current=path.dirname(entry);
 while(current!==path.dirname(current)){const pkg=path.join(current,'package.json');if(fs.existsSync(pkg)&&JSON.parse(fs.readFileSync(pkg,'utf8')).name===name)return current;current=path.dirname(current);}
}
function link(name,source){
 if(visited.has(name))return;visited.add(name);const target=path.resolve('node_modules',name);
 if(!fs.existsSync(source))throw new Error('Missing cached package '+source);
 if(!fs.existsSync(target)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(source,target,{recursive:true,dereference:true,filter:p=>p===source||path.basename(p)!=='node_modules'});}
 const pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
 for(const [dep] of Object.entries({...pkg.dependencies,...pkg.optionalDependencies,...pkg.peerDependencies})){
  const resolved=resolvePackage(dep,source);if(resolved)link(dep,resolved);
 }
}
for(const name of ['playwright','playwright-core'])link(name,path.join(runtime,name));
for(const name of ['tsx','typescript','vitest','esbuild','zod','@types/node']){
 const match=fs.readdirSync(store).find(n=>n.startsWith(name.replace('/','+')+'@'));if(!match)throw new Error('Missing cached '+name);link(name,path.join(store,match,'node_modules',name));
}
fs.mkdirSync('node_modules/.bin',{recursive:true});
for(const [name,entry] of Object.entries({tsx:'tsx/dist/cli.mjs',tsc:'typescript/bin/tsc',vitest:'vitest/vitest.mjs',playwright:'playwright/cli.js'})){
 fs.writeFileSync('node_modules/.bin/'+name+'.cmd','@echo off\r\nnode "%~dp0\\..\\'+entry.replaceAll('/','\\')+'" %*\r\n');
}
console.log('Copied '+visited.size+' cached packages for validation.');
