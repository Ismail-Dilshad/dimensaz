# Changelog

## 4.0.0: Renamed to Dimensaz

The project is now **Dimensaz** (دیمەنساز, Kurdish for "scene maker"), formerly
Reelwright. Everything was renamed: the package and command (`pnpm dimensaz`,
`bin/dimensaz.mjs`), the skill (`skills/dimensaz`, `/dimensaz`), the status helper
(`agent/status/dimensaz-states.ts`, `scripts/dimensaz_states.py`), the local status
folder (`.dimensaz/`) and the brand kit (`assets/brand/logo/*/dimensaz-*`, with the
wordmark redrawn as "dimen" + "saz" in Fredoka Bold). See `docs/MIGRATION.md`.

## 3.7.0: Transcription, captions, tightening, brand layer and style briefs

- `media transcribe`: word-timed transcripts with ElevenLabs Scribe (the chosen
  provider), cached by audio hash; Kurdish sent as `kur`.
- `media captions`: readable SRT cues; with `--script` the text is exactly the user's
  script, timed from the recognised words (lenient Kurdish matching).
- `media tighten`: an edit list that removes pauses, filler words and dead air, keeps
  breaths, retimes captions and can add the brand layer.
- Editor `brand` operation: logo watermark and an animated end card from
  `config/brand.json`.
- `media style`: reference style brief with palette roles, cut rhythm, motion energy
  and easing, plus saved frames and *by eye* sections.
- Policies: ElevenLabs-only transcription and voice-over (voice-over only on request),
  image generation only with a tool the host agent has. Doctor reports the key.

## 3.6.0: Motion and design are mandatory

- New standing rules in `agent/policies.md` (Motion and design): no static or
  text-on-blank scene, every scene shows its sentence with designed visuals, one
  consistent branded style, a visual event every 1-2 s in 2-5 s scenes (about 70-80
  words and 6-8 scenes per 30 s), eased staggered animation with designed transitions,
  a rendered MP4, and a per-scene summary on delivery.
- The skill, persona, script-to-motion mode, editing guide, rubric, memory and a new
  eval task (E11) apply the rules. Missing screenshots or logos are drawn as stand-ins,
  never replaced by text only.
- `pnpm dimensaz media pacing FILE`: fails a video with stretches that do not move
  for more than 1.5 s or plain text-on-background frames; required before delivery.

## 3.5.0: Voice separation, stabilization, quality checks, Lottie and overlays

- **Demucs** (`media separate`): split voice from music and noise, or into four stems.
  Uses the CUDA torch already in `.venv`; models download only with `--allow-download`.
- **OpenCV** (`media quality`, `media motion`, `media stabilize`): sharpness, exposure
  and noise checks; camera pan, zoom and shake; stabilization that keeps the audio.
- **lottie-web** (`media lottie`, `media lottie-info`): render Lottie animations
  frame-exactly in Chromium to transparent ProRes `.mov`, VP9 `.webm`, PNG frames or
  `.mp4`. Example: `examples/lottie/slide-box.json`.
- **Editor `overlay` operation**: place images and videos (logos, lower thirds, Lottie
  clips) over footage with position, width, timing, opacity and looping; transparency
  is kept.
- Tool registry: stabilization, overlays and noise reduction are ready; new
  `analyze-quality`, `analyze-motion` and `asset-lottie`.
- Cut-outs use the CPU ONNX Runtime shared with faster-whisper, because the GPU build
  conflicts with it.

## 3.4.0: Media tools

- **New `media_tools/`** (Python, optional, `pnpm media:setup`):
  silence detection with auto-editor, shot and rhythm detection with PySceneDetect,
  tempo and beats with librosa, face-aware reframing with MediaPipe, and background
  removal with rembg (BiRefNet). One command: `pnpm dimensaz media ...`.
- Silence and reframe results write ready `cut` and `reframe` operations for the
  footage editor (`--edl-out`). Models download only with `--allow-download`.
- Tool registry: silence removal and auto-reframe are now ready; new `media-setup`,
  `media-doctor`, `analyze-scenes`, `analyze-beats` and `asset-cutout`.
- `pnpm dimensaz doctor` reports the media tools; `pnpm test:media` runs their tests.
- Model pointers for the audio pipeline are stored relative to the cache, so models
  survive moving the project folder.

## 3.3.0: One skill, one source tree

- **One skill:** `skills/dimensaz/` is the only skill. The old code-motion-shorts,
  custom-motion-shorts, video-production and legacy skills were removed; their
  working rules live on as guides (`docs/guides/layered-assets.md`,
  `docs/guides/style-cards.md`). Codex metadata moved to `skills/dimensaz/agents/`.
- **Source:** command entry points moved from `scripts/` to `src/cli/`; the footage
  editor moved from `packages/editor/` to `src/editor/`. `scripts/` now holds only
  developer tools (checks, benchmarks, smoke tests, skill sync, status helper).
- **Config:** the brand profile is `config/brand.json`; agent strings are in
  `agent/locales/`.
- **Assets:** flat vectors and their manifest are in `assets/library/vectors/`,
  backgrounds in `assets/library/backgrounds/`; finished example scenes moved to
  `examples/scenes/`. The duplicate `assets/Rabar_021.ttf` was removed; saved
  projects that use it load the identical `assets/fonts/Rabar-021-Bold.ttf`.
- **References:** the seven styles are in `references/styles/style-1..7`; the style
  review sits inside the library at `references/style-library/review/`. The extracted
  old skill source, the one-time handoff archive and its organizer script were removed.

## 3.2.0: Leaner, scalable layout

- **Layout:** all TypeScript source in `src/`; living guides in `docs/guides/`,
  historical records in `docs/records/`; `references/` holds only reference media
  and style catalogs; memory in `agent/knowledge/memory.md`. See `docs/MIGRATION.md`.
- **Styles:** removed 11 old presets (premium-viral, word-reveal, active-word,
  text-bounce, spring, object-motion, saas, statistics, camera, clay,
  premium-transition) and the retired Citron Clay and Violet Cutout cards. `kinetic`
  (text only) is now a normal preset for new videos.
- **Assets:** kept only consistent 3D objects. Removed 2D illustrations, flat shapes,
  near-duplicates, test recolors, the origami set and per-scene copies
  (1,035 files, 283 MB to 790 files, 151 MB).
- **References:** added 20 reference videos that were only on the maintainer's
  machine. A full third-party YouTube download stays local and links to its source.
- **Scripts:** removed 29 one-off scripts for past videos, demos and migrations.
- **.env:** commands now load `.env`; `.env.example` documents every setting.

## 3.1.0: Agent foundation (English default, Kurdish first-class)

- **Agent:** new `agent/` with manifest, persona (senior motion designer and editor),
  policies, three mode playbooks (script to motion, reference match, footage edit),
  briefing questions (at most five, only what is missing), a 69-tool registry
  (8 planned), a knowledge index with source and license per entry, ten golden
  evals and a rubric. Knowledge updates are proposals that wait for approval.
- **Languages:** English is the default. Language is detected from the script
  (Kurdish letters select Sorani, Persian letters Persian, other Arabic script
  Arabic, otherwise English). `config/locales.json` maps each language to its
  direction and fonts; `locales/` holds agent strings (non-English drafts need
  native review).
- **Fonts:** Kurdish uses only the existing Kurdish fonts; other languages use six
  bundled OFL fonts chosen by style. The Latin fallback is bundled, so renders no
  longer depend on Windows or Linux system fonts. No hardcoded font in instructions.
- **Editor:** `packages/editor` edits footage from an edit decision list: trim,
  split, cut, concat, crop, reframe, zoom, speed, fades, gain, two-pass loudness,
  resize and right-to-left caption burn-in. Never modifies inputs or overwrites outputs.
- **Automatic motion:** on by default from `config/brand.json`; a request can set
  `autoMotion: false`.
- **Setup:** `dimensaz` command, `dimensaz init`, a fuller `doctor`, and the
  `hello-en` / `hello-ckb` examples.
- **Open source:** README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, templates, CI,
  THIRD_PARTY_LICENSES; license decision pending (`LICENSE.todo.md`).
- **Fixes:** 29 broken symlinked PNGs replaced with real files; sound index paths
  made relative; one skill source of truth with a synced Claude Code copy.
- Saved projects keep their language, fonts and look. See `docs/MIGRATION.md`.

## Portable motion production skill

- Consolidated the default create, review, resume and export workflow into
  `SKILL.md`. The former production skill forwards to it.
- Moved the layered scene and scene packet guides from `output/` to
  `references/` and updated the storyboard command, skills and local indexes.
- Removed three verified byte-identical duplicates: the root Pendulum fit JSON,
  the archived green-brand video and the archived Raycast video. Removed the
  duplicate archive's guide and empty folders. The canonical copies remain.
- Retired Citron Clay, Violet Cutout and new clay preset creation. New reference
  jobs require 3D object records and still require provenance and visual review.
  Saved jobs and render dependencies retain their original style data.
- Added a short-form editing guide and a searchable local memory file. The
  root skill uses both when planning new work.

### Folder tree

```text
SKILL.md          Portable agent workflow
AGENTS.md         Repository development and production invariants
README.md         Setup and command reference
CHANGELOG.md      Migration record
references/       Production guides, reference footage and evidence
memory/           Verified techniques, setup notes and preferences
assets/           Fonts, asset masters, variants, audio and provenance
scripts/          Command entry points and checks
engine/           Planning, project state and validation
renderer/         Deterministic capture, audio mix and encoding
components/       Scene and layer renderers
animations/      Registered motion behaviors
config/           Runtime configuration and reference evidence
presets/          Reusable and compatibility settings
motion-library/   Reference indexing and search
audio_pipeline/   Optional local speech analysis
skills/           Specialized workflows and compatibility entry points
templates/        Authoring templates
examples/         Sample inputs
tests/            Verification
workspace/        Local requests, jobs, pinned inputs and history
mp2/              Video exports
output/           Historical work and optional examples
```

The collection catalog and visual review now live under `references/`.
Saved evidence paths using the former catalog location still resolve to the
same checksummed anchors. The shared Claude Code and Cursor entry point lives
under `.claude/skills/`. Historical handoffs, saved media and prior exports
were preserved.
