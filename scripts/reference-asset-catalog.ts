import fs from 'node:fs/promises';
import path from 'node:path';

// Portable review document; the library metadata remains authoritative.
const folder='workspace/reference-production-assets';
const records:Record<string,{path:string;preview:string;hash:string}>=JSON.parse(await fs.readFile(path.join(folder,'registered-assets.json'),'utf8'));
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const cards:string[]=[];
for(const [name,asset] of Object.entries(records)){
 const meta=JSON.parse(await fs.readFile(path.join(path.dirname(asset.path),'metadata.json'),'utf8'));
 const image=(await fs.readFile(asset.preview)).toString('base64');
 cards.push(`<article><img alt="${escape(name)}" src="data:image/png;base64,${image}"><h2>${escape(name)}</h2><p>${escape(meta.description)}</p><small>Compatible: ${escape(meta.referenceIdentity.styles.join(', '))}. Fixed raster perspective; inspect before combining.</small><details><summary>Provenance and identity</summary><p>${escape(meta.provenance.license)}</p><p>${escape(meta.referenceIdentity.reviewNotes)}</p><code>${asset.hash}</code><p>${escape(asset.path)}</p></details></article>`);
}
const sounds:{file:string;duration:number}[]=JSON.parse(await fs.readFile('assets/sfx/index.json','utf8'));
const audio:string[]=[];
for(const s of sounds.filter(s=>path.basename(s.file).startsWith('kenney-'))){
 const bytes=(await fs.readFile(s.file)).toString('base64');
 audio.push(`<article><h2>${escape(path.basename(s.file))}</h2><p>Kenney · CC0 · ${s.duration.toFixed(3)} seconds</p><audio controls preload="none" src="data:audio/ogg;base64,${bytes}"></audio></article>`);
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reference asset collection</title><style>body{font:16px/1.55 system-ui;margin:0;background:#edf2f9;color:#14213c}main{max-width:1180px;margin:auto;padding:40px 24px}h1{font-size:40px;line-height:1.1}h2{font-size:19px;overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}article{padding:20px;background:white;border:1px solid #d5dfed;border-radius:16px}img{width:100%;height:260px;object-fit:contain;background:linear-gradient(135deg,#e8eef9,#fff)}small{color:#43516c}code{overflow-wrap:anywhere;font-size:11px}details{margin-top:16px}audio{width:100%}.intro{max-width:850px;margin-bottom:28px}</style><main><h1>Reference asset collection</h1><p class="intro">Five newly generated objects plus two earlier generated objects, registered for reuse. Each is a separate transparent layer; text is composed with Rabar 021 in the renderer. These assets primarily support styles 1 and 2, and do not certify a match to every reference. Quality check percentages describe passed technical checks, not visual similarity.</p><section class="grid">${cards.join('')}</section><h1>Eight reusable event sounds</h1><p class="intro">Curated from the 100-effect <a href="https://opengameart.org/content/interface-sounds">Kenney Interface Sounds pack</a>. Provider page and bundled license identify CC0. All eight were decoded and indexed. Auditory quality has not been assessed by the agent; use these controls to listen. The original archive and license remain in the project.</p><section class="grid">${audio.join('')}</section></main></html>`;
const output=path.join(folder,'asset-catalog.html');await fs.writeFile(output,html);console.log(output);
