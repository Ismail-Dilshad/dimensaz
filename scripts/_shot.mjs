import {chromium} from 'playwright';
const [,,svg,out,w]=process.argv;
const b=await chromium.launch();const p=await b.newPage({viewport:{width:Number(w),height:400}});
await p.goto('file://'+svg);const el=await p.$('svg');await el.screenshot({path:out,omitBackground:true});await b.close();
