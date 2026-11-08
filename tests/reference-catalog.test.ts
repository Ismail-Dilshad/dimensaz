import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from '../src/engine/config.js';
import {referenceCatalog,styleFolder,styleFrames,currentReferencePath} from '../src/engine/reference-catalog.js';
import {collectionCards,cardForReference} from '../src/engine/collection-cards.js';

const sha=async(file:string)=>createHash('sha256').update(await fs.readFile(path.join(ROOT,file))).digest('hex');

it('keeps every reference style as text with hash-pinned written anchors, and no third-party images or videos',async()=>{
 const c=referenceCatalog();
 expect(c.styles.length).toBeGreaterThanOrEqual(8);
 for(const s of c.styles){
  await fs.access(path.join(ROOT,s.folder,'style.md'));await fs.access(path.join(ROOT,s.folder,'style.json'));
  expect(s.frames.length,s.id).toBeGreaterThan(0);expect(s.frames.length,s.id).toBeLessThanOrEqual(6);
  for(const f of s.frames){expect(f.path).toBe(s.folder+'/style.md');expect(await sha(f.path),f.path).toBe(f.sha256);}
  await expect(fs.access(path.join(ROOT,s.folder,'frames'))).rejects.toThrow();
  if(s.motionSheet)await fs.access(path.join(ROOT,s.motionSheet));
 }
 for(const m of c.motion){await fs.access(path.join(ROOT,m.folder,'motion.md'));await fs.access(path.join(ROOT,m.folder,'sheet.jpg'));}
 const walk=async(dir:string):Promise<string[]>=>(await fs.readdir(dir,{withFileTypes:true})).flatMap(e=>e.isDirectory()?[]:[path.join(dir,e.name)]).concat(...await Promise.all((await fs.readdir(dir,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>walk(path.join(dir,e.name)))));
 expect((await walk(path.join(ROOT,'references'))).filter(f=>/\.(mp4|mov|webm|mkv)$/i.test(f))).toEqual([]);
});

it('resolves every card, numbered preset and old path to a kept frame',async()=>{
 for(const card of Object.keys(collectionCards)){expect(styleFrames(card).length,card).toBeGreaterThan(0);await fs.access(path.join(ROOT,styleFolder(card)));}
 for(const id of ['style-1','style-2','style-3','style-4','style-5','style-6','style-7'] as const)await fs.access(path.join(ROOT,styleFolder(cardForReference(id))));
 for(const [old,now] of Object.entries(referenceCatalog().legacy)){expect(currentReferencePath(old)).toBe(now);await fs.access(path.join(ROOT,now));}
 expect(currentReferencePath('output/style-library/styles/red-signal/posters/style-3--compass-pointing-re--x.jpg')).toContain('references/style-library/');
});
