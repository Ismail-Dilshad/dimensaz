import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {z} from 'zod';
import {download} from '../engine/asset-download.js';
import {categories,indexSfx} from '../engine/sfx.js';
import {ffprobe,ffmpeg} from '../renderer/ffmpeg-encoder.js';
import {execute} from '../motion-library/analyzer.js';
const metadataSchema=z.object({name:z.string().min(1),category:z.enum(categories),format:z.enum(['wav','mp3','ogg','flac','m4a']),sourceUrl:z.string().url(),creator:z.string().nullable(),license:z.string().min(1),licenseEvidence:z.string().min(1),commercial:z.literal(true),verified:z.literal(true),attribution:z.string(),tags:z.array(z.string()).default([]),authorizedHosts:z.array(z.string()).min(1)}).strict();
const {values:v}=parseArgs({options:{manifest:{type:'string'},url:{type:'string'},file:{type:'string'}}});
async function main(){
 if(!v.manifest||!!v.file===!!v.url)throw new Error('Provide metadata manifest and exactly one of --url or --file');
 const metadata=metadataSchema.parse(JSON.parse(await fs.readFile(v.manifest,'utf8')));
 const bytes=v.url?(await download(v.url,metadata.authorizedHosts)).bytes:await fs.readFile(v.file!);
 if(!bytes.length||bytes.length>25*1024*1024)throw new Error('Empty or oversized sound');
 const hash=createHash('sha256').update(bytes).digest('hex');const index=await indexSfx(path.resolve('assets/sfx'));const existing=index.find(s=>s.sha256===hash);if(existing)return {duplicate:true,file:existing.file};
 const temp=path.resolve('workspace/cache/sfx-'+randomUUID()+'.'+metadata.format);await fs.writeFile(temp,bytes,{flag:'wx'});
 const signatures:Record<string,boolean>={wav:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE',mp3:bytes.toString('ascii',0,3)==='ID3'||bytes[0]===255&&(bytes[1]&224)===224,ogg:bytes.toString('ascii',0,4)==='OggS',flac:bytes.toString('ascii',0,4)==='fLaC',m4a:bytes.toString('ascii',4,8)==='ftyp'};if(!signatures[metadata.format])throw new Error('Audio signature does not match requested format');
 const info=JSON.parse(await execute(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',temp],20000));const audio=info.streams.filter((s:{codec_type:string})=>s.codec_type==='audio');const duration=Number(info.format.duration);if(audio.length!==1||info.streams.some((s:{codec_type:string})=>s.codec_type==='video')||!Number.isFinite(duration)||duration<=0||duration>120)throw new Error('Expected one audio stream, no video, duration <=120 seconds');
 await execute(ffmpeg,['-v','error','-xerror','-protocol_whitelist','file,pipe','-i',temp,'-f','null','-'],30000);
 const slug=metadata.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'sound';const target=path.resolve('assets/sfx',metadata.category,slug+'-'+hash.slice(0,12)+'.'+metadata.format);
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(temp,target,fs.constants.COPYFILE_EXCL);
 await fs.writeFile(target+'.json',JSON.stringify({...metadata,id:'sfx-'+hash,sha256:hash,duration,downloadUrl:v.url??null,importedAt:new Date().toISOString()},null,2),{flag:'wx'});
 await indexSfx(path.resolve('assets/sfx'));return {file:target,sha256:hash,duration,duplicate:false};
}
main().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(JSON.stringify({error:String(e)}));process.exitCode=1;});

