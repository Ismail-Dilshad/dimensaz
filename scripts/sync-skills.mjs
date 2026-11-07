// Copies the single source skill (skills/dimensaz/SKILL.md) to the locations agents
// discover, rewriting relative links for each location. `--check` fails if a copy is stale.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = 'skills/dimensaz/SKILL.md';
const targets = ['.claude/skills/dimensaz/SKILL.md'];
const notice = '<!-- Generated from skills/dimensaz/SKILL.md by `pnpm skills:sync`. Edit the source, not this copy. -->';

export function render(target) {
 const text = fs.readFileSync(path.join(root, source), 'utf8').replace(/\r\n/g, '\n');
 const from = path.dirname(path.join(root, source)), to = path.dirname(path.join(root, target));
 const relinked = text.replace(/\]\(([^)\s]+)\)/g, (match, link) => {
  if (/^([a-z]+:|#|\/)/i.test(link)) return match;
  const [file, hash = ''] = link.split(/(?=#)/);
  const rel = path.relative(to, path.resolve(from, file)).split(path.sep).join('/');
  return '](' + rel + hash + ')';
 });
 const end = relinked.indexOf('\n---\n', 4) + 5;
 return relinked.slice(0, end) + '\n' + notice + '\n' + relinked.slice(end);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const check = process.argv.includes('--check');
 let stale = 0;
 for (const target of targets) {
  const file = path.join(root, target), want = render(target);
  const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
  if (have === want) continue;
  if (check) { console.error('Out of date: ' + target + ' (run pnpm skills:sync)'); stale++; continue; }
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, want);
  console.log('Updated ' + target);
 }
 if (stale) process.exit(1);
 if (check) console.log('Skill copies are in sync.');
}
