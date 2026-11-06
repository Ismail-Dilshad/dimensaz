import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fontCatalog,resolveFontPreset,recommendFonts} from '../engine/font-catalog.js';
import {defaults} from '../engine/config.js';
import {requestSchema} from '../engine/production.js';
it('retains Rabar 021 as primary with identical font bytes',async()=>{expect((await defaults()).font).toBe('assets/Rabar_021.ttf');expect(await resolveFontPreset('rabar-021')).toBe('assets/Rabar_021.ttf');const root=await fs.readFile('assets/Rabar_021.ttf'),named=await fs.readFile('assets/fonts/Rabar-021-Bold.ttf');expect(createHash('sha256').update(root).digest('hex')).toBe(createHash('sha256').update(named).digest('hex'));});
it('resolves named alternatives and checks actual glyph coverage',async()=>{const c=await fontCatalog();expect(c.fonts.filter(f=>f.origin==='existing-project-font'&&f.available)).toHaveLength(7);expect(await resolveFontPreset('rabar-007')).toBe('assets/fonts/Rabar-007-Regular.ttf');await expect(resolveFontPreset('not-a-font')).rejects.toThrow('Unknown');const result=await recommendFonts('Hello world','english');expect(result.fonts.some(f=>f.language==='en'&&f.missing.length===0)).toBe(true);expect(requestSchema.parse({schemaVersion:1,title:'Test',script:'Hello',fontPreset:'arial'}).fontPreset).toBe('arial');});
