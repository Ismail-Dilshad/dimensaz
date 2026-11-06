import os from 'node:os';
import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {download,publicAddress,DownloadError} from '../engine/asset-download.js';
import {registerAsset,libraryRecords,reusable,captureReference,sanitizeSvg,type Submission} from '../engine/asset-library.js';
const metadata:Submission={name:'Phone / test',category:'icons',tags:['phone'],style:'minimal',format:'svg',provenance:{sourceWebsite:'https://example.com',originalUrl:'https://example.com/phone.svg',creator:'Test fixture',license:'CC0-1.0',licenseUrl:'https://example.com/license',licenseEvidence:'Synthetic fixture authored for tests',commercial:true,modification:true,attribution:'None',verified:true,origin:'original',referenceIds:[]},evaluation:{reviewed:true,quality:1,relevance:1,styleConsistency:1,notes:'Synthetic test fixture'}};
const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" fill="blue"/></svg>');
it('uses bounded backoff for temporary failures and follows authorized redirects',async()=>{
 let attempts=0;const sleeps:number[]=[];
 const r=await download('https://example.com/a',['example.com'],{sleep:async ms=>{sleeps.push(ms);},transport:async url=>{attempts++;return attempts<3?{status:503,bytes:Buffer.alloc(0)}:url.pathname==='/a'?{status:302,location:'/b',bytes:Buffer.alloc(0)}:{status:200,bytes:svg};}});
 expect(r.bytes).toEqual(svg);expect(sleeps).toEqual([250,500]);expect(attempts).toBe(4);
});
it('does not retry permanent errors, oversize responses or unauthorized redirects',async()=>{
 let attempts=0;await expect(download('https://example.com',['example.com'],{transport:async()=>{attempts++;return {status:403,bytes:Buffer.alloc(0)};}})).rejects.toMatchObject({recovery:'permission'});expect(attempts).toBe(1);
 await expect(download('https://example.com',['example.com'],{limit:1,transport:async()=>({status:200,bytes:svg})})).rejects.toThrow('size limit');
 await expect(download('https://example.com',['example.com'],{transport:async()=>({status:302,location:'https://private.example/a',bytes:Buffer.alloc(0)})})).rejects.toThrow('authorized');
 expect(publicAddress('127.0.0.1')).toBe(false);expect(publicAddress('169.254.169.254')).toBe(false);expect(publicAddress('::1')).toBe(false);expect(publicAddress('8.8.8.8')).toBe(true);
});
it('rejects traversal categories, executables, invalid formats and external glTF dependencies',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'asset-test-'));
 await expect(registerAsset({...metadata,category:'../../escape'},svg,{root})).rejects.toThrow();
 await expect(registerAsset({...metadata,format:'exe'},Buffer.from('MZ'),{root})).rejects.toThrow();
 await expect(registerAsset({...metadata,format:'glb'},Buffer.from('garbage'),{root})).rejects.toThrow();
 await expect(registerAsset({...metadata,format:'gltf'},Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'../../secret'}]})),{root})).rejects.toThrow('External dependency');
});
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('sanitizes SVG, previews, categorizes, deduplicates, preserves licensing and references',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'asset-browser-'));
 const result=await registerAsset(metadata,svg,{root});const a=result.asset;
 expect(a.path).toContain('assets/library/icons/asset-');expect(a.width).toBe(24);expect(a.transparent).toBe(true);expect(a.preview).toBeTruthy();expect(reusable(a)).toBe(true);
 expect((await registerAsset(metadata,svg,{root})).duplicate).toBe(true);expect(libraryRecords(root)).toHaveLength(1);
 expect(reusable({...a,provenance:{...a.provenance,commercial:null}})).toBe(false);
 expect(reusable({...a,evaluation:{...a.evaluation,reviewed:false}})).toBe(false);
 const png=await fs.readFile(path.join(root,a.preview!));const ref=await captureReference({sourceUrl:'https://example.com',creator:null,description:'test',style:'minimal',characteristics:['outline'],restrictions:'Internal only'},png,root);expect(ref.path).toContain(path.join('references','internet'));
 await expect(sanitizeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).rejects.toThrow('element');
 await expect(sanitizeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'))).rejects.toThrow('attribute');
 await expect(sanitizeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a"/></svg>'))).rejects.toThrow();
},30000);
import {sourceAsset} from '../engine/asset-sourcing.js';
it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('reuses assets across future plans and supports an authorized browser adapter',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'asset-adapter-'));
 const candidate={submission:metadata,url:'https://example.invalid/asset.svg',authorizedHosts:[]};
 let browserCalls=0;
 const result=await sourceAsset({scene:0,query:'phone',tags:['phone'],style:'minimal',online:true},{discover:async()=>[candidate],evaluate:async c=>c[0],browserDownload:async()=>{browserCalls++;return svg;}},root);
 expect(result.status).toBe('ready');expect(browserCalls).toBe(1);
 const reused=await sourceAsset({scene:0,query:'phone',tags:['phone'],style:'minimal',online:true},{discover:async()=>{throw new Error('Must not browse');}},root);
 expect(reused.status).toBe('ready');if(reused.status==='ready')expect(reused.method).toBe('local');
 const restricted={...metadata,provenance:{...metadata.provenance,commercial:null}};
 const another=await fs.mkdtemp(path.join(os.tmpdir(),'asset-restricted-'));
 await registerAsset(restricted,svg,{root:another});
 const blocked=await sourceAsset({scene:0,query:'phone',tags:['phone'],style:'minimal',online:false},{},another);expect(blocked.status).toBe('missing');
},30000);
import {discoverLucide} from '../engine/asset-sourcing.js';
it('discovers official pinned candidates with retained license evidence using provider fixtures',async()=>{
 const sha='a'.repeat(40),tree='b'.repeat(40);const seen:string[]=[];
 const candidates=await discoverLucide('smartphone',async url=>{seen.push(url.href);const body=url.pathname.endsWith('/commits/main')?{sha}:url.pathname.endsWith('/trees/'+sha)?{tree:[{path:'icons',sha:tree}]}:url.pathname.endsWith('/trees/'+tree)?{tree:[{path:'smartphone.svg'},{path:'invalid.exe'},{path:'other.svg'}]}:null;
 return {status:200,bytes:Buffer.from(body?JSON.stringify(body):'ISC License\nPermission to use, copy, modify\nSynthetic fixture license; not a real grant')};});
 expect(candidates).toHaveLength(1);expect(candidates[0].url).toContain(sha+'/icons/smartphone.svg');expect(candidates[0].submission.evaluation.reviewed).toBe(false);expect(candidates[0].submission.provenance.licenseEvidence).toContain('Synthetic fixture');expect(seen).toHaveLength(4);
});
