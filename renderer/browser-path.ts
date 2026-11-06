import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright';

export function chromiumExecutable():string {
 const override=process.env.CHROMIUM_PATH;
 if(override){
  if(!fs.existsSync(override))throw new Error('CHROMIUM_PATH does not exist: '+override);
  return override;
 }
 const expected=chromium.executablePath();
 const candidates:string[]=[];
 const bases=[
  process.env.PLAYWRIGHT_BROWSERS_PATH,
  path.dirname(path.dirname(path.dirname(expected))),
  process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'ms-playwright'),
  path.join(os.homedir(),'AppData','Local','ms-playwright'),
  path.join(os.homedir(),'.cache','ms-playwright')
 ].filter((p):p is string=>!!p&&p!=='0');
 for(const base of new Set(bases)){
  if(!fs.existsSync(base))continue;
  const builds=fs.readdirSync(base).filter(n=>/^chromium(?:_headless_shell)?-\d+$/.test(n));
  builds.sort((a,b)=>{
   const revision=Number(b.split('-').at(-1))-Number(a.split('-').at(-1));
   return revision||Number(b.includes('headless'))-Number(a.includes('headless'));
  });
  for(const build of builds){
   for(const relative of [
    'chrome-headless-shell-win64/chrome-headless-shell.exe',
    'chrome-win64/chrome.exe','chrome-win/chrome.exe',
    'chrome-linux/chrome','chrome-linux64/chrome',
    'chrome-headless-shell-linux64/chrome-headless-shell'
   ])candidates.push(path.join(base,build,relative));
  }
 }
 candidates.push(expected);
 const found=candidates.find(p=>fs.existsSync(p));
 if(!found)throw new Error('No installed Playwright Chromium found. Run pnpm exec playwright install chromium, or set CHROMIUM_PATH.');
 return found;
}
