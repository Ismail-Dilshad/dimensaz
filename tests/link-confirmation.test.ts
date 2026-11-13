import {it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({draftFromLink:vi.fn()}));
vi.mock('../src/engine/teach/teach.js',()=>({recover:()=>{},draftFromLink:mocks.draftFromLink}));
import {serve} from '../src/teach/server.js';
it('binds a download to its preview, URL and chosen media identity',async()=>{
 const choices=[{id:'first',item:1},{id:'second',item:2}];
 mocks.draftFromLink.mockImplementation(async(_url,confirm)=>confirm?{status:'ready',video:{id:'new-draft'}}:{status:'needs-confirmation',info:{choices}});
 const server=await serve({port:0});
 try{
  const base='http://127.0.0.1:'+server.port;
  const post=(data:unknown)=>fetch(base+'/api/link',{method:'POST',headers:{'x-teach-key':server.key,'content-type':'application/json'},body:JSON.stringify(data)});
  const url='https://www.instagram.com/p/CorrectCode/';
  expect((await post({url,confirm:true,selection:choices[0]})).status).toBe(400);
  const preview=await (await post({url,confirm:false})).json() as {previewToken:string};
  expect(mocks.draftFromLink).toHaveBeenCalledTimes(1);
  expect((await post({url:url+'?other',confirm:true,previewToken:preview.previewToken,selection:choices[0]})).status).toBe(400);
  expect((await post({url,confirm:true,previewToken:preview.previewToken,selection:{id:'wrong',item:2}})).status).toBe(400);
  expect((await post({url,confirm:true,previewToken:preview.previewToken,selection:choices[1]})).status).toBe(200);
  expect(mocks.draftFromLink).toHaveBeenLastCalledWith(url,true,choices[1]);
  expect((await post({url,confirm:true,previewToken:preview.previewToken,selection:choices[1]})).status).toBe(400);
 }finally{await server.close();}
});
