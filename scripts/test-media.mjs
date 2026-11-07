import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),temp=path.join(root,'workspace/cache/temp');
fs.mkdirSync(temp,{recursive:true});
const python=process.env.VIDEO_PYTHON||path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const result=spawnSync(python,['-m','unittest','discover','-s','media_tools/tests','-v'],{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,TEMP:temp,TMP:temp,TMPDIR:temp,PYTHONUTF8:'1'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
