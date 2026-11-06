import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './config.js';
import type {Config} from './schema.js';
// Read TrueType/OpenType cmap directly. Browser-native HarfBuzz still performs
// all shaping; this check prevents silent fallback for unsupported code points.
export function fontCoverage(file:string){
 const b=fs.readFileSync(file);let cmap=-1;
 for(let i=0;i<b.readUInt16BE(4);i++){const o=12+i*16;if(b.toString('ascii',o,o+4)==='cmap')cmap=b.readUInt32BE(o+8);}
 if(cmap<0)throw new Error('Font has no cmap: '+file);
 const tables:number[]=[];
 for(let i=0;i<b.readUInt16BE(cmap+2);i++){
  const o=cmap+4+i*8,platform=b.readUInt16BE(o),encoding=b.readUInt16BE(o+2);
  if(platform===0||(platform===3&&(encoding===1||encoding===10)))tables.push(cmap+b.readUInt32BE(o+4));
 }
 return (cp:number)=>tables.some(t=>{
  const format=b.readUInt16BE(t);
  if(format===12){const groups=b.readUInt32BE(t+12);let lo=0,hi=groups-1;while(lo<=hi){const mid=(lo+hi)>>1,o=t+16+mid*12,start=b.readUInt32BE(o),end=b.readUInt32BE(o+4);if(cp<start)hi=mid-1;else if(cp>end)lo=mid+1;else return b.readUInt32BE(o+8)+(cp-start)!==0;}return false;}
  if(format===4&&cp<=65535){const n=b.readUInt16BE(t+6)/2,end=t+14,start=end+2*n+2,delta=start+2*n,range=delta+2*n;
   for(let i=0;i<n;i++){if(cp>b.readUInt16BE(end+2*i))continue;if(cp<b.readUInt16BE(start+2*i))return false;const d=b.readInt16BE(delta+2*i),r=b.readUInt16BE(range+2*i);if(r===0)return ((cp+d)&65535)!==0;const offset=range+2*i+r+2*(cp-b.readUInt16BE(start+2*i));if(offset+2>b.length)return false;const glyph=b.readUInt16BE(offset);return glyph!==0&&((glyph+d)&65535)!==0;}
  }
  return false;
 });
}
export function checkGlyphs(text:string,c:Config){
 const fonts=[c.font,...c.fallbacks].map(p=>fontCoverage(path.resolve(ROOT,p)));
 const printable=[...new Set([...text].filter(ch=>!/[\s\p{Cf}]/u.test(ch)))];
 const missing=printable.filter(ch=>!fonts.some(has=>has(ch.codePointAt(0)!)));
 if(missing.length)throw new Error('Missing glyphs '+missing.map(ch=>ch+' U+'+ch.codePointAt(0)!.toString(16).toUpperCase()).join(', ')+'. Configure an explicit compatible TTF/OTF fallback.');
 return {primary:c.font,fallbackGlyphs:printable.filter(ch=>!fonts[0](ch.codePointAt(0)!)),fonts:[c.font,...c.fallbacks]};
}
