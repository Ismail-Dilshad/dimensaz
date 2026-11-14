// Keep tool caches in the project's writable temporary directory.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const args = process.argv.slice(2);
if (!args.length) throw new Error('Provide a Node entry point');

const cache = path.resolve('workspace/cache/temp');
fs.mkdirSync(cache, {recursive: true});
const testRun = path.basename(args[0]) === 'vitest.mjs';
const cacheRoot = fs.realpathSync(cache);
const temp = testRun ? fs.mkdtempSync(path.join(cacheRoot, 'vitest-')) : cacheRoot;
const env = {...process.env, TEMP: temp, TMP: temp, TMPDIR: temp};
if (testRun) env.VIDEO_WORKSPACE = path.join(temp, 'workspace');

// Keys saved on the Settings page live in the system keychain; only their names are in
// .tempoloom/keys.json. A real environment variable always wins over them.
if (!testRun) {
 try {
  const index = JSON.parse(fs.readFileSync(path.resolve(process.env.TEMPOLOOM_SETTINGS_DIR || '.tempoloom', 'keys.json'), 'utf8'));
  const names = Object.entries(index).filter(([name, where]) => where === 'keychain' && !env[name]).map(([name]) => name);
  if (names.length) {
   const {Entry} = await import('@napi-rs/keyring');
   for (const name of names) { try { const value = new Entry('tempoloom', name).getPassword(); if (value) env[name] = value; } catch { /* not in the keychain */ } }
  }
 } catch { /* no saved keys, or no keychain on this computer */ }
}

// Commands read optional settings from .env; tests stay isolated from it.
// Real environment variables always win over values in .env.
const envFile = !testRun && fs.existsSync('.env') ? ['--env-file=.env'] : [];

try {
 const result = spawnSync(process.execPath, [...envFile, ...args], {stdio: 'inherit', windowsHide: true, env});
 if (result.error) throw result.error;
 process.exitCode = result.status ?? 1;
} finally {
 if (testRun) {
  const resolved = fs.realpathSync(temp);
  if (resolved !== temp || path.dirname(resolved) !== cacheRoot || !path.basename(resolved).startsWith('vitest-')) {
   throw new Error('Refusing to clean an unexpected test directory: ' + resolved);
  }
  fs.rmSync(resolved, {recursive: true, force: true, maxRetries: 3});
 }
}
