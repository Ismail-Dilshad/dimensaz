import {chromium} from 'playwright';
const [,,svg,out,w]=process.argv;
import {chromiumExecutable} from '../src/renderer/browser-path.ts';
const b=await chromium.launch({executablePath:chromiumExecutable()});const p=await b.newPage({viewport:{width:Number(w),height:400}});
await p.goto('file://'+svg);const el=await p.$('svg');await el.screenshot({path:out,omitBackground:true});await b.close();
