import path from 'node:path';
import {ROOT} from '../engine/config.js';
import {indexSfx} from '../engine/sfx.js';
console.log(JSON.stringify(await indexSfx(path.join(ROOT,'assets/sfx')),null,2));
