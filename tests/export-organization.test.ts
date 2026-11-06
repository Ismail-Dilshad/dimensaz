import {it,expect} from 'vitest';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {registerTestDirectory,cleanupTestArtifacts} from '../engine/test-artifacts.js';
import {create,exportFile} from '../engine/project.js';
it('organizes production exports and never overwrites a previous file',async()=>{
 const p=await create('Readable Export Name','text');p.config.renderPurpose='production';p.config.exportCategory='promotions';p.config.fps=60;
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'export-layout-'));p.config.output=path.join(temp,'mp2');const source=path.join(temp,'input.mp4');await fs.writeFile(source,'fixture');
 const a=await exportFile(p,source),b=await exportFile(p,source);
 expect(a).toBe(path.join(temp,'mp2','60fps','vertical','promotions','readable-export-name_60fps_v1.mp4'));expect(a).not.toBe(b);expect(await fs.readFile(a,'utf8')).toBe('fixture');
 // Only these test-created files are removed, not recursively computed directories.
 await fs.unlink(a);await fs.unlink(b);await fs.unlink(source);
});
it('cleans only registered test media while retaining previews and measurements',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'test-cleanup-'));const test=path.join(root,'test');await fs.mkdir(test);
 await fs.writeFile(path.join(root,'production.mp4'),'keep');await fs.writeFile(path.join(test,'clip.mp4'),'remove');await fs.writeFile(path.join(test,'clip.mp4.performance.json'),'keep');await fs.writeFile(path.join(test,'preview.png'),'keep');
 expect(()=>registerTestDirectory(path.join(root,'outside'),test,root)).toThrow();registerTestDirectory(test,root,root);const removed=await cleanupTestArtifacts();expect(removed).toEqual([path.join(test,'clip.mp4')]);expect(await fs.readFile(path.join(root,'production.mp4'),'utf8')).toBe('keep');expect(await fs.readFile(path.join(test,'preview.png'),'utf8')).toBe('keep');expect(await fs.readFile(path.join(test,'clip.mp4.performance.json'),'utf8')).toBe('keep');
});
