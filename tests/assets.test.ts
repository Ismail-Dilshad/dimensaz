import {it,expect} from 'vitest';
import {assets,selectAsset} from '../engine/asset-selector.js';
it('loads licensed local assets and selects matching tags',async()=>{const a=await assets();expect(a.length).toBeGreaterThanOrEqual(8);expect(selectAsset(a,['shopping'])?.tags).toContain('shopping');});
