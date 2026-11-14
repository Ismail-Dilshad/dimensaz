#!/usr/bin/env node
// Tempoloom command-line entry point. Maps friendly commands to the project scripts.
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = script => ['--import', 'tsx', script];
const commands = {
 init: {run: ts('src/cli/init.ts'), help: 'Set up language, brand profile and .env, then check tools', usage: `Usage: tempoloom init [--language en|ckb|ar|fa|kmr|badini] [--name NAME] [--logo FILE]
                     [--primary #RRGGBB] [--accent #RRGGBB] [--background #RRGGBB] [--text #RRGGBB]
                     [--auto-motion on|off] [--yes] [--skip-doctor]

Sets up the default language, the brand profile (config/brand.json) and .env, then runs doctor.
Asks for what is missing when run in a terminal; --yes takes the given values and defaults.`},
 doctor: {run: [...ts('src/cli/cli.ts'), 'doctor'], help: 'Check Node, FFmpeg, Chromium, fonts and audio tools', usage: `Usage: tempoloom doctor [--json]

Checks Node, FFmpeg, FFprobe, Chromium, the fonts, languages, brand, knowledge, the skill copies
and the workspace, and the optional parts (.env, ElevenLabs, local speech and media tools).`},
 create: {run: ts('src/cli/create-video.ts'), help: 'Create or resume a video job (--manifest FILE | --resume JOB)', usage: `Usage: tempoloom create --manifest REQUEST.json [--storyboard FILE] [--alignment FILE] [--legacy-style]
       tempoloom create --resume JOB [--approve-preview] [--alignment FILE] [--revision FILE] [--review FILE]

Creates a video job from a request (it stops at the preview for review), or resumes one:
--approve-preview renders the final after the preview was looked at.`},
 brief: {run: [...ts('src/cli/conversation-cli.ts'), 'brief'], help: 'Start a guided briefing from a script', usage: `Usage: tempoloom brief --file BRIEF.json

Starts a guided briefing from a brief (script, goal, format); prints the first questions and a
session id. Answer with: tempoloom answer --session ID --text "..." `},
 answer: {run: [...ts('src/cli/conversation-cli.ts'), 'answer'], help: 'Answer briefing questions', usage: `Usage: tempoloom answer --session ID --text "THE ANSWER"

Answers the next briefing question of a session started with tempoloom brief.`},
 edit: {run: ts('src/editor/cli.ts'), help: 'Edit footage: edit auto FILE (talking head, fully automatic) or --edl EDIT.json (trim, crop, zoom, captions...)'},
 fonts: {run: ts('src/cli/fonts-cli.ts'), help: 'List or recommend fonts for a script and style', usage: `Usage: tempoloom fonts list
       tempoloom fonts recommend (--file SCRIPT.txt | --text "TEXT") [--role headline|body|accent]

Lists the open fonts with the scripts they cover, or recommends fonts for a script by its
language and style (Kurdish only from fonts that cover every Kurdish letter).`},
 assets: {run: ts('src/cli/assets-cli.ts'), help: 'Search, assess and check the asset library', usage: `Usage: tempoloom assets <action> [options]

  list | search --query Q | check --id ID | assess --file FILE | style --id ID | recipes
  discover --query Q | reference --url URL | download --url URL --hosts a,b | import --manifest FILE

Searches and checks the asset library (relevance, rights, available masters) before sourcing
anything new.`},
 studio: {run: ts('src/cli/studio-cli.ts'), help: 'The studio that runs every job: plan first, each role with its playbook and lessons. studio open: a page to brief a video (motion or edit) and rate every step'},
 write: {run: ts('src/cli/write-cli.ts'), help: 'Script research and check: facts from a topic or link, a brief for the length you want, then --check the written script before make'},
 make: {run: ts('src/cli/make-cli.ts'), help: 'Script in, finished video out: storyboard, voice-over (--voice), preview, then --approve JOB for the final, other shapes and thumbnail'},
 look: {run: ts('src/cli/look-cli.ts'), help: 'Learn a look from a video you like; make videos in its spirit with --like (never a copy)'},
 music: {run: ts('src/cli/music-cli.ts'), help: 'Your music library and original music composed for a mood'},
 storyboard: {run: ts('src/cli/storyboard-cli.ts'), help: 'Script in: a visual designed from zero for every sentence, a request ready for approval'},
 quality: {run: ts('src/cli/quality-cli.ts'), help: 'Score videos automatically: text size, contrast, overlaps, cut-off text, empty frames, effect loudness'},
 pieces: {run: ts('src/cli/pieces-cli.ts'), help: 'Scene visuals: what the designer makes of a sentence, layers, sounds, check a request'},
 brain: {run: ts('src/cli/brain-cli.ts'), help: 'What Tempoloom knows and learns: recall, study, add, verdict, report'},
 taste: {run: ts('src/cli/taste-cli.ts'), help: 'Your taste profile: what you like by topic and the targets every preview is checked against; edit it, or keep one per client'},
 teach: {run: ts('src/cli/teach-cli.ts'), help: 'Teach the brain with videos: a page to upload, trim, crop and prompt; the agent studies, the video is deleted, lessons stay'},
 feedback: {run: ts('src/cli/feedback-cli.ts'), help: 'Record feedback on a video and load learned rules for the next one'},
 knowledge: {run: ts('src/cli/knowledge-cli.ts'), help: 'Search the knowledge base or propose updates'},
 tools: {run: ts('src/cli/tools-cli.ts'), help: 'List the tools the agent can use', usage: `Usage: tempoloom tools [--category NAME] [--status ready|planned] [--json]

Lists every tool the agent can use, with its command and when to use it.`},
 reach: {run: ts('src/cli/reach-cli.ts'), help: 'Read YouTube, Instagram, TikTok, X, Facebook, Pinterest, Dribbble, Reddit and the web (read-only)'},
 browse: {run: ts('src/cli/browse-cli.ts'), help: 'Open and read any page in the Tempoloom browser (screenshots, extract)'},
 source: {run: ts('src/cli/source-cli.ts'), help: 'Free 3D models, textures, images, icons, video, sounds and reference videos'},
 publish: {run: ts('src/cli/publish-cli.ts'), help: 'Covers and titles to choose from, and a post package for TikTok, Reels, Shorts and YouTube (nothing is posted)'},
 media: {run: ts('src/cli/media-cli.ts'), help: 'Silence, scenes, beats, face reframe and cut-outs (media setup first)'},
 trends: {run: ts('src/cli/trends-cli.ts'), help: 'Trend watch: formats getting popular for your topics, with links, to accept or ignore'},
 history: {run: ts('src/cli/history-cli.ts'), help: 'Every change to lessons, rules, taste and ratings, newest first, each with Undo'},
 backup: {run: ts('src/cli/backup-cli.ts'), help: 'Everything the studio learned in one file: create, list, check and restore (to keep it safe or move it to another computer)'},
 mcp: {run: ts('src/cli/mcp-cli.ts'), help: 'Serve the studio tools to Claude Code, Codex, Gemini CLI or any MCP client (stdio)'},
 status: {python: 'scripts/set_state.py', help: 'Report the agent state for the mascot viewer', usage: `Usage: tempoloom status [STATE] ["DETAIL"]

Sets the agent's state for the mascot viewer. STATE: idle, listening, thinking, planning,
creating, rendering, done, excited, confused, error, needs-approval, sleeping.`},
};

const [name, ...args] = process.argv.slice(2);
if (!name || name === 'help' || name === '--help' || !commands[name]) {
 if (name && !commands[name] && name !== 'help' && name !== '--help') console.error(`Unknown command: ${name}\n`);
 console.log('Usage: tempoloom <command> [options]\n');
 for (const [key, value] of Object.entries(commands)) console.log(`  ${key.padEnd(10)} ${value.help}`);
 process.exit(name && !commands[name] && name !== 'help' && name !== '--help' ? 1 : 0);
}
const command = commands[name];
// Help works the same for every command: --help, -h or help prints its usage and nothing runs.
if (['--help', '-h', 'help'].includes(args[0] ?? '') && args.length === 1) {
 if (command.usage) { console.log(command.usage); process.exit(0); }
 args[0] = 'help';
}
const result = command.python
 ? spawnSync(process.env.VIDEO_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [path.join(root, command.python), ...args], {stdio: 'inherit', cwd: root})
 : spawnSync(process.execPath, [path.join(root, 'scripts/run-checks.mjs'), ...command.run, ...args], {stdio: 'inherit', cwd: root});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
