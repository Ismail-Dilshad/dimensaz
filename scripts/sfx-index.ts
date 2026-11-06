import path from 'node:path';
import {ROOT} from '../src/engine/config.js';
import {indexSfx} from '../src/engine/sfx.js';
console.log(JSON.stringify(await indexSfx(path.join(ROOT,'assets/sfx')),null,2));
