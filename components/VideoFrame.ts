export function videoFrame(src:string,fit:'cover'|'contain'|'background-fill'){
 const wrap=document.createElement('div');wrap.style.cssText='position:absolute;inset:0;z-index:1;background:#0B0D12;';
 const v=document.createElement('video');v.src=src;v.muted=true;v.preload='auto';v.playsInline=true;v.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:'+(fit==='cover'?'cover':'contain');
 let backdrop:HTMLVideoElement|undefined;
 if(fit==='background-fill'){backdrop=document.createElement('video');backdrop.src=src;backdrop.muted=true;backdrop.preload='auto';backdrop.style.cssText='position:absolute;inset:-5%;width:110%;height:110%;object-fit:cover;filter:blur(28px);opacity:.6;';wrap.append(backdrop);}
 wrap.append(v);
 async function loaded(video:HTMLVideoElement){if(video.readyState>=2)return;await new Promise<void>((resolve,reject)=>{video.addEventListener('loadeddata',()=>resolve(),{once:true});video.addEventListener('error',()=>reject(new Error('Cannot decode footage in Chromium. Convert it to H.264 first.')),{once:true});});}
 async function seek(video:HTMLVideoElement,t:number){await loaded(video);const at=Math.min(Math.max(0,t),Math.max(0,video.duration-.05));if(Math.abs(video.currentTime-at)<.0001)return;
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Video seek timed out')),15000);video.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});video.currentTime=at;});}
 return {element:wrap,render:async(t:number)=>{await seek(v,t);if(backdrop)await seek(backdrop,t);}};
}
