import {it,expect,beforeAll,afterAll} from 'vitest';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {scanBrand,normalizeHex,cssColors,cssFonts} from '../src/engine/brand-scan.js';

const png=Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000','hex');
const pages:Record<string,[string,string|Buffer]>={
 '/':['text/html',`<!doctype html><html><head><title>Flowly | Automate team work</title>
  <meta name="description" content="Flowly runs your projects for you."><meta name="theme-color" content="#4f46e5">
  <meta property="og:site_name" content="Flowly"><meta property="og:image" content="/og.png">
  <link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/main.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Inter:wght@400">
  <style>:root{--brand-primary:#4F46E5;--brand-accent:#22d3a5}</style></head>
  <body><header><img class="site-logo" src="/logo.svg" alt="Flowly logo"></header><h1 style="color:#0f172a">Hi</h1></body></html>`],
 '/main.css':['text/css','body{background:#F7F8FC;color:#0F172A;font-family:"Space Grotesk",sans-serif}a{color:#4f46e5}.b{background:rgba(79,70,229,1)}.t{color:rgba(0,0,0,.2)}'],
 '/logo.svg':['image/svg+xml','<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'],
 '/favicon.png':['image/png',png],'/og.png':['image/png',png],
};
let server:http.Server,base='';
beforeAll(async()=>{server=http.createServer((req,res)=>{const p=pages[req.url??''];if(!p){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':p[0]});res.end(p[1]);});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/`;});
afterAll(()=>server.close());

it('normalises colours and reads CSS colours and fonts',()=>{
 expect(normalizeHex('#abc')).toBe('#AABBCC');expect(normalizeHex('rgba(79,70,229,1)')).toBe('#4F46E5');expect(normalizeHex('rgba(0,0,0,.2)')).toBeNull();
 const m=cssColors(':root{--brand-primary:#ff0000} a{color:#00ff00}','x');expect(m.get('#FF0000')!.count).toBeGreaterThan(m.get('#00FF00')!.count);
 expect(cssFonts('h1{font-family:"Clash Display",system-ui,sans-serif}','x').map(f=>f.family)).toEqual(['Clash Display']);
});

it('scans a product site for name, colours, fonts and logo, and saves the logo files',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rw-brand-'));
 const r=await scanBrand(base,{download:true,outDir:path.join(dir,'flowly')});
 expect(r.name).toBe('Flowly');expect(r.description).toContain('runs your projects');expect(r.themeColor).toBe('#4F46E5');
 expect(r.colors[0].hex).toBe('#4F46E5');expect(r.accentCandidates).toContain('#22D3A5');
 expect(r.fonts.map(f=>f.family)).toEqual(expect.arrayContaining(['Space Grotesk','Inter']));
 expect(r.logos.find(l=>l.kind==='img')?.url).toBe(base+'logo.svg');
 const saved=await fs.readdir(path.join(dir,'flowly'));
 expect(saved).toEqual(expect.arrayContaining(['brand-scan.json']));expect(saved.some(f=>f.startsWith('img-')&&f.endsWith('.svg'))).toBe(true);
 expect(saved.some(f=>f.startsWith('og-image-'))).toBe(true);
});
