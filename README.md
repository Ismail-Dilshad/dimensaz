<picture>` tag:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo/svg/reelwright-horizontal-for-dark.svg">
  <img alt="Reelwright" src="assets/brand/logo/svg/reelwright-horizontal-for-light.svg" width="480">
</picture>

# Unified AI production

Start with the [Reelwright skill](SKILL.md). It uses `video:create` for new jobs and explains how to inspect, revise, and resume them.
For one of the seven supplied reference styles, start with
`pnpm video:create --manifest examples/reference-request.json`; an incomplete
request returns an asset board for the agent to complete. See
[reference workflow](references/reference-motion.md) for assets, pilot review and rendering.
See [production system](references/production-system.md) for manifests, resume, presets and limits.

# Sorani-first multilingual text animation

A local TypeScript/Chromium/FFmpeg toolkit for exact-source kinetic typography and
persistent MP4 projects. Kurdish Sorani remains the default. English, Arabic,
Persian, and Kurdish Badini/Kurmanji text can use the same renderer.

## Language support

| `language` | Text | Default direction handling | Automatic local speech model |
| --- | --- | --- | --- |
| `ckb` (default) | Kurdish Sorani | First strong character per scene | Optional Sorani backend; requires installed dependencies/weights and review |
| `en` | English | First strong character per scene | Not configured |
| `ar` | Arabic, including tested diacritics | First strong character per scene | Not configured |
| `fa` | Persian, including ZWNJ and Persian digits | First strong character per scene | Not configured |
| `badini` | Badini in Arabic or Latin script | Determined from the actual script | Not configured |
| `kmr` | Kurmanji / Latin Kurdish, including Ã‡ ÃŠ ÃŽ Åž Ã› | Determined from the actual script | Not configured |

Language is explicit metadata, not automatic translation or dialect detection.
Shared Arabic-script letters cannot reliably identify Sorani, Persian, or Badini.
All languages support silent video, supplied voice/audio, and reviewed provider or
manual word timing. Text support does **not** establish ASR or alignment accuracy.
Non-Sorani automatic analysis returns pause evidence and unresolved word times;
it never substitutes a Sorani model. See [language support](references/language-support.md).

Rabar 021 remains unchanged and primary. It lacks Latin Kurdish Åž/ÅŸ. New projects
resolve an explicit installed Latin fallback (Arial on Windows, DejaVu Sans on
Linux, Arial on macOS), or `VIDEO_LATIN_FONT`. Paths are stored in project.json;
OS fonts are not bundled. Check glyph coverage on every machine. An explicit
`fallbacks` config overrides discovery, including `[]` to disable it. Existing
projects retain their original fonts and classic/kinetic settings.

## Setup

Open the full project folder in Claude Code or Cursor and invoke
`/reelwright`. Both clients discover the same project entry in
`.claude/skills/`, which points to the root [SKILL.md](SKILL.md).
Keep `references/style-library/` and `references/style-library-review/` with
the project. The root skill can also be read directly by any coding agent.

Use Node.js 22+ and pnpm 11. From this directory:

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm video:doctor
pnpm typecheck
pnpm test
```

The renderer uses strict TypeScript, Zod, Playwright, esbuild, and local
FFmpeg/FFprobe. No UI framework, external AI API, login, or GPU is required.
The audio-analysis pipeline is optional and uses the project `.venv`.

`.env` files are **not loaded automatically**. Supported shell overrides are
`VIDEO_WORKSPACE`, `VIDEO_OUTPUT`, `FFMPEG_PATH`, `FFPROBE_PATH`, `CHROMIUM_PATH`,
`VIDEO_PYTHON`, and `VIDEO_LATIN_FONT`; see `.env.example`. Design defaults live
in config/*.json. Keep workspace/output roots consistent when reopening work.

## Conversational workflow

Give Codex the exact script, its language/dialect, and optional media. Codex asks
missing design preferences once; Auto/use defaults skips those questions.
It operates `video:brief`, `video:answer`, `video:prepare`, and `video:finish`.
Brief JSON accepts `language: ckb|en|ar|fa|kmr|badini` (default `ckb`).

Defaults: typography directly on a subtle white grid, primary blue #1F5EFF,
1080x1920, 60 FPS for new final exports (existing manifests retain their FPS), H.264/yuv420p CRF18, no automatic cards, icons, or progress bar.
Words remain complete shaped units; mixed-direction runs retain reading order.
Text, punctuation, line endings, and whitespace are never translated or rewritten.

Voice briefs default to exact synchronization. Valid reviewed word timestamps
must match every script token and the recording SHA-256. Missing analysis tools
leave a design preview available, with the concrete blocker reported. Unaligned
voice drafts use phrase holds; exact final rendering remains blocked. Estimated
mode is an explicit choice, never evidence of speech synchronization.

A failed reference preparation retains its production job ID and resumes that job.
Legacy brief preparation retains its previous separate-attempt behavior;
it never treats an incomplete imported project as prepared. Successful repeated
prepare calls reuse the prepared project. Per-project/session operations must
still be sequential; concurrent edits to the same project are not supported.

## CLI workflow

Save exact text as UTF-8 to avoid terminal encoding errors:

```powershell
pnpm video:new --title "Sorani video" --file script.txt --language ckb
pnpm video:new --title "English video" --file english.txt --language en
pnpm video:new --title "Badini video" --file badini.txt --language badini
pnpm video:plan --project PROJECT_ID
pnpm video:preview --project PROJECT_ID
```

Inspect **all** returned contact sheets and representative frames. Then:

```powershell
pnpm video:render --project PROJECT_ID --approve-preview
pnpm video:validate --file "mp2/EXPORTED_NAME.mp4"
```

Preview approval is bound to the plan, imported media bytes, fonts, selected
assets, and rendering source. A missing/stale preview is regenerated and rendering
stops for inspection, even if the approval flag was supplied. Changes during
preview/render block export. Inspect the returned encodedFrame after rendering.
Validation includes FFprobe geometry/FPS/duration/audio checks and a full decode.

Each creation is separate. `project.json` is authoritative; `scenes.json` is a
plan-time snapshot. Replanning replaces manual scene edits. `video:revise`
creates a separate revision and copies imported originals.

```powershell
pnpm video:import --project PROJECT_ID --file "footage.mp4" --kind video
pnpm video:import --project PROJECT_ID --file "voice.wav" --kind voice
pnpm video:import --project PROJECT_ID --file "music.mp3" --kind music
pnpm video:import --project PROJECT_ID --file "logo.png" --kind image
pnpm video:revise --project PROJECT_ID
pnpm video:list
pnpm video:show --project PROJECT_ID
pnpm video:export --project PROJECT_ID
```

Kinds: video, image, voice, music, sfx; timed audio accepts `--at` seconds.
The first video and first image are composed. Fit modes are cover, contain, and
background-fill. Music loops; audio is mixed into AAC. The conversational voice
workflow disables normalization/fades and never time-stretches narration; AAC
encoding and the mixer limiter can still affect the output. Originals are retained.
Unsupported Chromium video codecs require a separate conversion. This is not a
multitrack nonlinear editor. Auto-direction and keyword emphasis are heuristics
and need editorial review; no semantic understanding is claimed for any language.

Exports are unique in mp2/. History receipts and sequence reservations live in
workspace/history/. `video:export` requires a current validated render. No automatic
cleanup runs; explicit `video:cleanup` only removes failed render directories.

## Architecture

| Directory | Responsibility |
| --- | --- |
| engine/ | Language/schema validation, exact-text parsing, scenes, projects, voice alignment |
| components/, animations/ | Whole-word typography, bidi runs, deterministic motion |
| renderer/ | Local-only browser resources, previews, frame streaming, mixing, export validation |
| audio_pipeline/ | Optional local acoustic analysis; unreviewed scores and null unresolved times |
| motion-library/ | Reviewed reference retrieval; no source-footage copying |
| config/, presets/, templates/ | Defaults and reusable settings |
| tests/ | Unit, failure-recovery, browser, language, and optional Python bridge checks |
| workspace/projects/ | Source scripts, imports, previews, renders, and separate revisions |
| mp2/ | Final validated MP4 exports |

## Verification

```powershell
pnpm typecheck
pnpm test
$env:RUN_BROWSER_TESTS = '1'
$env:RUN_AUDIO_TESTS = '1'
pnpm test
pnpm test:audio
```

The audio bridge check requires the actual project .venv and its native packages.
Unit fixtures are not claimed as speech-alignment evidence.

Real render checks use two stages so newly generated previews cannot be
implicitly approved:

```powershell
pnpm test:production
# Inspect every returned sheet, then use its existing project ID:
pnpm test:production --project PROJECT_ID --approve-preview

pnpm test:e2e
# Inspect both text and synthetic-footage preview sets, then run each ID:
pnpm test:e2e --project PROJECT_ID --approve-preview
```

The multilingual check renders 1080x1920 at 30 FPS. The smaller integration check
uses explicitly synthetic test footage/audio to validate seeking, audio mixing,
and unique repeated exports. Neither establishes speech-model accuracy.
See [current evidence and limitations](references/implementation-status.md).

## Internet asset sourcing
The existing asset selector now includes the reusable catalog under assets/library/. See [sourcing workflow and limits](references/internet-asset-sourcing.md). Agent commands: assets:library list/discover/download/import/reference. Optional assetNeeds in video:create requests connect sourcing to scene planning.


Local speech setup and hardware-aware recovery: [Sorani alignment](references/local-audio-pipeline.md).
`audio:setup`, `audio:benchmark`, `audio:precision-probe`, and `audio:evaluate` supplement
the existing audio commands. Missing dependencies/models are reported without guessing
word timings. Current network/install and real-audio evidence is recorded in
[alignment verification](references/sorani-alignment-verification.md).

Render profiles and measured performance: [references/render-performance.md](references/render-performance.md).
Use `video:profile` for a separate draft/preview/final revision, `video:performance`
for local benchmarks, and `video:interpolate` only for opt-in footage conversion.

## Organized exports and disposable test videos

Production exports use `mp2/<fps>fps/<orientation>/<category>/<title>_<fps>fps_v<version>.mp4`.
For example: `mp2/60fps/vertical/promotions/kak-ismael-tiktok-sponsorship_60fps_v3.mp4`.
Orientations are `vertical`, `landscape`, and `square`. Set `exportCategory` in project configuration or a production request, for example `promotions`, `education`, or `social`; the default is `general`.
Titles become readable filename slugs. Repeated exports get `_export02`, `_export03`, etc.; existing files are never overwritten. Asset sidecars remain alongside each video.

Set `"purpose": "test"` in a production request or `"renderPurpose": "test"` in project configuration for disposable videos. Automated tests and smoke scripts mark newly created projects automatically. Test exports go to `workspace/cache/test-exports/<project>/`, never the production `mp2` folders. Their generated videos, render caches, and asset sidecars are removed at normal process completion, after checks finish. Benchmark scripts also remove their generated video clips. Measurements, review images, source media, scripts, and project manifests are retained.

After a forced termination, run `pnpm video:clean-tests` to remove remaining videos belonging to explicitly marked test projects. A hard process kill cannot run automatic cleanup. Production videos and their render caches are preserved. Historical test reports may reference clips that were intentionally removed; cleanup receipts are saved in `workspace/history`.

The existing Kak Ismael exports were relocated on 2026-10-26 without re-encoding, with SHA-256 verification. The move and cleanup record is `workspace/history/export-organization-2026-10-26.json`.

## Unified style direction
For new conversational video requests with missing style decisions, `video:brief` now starts the unified Style Director: one question at a time across visuals, typography and sound. Use Quick, Standard, Advanced or Auto; keep Auto distinct from saved Default. Resolve only missing preferences, show the unified summary, obtain confirmation, prepare/inspect the preview, then finish. Full behavior, supported controls, preset commands, measurements and explicit limitations are in [references/style-director.md](references/style-director.md).

## Reference motion videos
Seven references/styles/custom-motion-shorts presets and a project-local custom-motion-shorts renderer workflow are available. See [reference motion rendering](references/reference-motion.md). Use `pnpm video:reference list` and the existing `video:create` lifecycle.

This repository includes the render toolkit and its working style library. Local production exports, generated workspaces and standalone study recordings are kept outside Git. Supply those clips locally if a reference guide calls for them.
