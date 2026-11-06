import path from 'node:path';
import {ffmpeg,run} from '../renderer/ffmpeg-encoder.js';
const folder=path.resolve('workspace/reference-production-assets/providers');
const files=[path.resolve('assets/sfx/clicks/single-mechanical-click.mp3'),...['click_001','confirmation_001','maximize_001','minimize_001','drop_001','open_001','scroll_001','switch_001'].map(n=>path.join(folder,n+'.ogg'))];
const args=['-v','error','-n'];for(const file of files)args.push('-i',file);
const filters=files.map((_,i)=>'['+i+':a]aresample=48000,aformat=channel_layouts=mono,atrim=duration=0.7,apad,atrim=duration=1[a'+i+']');
filters.push(files.map((_,i)=>'[a'+i+']').join('')+'concat=n='+files.length+':v=0:a=1[out]');
const output=path.join(folder,'audition.mp3');
await run(ffmpeg,[...args,'-filter_complex',filters.join(';'),'-map','[out]','-b:a','96k',output]);console.log(JSON.stringify({file:output,seconds:files.map((file,i)=>({at:i,file}))}));
