import {beforeEach,afterAll,it,expect,vi} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const mocks=vi.hoisted(()=>({run:vi.fn()}));
vi.mock('../src/reach/tools.js',()=>({ensureYtdlp:async()=>{},run:mocks.run,pythonPath:()=>'/python',ytdlpBase:()=>['-m','yt_dlp'],CommandFailed:class extends Error{}}));
vi.mock('../src/reach/browser.js',()=>({savedCookies:()=>[],isRunning:async()=>false,port:()=>9333}));
import {parseVideoMetadata,selectVideo,videoTarget,downloadVideo,videoInfo} from '../src/reach/backends/ytdlp.js';
import {referenceInfo,downloadReference} from '../src/engine/sourcing/reference-video.js';
const url='https://www.instagram.com/p/CorrectCode/?igsh=tracking';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'tl-link-'));
const single={id:'media-1',title:'The right video',webpage_url:'https://www.instagram.com/p/CorrectCode/',duration:12,extractor_key:'Instagram'};
const carousel={...single,id:'CorrectCode',entries:[{...single,id:'slide-1'},{...single,id:'slide-2'}]};
beforeEach(()=>{mocks.run.mockReset();});
afterAll(()=>fs.rm(root,{recursive:true,force:true}));
it('normalizes Instagram post links and rejects profile feeds',()=>{
 expect(videoTarget(url)).toBe('https://www.instagram.com/p/CorrectCode/');
 expect(()=>videoTarget('https://www.instagram.com/explore/')).toThrow(/post or reel/);
});
it('keeps carousel order including missing entries and selects the requested slide',()=>{
 const items=parseVideoMetadata({...carousel,entries:[null,carousel.entries[1]]},url);
 expect(items[0]!.item).toBe(2);
 expect(selectVideo(items,url+' &img_index=2').id).toBe('slide-2');
});
it('refuses a different Instagram post and ambiguous carousel downloads',()=>{
 expect(()=>parseVideoMetadata({...single,webpage_url:'https://www.instagram.com/reel/WrongCode/'},url)).toThrow(/different post/);
 const items=parseVideoMetadata(carousel,url);
 expect(()=>selectVideo(items,url)).toThrow(/several videos/);
 expect(()=>selectVideo(items,url,2,'slide-1')).toThrow(/changed/);
});
it('shows metadata for every carousel choice without downloading',async()=>{
 mocks.run.mockResolvedValue(JSON.stringify(carousel));
 const info=await referenceInfo(url);
 expect(info.choices.map(v=>v.id)).toEqual(['slide-1','slide-2']);
 expect(mocks.run).toHaveBeenCalledTimes(1);
 expect(mocks.run.mock.calls[0]![1]).toContain('--skip-download');
});
it('downloads the confirmed slide and returns its reported path instead of an older file',async()=>{
 const folder=path.join(root,'selected');await fs.mkdir(folder);
 await fs.writeFile(path.join(folder,'a-old.mp4'),'old');
 mocks.run.mockImplementation(async(_exe,args:string[])=>{
  if(args.includes('--dump-single-json'))return JSON.stringify(carousel);
  expect(args[args.indexOf('--playlist-items')+1]).toBe('2');
  expect(args[args.indexOf('--match-filter')+1]).toBe('id = "slide-2"');
  expect(args.at(-1)).toBe('https://www.instagram.com/p/CorrectCode/');
  const file=path.join(folder,'slide-2.mp4');await fs.writeFile(file,'selected');
  return JSON.stringify({id:'slide-2',file});
 });
 expect(await downloadVideo({target:url,folder,item:2,expectedId:'slide-2',timeout:30})).toEqual([path.join(folder,'slide-2.mp4')]);
});
it('stops before downloading if the preview identity changes',async()=>{
 mocks.run.mockResolvedValue(JSON.stringify({...single,id:'different'}));
 await expect(downloadVideo({target:url,folder:root,expectedId:'media-1',timeout:30})).rejects.toThrow(/changed/);
 expect(mocks.run).toHaveBeenCalledTimes(1);
});
it('rejects a downloader result for another video',async()=>{
 mocks.run.mockImplementation(async(_exe,args:string[])=>args.includes('--dump-single-json')?JSON.stringify(single):JSON.stringify({id:'wrong',file:path.join(root,'wrong.mp4')}));
 await expect(downloadVideo({target:url,folder:root,expectedId:'media-1',timeout:30})).rejects.toThrow(/selected video/);
});
it('reuses only the exact cached reference file with a valid video path',async()=>{
 mocks.run.mockResolvedValue(JSON.stringify(single));
 const info=await referenceInfo(url);
 const folder=path.join(root,'reference','instagram-media-1-full-720');await fs.mkdir(folder,{recursive:true});
 await fs.writeFile(path.join(folder,'media-1.mp4'),'cached');
 await fs.writeFile(path.join(folder,'source.json'),JSON.stringify({...info,files:['media-1.mp4']}));
 const result=await downloadReference(url,{root,maxHeight:720});
 expect(result.video).toBe(path.join(folder,'media-1.mp4'));expect(result.cached).toBe(true);
});

it('preserves platform title, description, dates, views and likes',async()=>{
 mocks.run.mockResolvedValue(JSON.stringify({...single,description:'Full caption',upload_date:'20260102',view_count:123,like_count:45,tags:['motion']}));
 const [item]=await videoInfo({target:url,timeout:30});
 expect(item).toMatchObject({text:'Full caption',published_at:'2026-01-02',raw:{views:123,likes:45,tags:['motion']}});
});
