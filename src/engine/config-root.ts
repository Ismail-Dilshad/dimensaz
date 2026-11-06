import path from 'node:path';
import {fileURLToPath} from 'node:url';
/** Repository root (this file lives in src/engine). Kept in its own module so config and font modules can share it without an import cycle. */
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
