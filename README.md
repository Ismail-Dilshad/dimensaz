<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo/svg/reelwright-horizontal-for-dark.svg">
    <img src="assets/brand/logo/svg/reelwright-horizontal-for-light.svg" alt="Reelwright" width="480">
  </picture>
</p>

<h1 align="center">Reelwright</h1>

<p align="center">A Sorani-first toolkit for creating motion graphics and editing short videos with a coding agent.</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="SKILL.md">Agent skill</a> ·
  <a href="#production-workflow">Workflow</a> ·
  <a href="#documentation">Docs</a>
</p>

## What Reelwright does

- Turns scripts, footage, and optional narration into captioned motion graphics and short edits.
- Preserves supplied text, including right-to-left shaping and mixed-direction lines. Sorani is the default, with support for English, Arabic, Persian, Badini, and Kurmanji.
- Uses local Chromium and FFmpeg to render from a saved project manifest. You can inspect previews, resume a job, and keep revisions separate.
- Shows the current production phase in a local mascot viewer.

## Quick start

Install Node.js 22+ and pnpm 11, then run:

```sh
git clone https://github.com/Eso70/reelwright.git
cd reelwright
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm video:doctor
```

Open the project folder in Claude Code or Cursor and invoke `/reelwright`. In Codex or another coding agent, point it to [SKILL.md](SKILL.md). Give the agent your exact script, language, optional media, and any visual requirements.

## Production workflow

1. Start a job with your request manifest. [The example request](examples/reference-request.json) starts a reference-style job and may return an asset board for you or your agent to complete.
2. Resume the same job after supplying the requested assets, alignment, or pilot review. Inspect the preview sheets before approving the render.
3. Approve the reviewed preview and check the encoded result. Finished production exports go to `mp2/`. Project files and job history live in `workspace/`.

```sh
pnpm video:create --manifest examples/reference-request.json
pnpm video:create --resume JOB_ID
pnpm video:create --resume JOB_ID --approve-preview
```

For narrated work, exact word sync requires reviewed timings tied to the recording. The optional local alignment pipeline supports Sorani. Other languages can use reviewed manual or provider timings. See the [voice guide](references/voice-synchronization.md).

## Live status viewer

From the repository root, start a local server with Python 3:

```sh
python -m http.server --bind 127.0.0.1
```

Open [the status viewer](http://127.0.0.1:8000/assets/brand/web/state-viewer.html) while a `video:create` job runs. The mascot updates during planning, review, rendering, and completion.

## Documentation

- [Agent skill](SKILL.md) for briefing, design, and delivery.
- [Production system](references/production-system.md) for manifests, commands, and recovery.
- [Language support](references/language-support.md) for fonts and text direction.
- [Local audio setup](references/local-audio-pipeline.md) for optional speech analysis.
- [Changelog](CHANGELOG.md) for project changes.

## Development

```sh
pnpm typecheck
pnpm test
```

The repository includes the renderer and its working style library. Production exports, generated workspaces, and standalone study recordings stay local. If a reference guide calls for a study clip, supply it locally.
