#!/usr/bin/env node
// Dimensaz command-line entry point. Maps friendly commands to the project scripts.
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = script => ['--import', 'tsx', script];
const commands = {
 init: {run: ts('src/cli/init.ts'), help: 'Set up language, brand profile and .env, then check tools'},
 doctor: {run: [...ts('src/cli/cli.ts'), 'doctor'], help: 'Check Node, FFmpeg, Chromium, fonts and audio tools'},
 create: {run: ts('src/cli/create-video.ts'), help: 'Create or resume a video job (--manifest FILE | --resume JOB)'},
 brief: {run: [...ts('src/cli/conversation-cli.ts'), 'brief'], help: 'Start a guided briefing from a script'},
 answer: {run: [...ts('src/cli/conversation-cli.ts'), 'answer'], help: 'Answer briefing questions'},
 edit: {run: ts('src/editor/cli.ts'), help: 'Edit footage from an edit decision list (trim, crop, zoom, captions...)'},
 fonts: {run: ts('src/cli/fonts-cli.ts'), help: 'List or recommend fonts for a script and style'},
 assets: {run: ts('src/cli/assets-cli.ts'), help: 'Search, assess and check the asset library'},
 storyboard: {run: ts('src/cli/storyboard-cli.ts') , help: 'Script in: one animated piece per sentence, a request ready for approval'},
 quality: {run: ts('src/cli/quality-cli.ts'), help: 'Score videos automatically: text size, contrast, overlaps, cut-off text, empty frames, effect loudness'},
 pieces: {run: ts('src/cli/pieces-cli.ts'), help: 'Animated scene pieces (UI mockups, dashboards, tasks, charts...) with examples'},
 brain: {run: ts('src/cli/brain-cli.ts'), help: 'What Dimensaz knows and learns: recall, study, add, verdict, report'},
 feedback: {run: ts('src/cli/feedback-cli.ts'), help: 'Record feedback on a video and load learned rules for the next one'},
 knowledge: {run: ts('src/cli/knowledge-cli.ts'), help: 'Search the knowledge base or propose updates'},
 tools: {run: ts('src/cli/tools-cli.ts'), help: 'List the tools the agent can use'},
 reach: {run: ts('src/cli/reach-cli.ts'), help: 'Read YouTube, Instagram, TikTok, X, Facebook, Pinterest, Dribbble, Reddit and the web (read-only)'},
 browse: {run: ts('src/cli/browse-cli.ts'), help: 'Open and read any page in the Dimensaz browser (screenshots, extract)'},
 source: {run: ts('src/cli/source-cli.ts'), help: 'Free 3D models, textures, images, icons, video, sounds and reference videos'},
 media: {run: ts('src/cli/media-cli.ts'), help: 'Silence, scenes, beats, face reframe and cut-outs (media setup first)'},
 status: {python: 'scripts/set_state.py', help: 'Report the agent state for the mascot viewer'},
};

const [name, ...args] = process.argv.slice(2);
if (!name || name === 'help' || name === '--help' || !commands[name]) {
 if (name && !commands[name] && name !== 'help' && name !== '--help') console.error(`Unknown command: ${name}\n`);
 console.log('Usage: dimensaz <command> [options]\n');
 for (const [key, value] of Object.entries(commands)) console.log(`  ${key.padEnd(10)} ${value.help}`);
 process.exit(name && !commands[name] && name !== 'help' && name !== '--help' ? 1 : 0);
}
const command = commands[name];
const result = command.python
 ? spawnSync(process.env.VIDEO_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [path.join(root, command.python), ...args], {stdio: 'inherit', cwd: root})
 : spawnSync(process.execPath, [path.join(root, 'scripts/run-checks.mjs'), ...command.run, ...args], {stdio: 'inherit', cwd: root});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
