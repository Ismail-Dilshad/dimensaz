import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {chromiumExecutable} from '../src/renderer/browser-path.js';

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('numeric states and mixed-height toast stacks stay stable in both themes',async()=>{
 const browser=await chromium.launch({executablePath:chromiumExecutable(),headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setContent('<div id="modal"></div><div id="toasts" class="toasts" role="status" aria-live="polite"></div><main style="margin:220px 24px 0;display:grid;gap:18px"><label class="f">In<input id="value" type="number" value="0.25" step="0.01" min="0" max="10"></label><label class="f">Disabled<input type="number" value="12" disabled></label><label class="f">Read only<input type="number" value="4" readonly></label></main>');
  await page.addStyleTag({content:await fs.readFile('src/teach/ui/app.css','utf8')});
  await page.addScriptTag({content:await fs.readFile('src/teach/ui/core.js','utf8')});
  await page.evaluate('Controls.start()');
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
   const input=page.locator('#value'),field=page.locator('.number-control').first();
   await input.focus();await page.waitForTimeout(260);
   const state=await field.evaluate(el=>({border:getComputedStyle(el).borderColor,accent:getComputedStyle(document.documentElement).getPropertyValue('--coral').trim(),outline:getComputedStyle(el.querySelector('input')!).outlineStyle,height:el.getBoundingClientRect().height}));
   expect(state.outline).toBe('none');expect(state.height).toBe(38);
   const accent=await page.evaluate(color=>{const el=document.createElement('span');el.style.color=color;document.body.append(el);const result=getComputedStyle(el).color;el.remove();return result;},state.accent);
   expect(state.border).toBe(accent);
   expect(await page.locator('.number-control.disabled button:disabled').count()).toBe(2);
   expect(await page.getByRole('button',{name:/Read only/}).first().isDisabled()).toBe(true);
   await page.mouse.move(0,800);await input.blur();
   await page.evaluate(()=>{(window as any).toast('This longer notification should wrap naturally without exposing its text through the compact stack. It also checks that the deck keeps a consistent card height.',true);(window as any).toast('Ready');});
   await page.locator('.toast').evaluateAll(async items=>{await Promise.all(items.flatMap(el=>el.getAnimations({subtree:true}).map(a=>a.finished)));});
   const front=page.locator('.toast').first(),back=page.locator('.toast').nth(1);
   expect((await back.boundingBox())!.height).toBeCloseTo((await front.boundingBox())!.height*.96,0);
   expect(await back.locator('p').isVisible()).toBe(false);
   expect(await front.locator('button').count()).toBe(0);
   if(process.env.DASHBOARD_SCREENSHOTS)await page.screenshot({path:`workspace/cache/dashboard-review/controls-${theme}.png`});
   const width=(await back.boundingBox())!.width;
   await back.dispatchEvent('keydown',{key:'Escape'});
   const exitWidth=await back.evaluate(el=>{const a=el.getAnimations().find(a=>(a as CSSAnimation).animationName==='toast-collapse')!;a.pause();a.currentTime=0;return el.getBoundingClientRect().width;});
   expect(exitWidth).toBeCloseTo(width,0);
   await page.evaluate(()=>document.querySelector('#toasts')!.replaceChildren());
   await page.evaluate(()=>(window as any).toast('A long error heading stays on one line as the pill expands.',true));
   const early=page.locator('.toast');
   await early.evaluate(el=>{for(const a of el.getAnimations({subtree:true})){a.pause();a.currentTime=80;}});
   expect(await early.locator('strong').evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('nowrap');
   const before=await early.evaluate(el=>({width:el.getBoundingClientRect().width,opacity:getComputedStyle(el).opacity}));
   await early.dispatchEvent('keydown',{key:'Escape'});
   const after=await early.evaluate(el=>{const a=el.getAnimations().find(a=>(a as CSSAnimation).animationName==='toast-collapse')!;a.pause();a.currentTime=0;return {width:el.getBoundingClientRect().width,opacity:getComputedStyle(el).opacity};});
   expect(after.width).toBeCloseTo(before.width,0);expect(Number(after.opacity)).toBeCloseTo(Number(before.opacity),2);
   await page.evaluate(()=>document.querySelector('#toasts')!.replaceChildren());
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>(window as any).toast('Reduced motion'));
  expect(await page.locator('.toast').evaluate(el=>el.getAnimations().length)).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await browser.close();}
},30000);
