import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../src/renderer/browser-path.js';
import {ffmpeg,run} from '../src/renderer/ffmpeg-encoder.js';

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('teaching modes compose editable directions, preserve custom choices, and submit the selected study',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'tl-teach-ui-'));
 const clip=path.join(temp,'clip.mp4'),cropped=path.join(temp,'cropped.mp4');
 await run(ffmpeg,['-v','error','-f','lavfi','-i','color=c=0x16383a:s=320x180:d=12:r=25','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',clip]);
 await run(ffmpeg,['-v','error','-i',clip,'-vf','crop=180:180:70:0','-c:v','libx264','-movflags','+faststart',cropped]);
 const browser=await chromium.launch({executablePath:chromiumExecutable(),headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:1080},colorScheme:'light',reducedMotion:'reduce'});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);
 const topics=Object.entries({pacing:'Pacing and rhythm',transitions:'Transitions and cuts',motion:'Motion and animation',typography:'Text and typography',color:'Colour',design:'Layout and composition',audio:'Music and sound',script:'Hook and script',captions:'Captions',editing:'Editing choices'}).map(([id,label])=>({id,label}));
 let sent:Record<string,unknown>|null=null,cropRequest:Record<string,unknown>|null=null;
 let failNextSubmission=true;
 let releaseSubmission=()=>{};
 const submissionResponse=new Promise<void>(resolve=>{releaseSubmission=resolve;});
 const draft={id:'editor-demo',title:'studio_reference',source:'upload',status:'draft',media:{seconds:12,width:320,height:180,fps:25,audio:true}};
 try{
  await page.route('http://teach.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/home')return route.fulfill({json:{teach:{videos:0,waiting:0,lessons:0,patterns:0},studio:{jobs:0},scores:{good:0,bad:0},brain:{total:0,byStatus:{}},you:[],agent:[],activity:[]}});
   if(url.pathname==='/api/state')return route.fulfill({json:{videos:sent?[]:[draft],topics,can:{maxMB:2048,speech:true}}});
   if(url.pathname==='/api/videos/editor-demo/crop'){
    cropRequest=route.request().postDataJSON();
    return route.fulfill({json:{name:'crop-0123456789abcdef.mp4',crop:cropRequest,media:{seconds:12,width:180,height:180,fps:25,audio:false}}});
   }
   if(url.pathname==='/api/videos/editor-demo/teach'){
    if(failNextSubmission){failNextSubmission=false;return route.fulfill({status:503,json:{error:'Temporary study failure'}});}
    sent=route.request().postDataJSON();await submissionResponse;return route.fulfill({json:{ok:true}});
   }
   if(url.pathname.startsWith('/media/')){
    const bytes=await fs.readFile(url.pathname.includes('/crop-')?cropped:clip),range=/bytes=(\d+)-(\d*)/.exec(route.request().headers().range||'');
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;return route.fulfill({status:206,headers:{'content-type':'video/mp4','accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${bytes.length}`},body:bytes.subarray(start,end+1)});}
    return route.fulfill({body:bytes,contentType:'video/mp4'});
   }
   if(url.pathname.startsWith('/logo'))return route.fulfill({body:await fs.readFile('assets/brand/logo/svg/tempoloom-wordmark-for-'+(url.pathname.includes('light')?'light':'dark')+'.svg'),contentType:'image/svg+xml'});
   const name=url.pathname==='/'?'index.html':path.basename(url.pathname);
   if(!['index.html','app.css','core.js','home.js','teach.js','studio.js'].includes(name))return route.fulfill({status:204});
   return route.fulfill({body:await fs.readFile(path.resolve('src/teach/ui',name)),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://teach.test/#/teach/add');
  await page.getByRole('heading',{name:'Shape what your studio learns'}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('#filmstrip img').length===8);
  expect(await page.locator('#filmstrip-status').isHidden()).toBe(true);
  const speed=page.getByRole('combobox',{name:/Playback speed/});
  for(const control of [page.locator('#play'),page.locator('#back'),speed,page.locator('#study-title'),page.locator('#range-in')]){
   expect((await control.boundingBox())!.height).toBe(38);
  }
  await speed.click();await page.getByRole('option',{name:'0.5×',exact:true}).click();
  expect(await page.locator('#v').evaluate(el=>(el as HTMLVideoElement).playbackRate)).toBe(.5);
  await speed.click();await page.getByRole('option',{name:'1×',exact:true}).click();
  await page.getByRole('button',{name:'Mute preview',exact:true}).click();
  expect(await page.locator('#v').evaluate(el=>(el as HTMLVideoElement).muted)).toBe(true);
  await page.getByRole('button',{name:'Unmute preview',exact:true}).click();
  if(await page.evaluate(()=>document.fullscreenEnabled)){
   await page.getByRole('button',{name:'Full screen preview',exact:true}).click();
   await page.waitForFunction(()=>document.fullscreenElement?.id==='stage');
   expect(await page.locator('#v').evaluate(el=>(el as HTMLVideoElement).controls)).toBe(true);
   await page.evaluate(()=>document.exitFullscreen());
   await page.waitForFunction(()=>!(document.querySelector('#v') as HTMLVideoElement).controls);
  }
  const playhead=page.getByRole('slider',{name:'Playhead',exact:true});
  await playhead.focus();await page.keyboard.press('ArrowRight');
  expect(await page.locator('#v').evaluate(el=>(el as HTMLVideoElement).currentTime)).toBeCloseTo(.04,2);
  await page.getByRole('slider',{name:'Study start',exact:true}).focus();await page.keyboard.press('ArrowRight');
  expect(await page.locator('#range-in').inputValue()).toBe('0.04');
  await page.keyboard.press('Home');
  expect(await page.locator('#range-in').inputValue()).toBe('0.00');
  await page.locator('#range-out').fill('0.5');await page.locator('#range-out').press('Tab');
  await page.getByRole('button',{name:'Play selection',exact:true}).click();
  await page.waitForFunction(()=>{const v=document.querySelector('#v') as HTMLVideoElement;return v.paused&&v.currentTime>=.5;});
  expect(await page.locator('#v').evaluate(el=>(el as HTMLVideoElement).currentTime)).toBeCloseTo(.5,2);
  await page.getByRole('button',{name:'Whole clip',exact:true}).click();
  await page.locator('#play').click();
  await page.waitForFunction(()=>!(document.querySelector('#v') as HTMLVideoElement).paused);
  await page.evaluate(()=>{location.hash='/home';});
  await page.getByRole('heading',{name:'Your creative workspace.'}).waitFor();
  await page.evaluate(()=>{location.hash='/teach/add';});
  await page.getByRole('heading',{name:'Shape what your studio learns'}).waitFor();
  expect(await page.locator('#study-title').inputValue()).toContain('Motion study');
  expect(await page.locator('#prompt').inputValue()).toContain('motion and animation');
  expect(await page.locator('#focus-count').textContent()).toBe('5 selected');
  await page.getByRole('button',{name:/Footage editing/}).click();
  expect(await page.locator('#focus-count').textContent()).toBe('4 selected');
  expect(await page.locator('#sound').isChecked()).toBe(true);
  await page.getByRole('radio',{name:/Learn what to avoid/}).check();
  expect(await page.locator('#prompt').inputValue()).toContain('does not work');
  await page.getByRole('textbox',{name:'Reference title'}).fill('My reference — ڕیتم');
  await page.getByRole('textbox',{name:'Study direction'}).fill('Keep my own instructions exactly.');
  await page.getByRole('button',{name:/Storytelling/}).click();
  expect(await page.locator('#study-title').inputValue()).toBe('My reference — ڕیتم');
  expect(await page.locator('#prompt').inputValue()).toBe('Keep my own instructions exactly.');
  expect(await page.getByRole('switch',{name:'Auto name'}).isChecked()).toBe(false);
  await page.getByRole('switch',{name:'Auto compose'}).check();
  expect(await page.locator('#prompt').inputValue()).toContain('hook and script');
  await page.getByRole('button',{name:'First 5 s',exact:true}).click();
  expect(await page.locator('#range-out').inputValue()).toBe('5.00');
  expect(await page.locator('#prompt').inputValue()).toContain('00.00 to 0:05.00');
  await page.waitForFunction(()=>(document.querySelector('#v') as HTMLVideoElement).readyState>=1);
  await page.locator('#v').evaluate(el=>{(el as HTMLVideoElement).currentTime=2;});
  await page.waitForFunction(()=>(document.querySelector('#v') as HTMLVideoElement).currentTime>=2);
  await page.getByRole('button',{name:'Add moment',exact:true}).click();
  await page.getByRole('textbox',{name:/Note for the mark/}).fill('Watch the transition');
  expect(await page.locator('#prompt').inputValue()).toContain('Watch the transition');
  await page.getByText('Refine the focus',{exact:false}).click();
  const caption=page.getByRole('button',{name:'Captions',exact:true});await caption.focus();await page.keyboard.press('Space');
  expect(await caption.getAttribute('aria-pressed')).toBe('false');
  expect(await page.locator('#v').evaluate(el=>(el as HTMLVideoElement).paused)).toBe(true);
  const audioFocus=page.getByRole('button',{name:'Music and sound',exact:true});
  await audioFocus.click();
  await page.getByText('Audio & library settings',{exact:true}).click();
  expect(await page.getByRole('switch',{name:/Study the soundtrack/}).isChecked()).toBe(true);
  await page.getByRole('switch',{name:/Transcribe speech/}).check();
  await page.getByRole('switch',{name:/Study the soundtrack/}).uncheck();
  expect(await audioFocus.getAttribute('aria-pressed')).toBe('false');
  expect(await page.getByRole('switch',{name:/Transcribe speech/}).isChecked()).toBe(false);
  expect(await page.getByRole('switch',{name:/Transcribe speech/}).isDisabled()).toBe(true);
  await page.getByRole('switch',{name:/Study the soundtrack/}).check();
  expect(await audioFocus.getAttribute('aria-pressed')).toBe('true');
  await audioFocus.click();
  expect(await page.getByRole('switch',{name:/Study the soundtrack/}).isChecked()).toBe(false);
  await page.getByRole('button',{name:'Crop frame',exact:true}).click();
  await page.getByRole('button',{name:'1:1',exact:true}).click();
  expect(await page.getByRole('button',{name:'Teach this video',exact:false}).isDisabled()).toBe(true);
  await page.getByRole('button',{name:'Apply crop',exact:true}).click();
  await page.waitForFunction(()=>(document.querySelector('#v') as HTMLVideoElement).videoWidth===180);
  expect(cropRequest).toMatchObject({x:.21875,y:0,w:.5625,h:1});
  expect(await page.locator('#crop').isHidden()).toBe(true);
  expect(await page.locator('#preview-dimensions').textContent()).toBe('180 × 180');
  await page.getByRole('button',{name:'Adjust crop',exact:true}).click();
  await page.getByRole('button',{name:'9:16',exact:true}).click();
  await page.getByRole('button',{name:'Cancel crop',exact:true}).click();
  expect(await page.locator('#preview-dimensions').textContent()).toBe('180 × 180');
  await page.getByRole('button',{name:'Adjust crop',exact:true}).click();
  expect(await page.getByRole('button',{name:'1:1',exact:true}).getAttribute('class')).toContain('on');
  await page.getByRole('button',{name:'Cancel crop',exact:true}).click();
  await page.getByRole('button',{name:'Reset crop',exact:true}).click();
  await page.waitForFunction(()=>(document.querySelector('#v') as HTMLVideoElement).videoWidth===320);
  expect(await page.locator('#preview-dimensions').textContent()).toBe('320 × 180');
  await page.getByRole('button',{name:'Crop frame',exact:true}).click();
  await page.getByRole('button',{name:'1:1',exact:true}).click();
  await page.getByRole('button',{name:'Apply crop',exact:true}).click();
  await page.getByRole('button',{name:'Adjust crop',exact:true}).waitFor();
  await page.getByRole('button',{name:'Add video',exact:true}).click();
  await page.getByRole('heading',{name:'Teach your studio something new'}).waitFor();
  await page.getByRole('button',{name:'Set up',exact:true}).click();
  expect(await page.locator('#study-title').inputValue()).toBe('My reference — ڕیتم');
  expect(await page.locator('#range-out').inputValue()).toBe('5.00');
  if(process.env.DASHBOARD_SCREENSHOTS){
   await page.waitForFunction(()=>document.querySelectorAll('#filmstrip img').length===8);
   await fs.mkdir('workspace/cache/dashboard-review',{recursive:true});
   await page.screenshot({path:'workspace/cache/dashboard-review/teach-editor-light.png',fullPage:true});
   await page.locator('.side-footer').getByRole('button',{name:'Dark theme',exact:true}).click();
   await page.waitForFunction(()=>{const img=document.querySelector<HTMLImageElement>('.logo-mark');return img?.complete&&img.naturalWidth>0;});
   await page.screenshot({path:'workspace/cache/dashboard-review/teach-editor-dark.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(process.env.DASHBOARD_SCREENSHOTS)await page.screenshot({path:'workspace/cache/dashboard-review/teach-editor-mobile.png',fullPage:true});
  await page.getByText('Audio & library settings',{exact:true}).click();
  expect(await page.getByRole('switch',{name:/Transcribe speech/}).isDisabled()).toBe(true);
  await page.getByRole('switch',{name:/Keep a playable copy/}).uncheck();
  await page.getByRole('button',{name:'Teach this video',exact:false}).click();
  await page.getByText('Temporary study failure',{exact:true}).waitFor();
  expect(await page.getByRole('button',{name:'Teach this video',exact:false}).isEnabled()).toBe(true);
  expect(await page.locator('#study-title').inputValue()).toBe('My reference — ڕیتم');
  await page.getByRole('button',{name:'Teach this video',exact:false}).click();
  await expect.poll(()=>sent).not.toBeNull();
  await page.evaluate(()=>{location.hash='/home';});
  await page.getByRole('heading',{name:'Your creative workspace.'}).waitFor();
  releaseSubmission();
  await page.getByText('Sent. It is being measured.',{exact:true}).waitFor();
  expect(new URL(page.url()).hash).toBe('#/home');
  await page.evaluate(()=>{location.hash='/teach/library';});
  await page.getByRole('heading',{name:'No videos taught yet'}).waitFor();
  expect(sent).toMatchObject({title:'My reference — ڕیتم',verdict:'bad',topics:['script','pacing','design'],segment:{start:0,end:5},marks:[{t:2,note:'Watch the transition'}],keepPlayback:false,sound:false,speech:false,crop:{x:.21875,y:0,w:.5625,h:1}});
  expect(errors).toEqual([]);
 }finally{releaseSubmission();await browser.close();await fs.rm(temp,{recursive:true,force:true});}
},30000);
