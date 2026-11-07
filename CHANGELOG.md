# Changelog

## 3.4.0: Media tools

- **New `media_tools/`** (Python, optional, `pnpm media:setup`):
  silence detection with auto-editor, shot and rhythm detection with PySceneDetect,
  tempo and beats with librosa, face-aware reframing with MediaPipe, and background
  removal with rembg (BiRefNet). One command: `pnpm reelwright media ...`.
- Silence and reframe results write ready `cut` and `reframe` operations for the
  footage editor (`--edl-out`). Models download only with `--allow-download`.
- Tool registry: silence removal and auto-reframe are now ready; new `media-setup`,
  `media-doctor`, `analyze-scenes`, `analyze-beats` and `asset-cutout`.
- `pnpm reelwright doctor` reports the media tools; `pnpm test:media` runs their tests.
- Model pointers for the audio pipeline are stored relative to the cache, so models
  survive moving the project folder.

## 3.3.0: One skill, one source tree

- **One skill:** `skills/reelwright/` is the only skill. The old code-motion-shorts,
  custom-motion-shorts, video-production and legacy skills were removed; their
  working rules live on as guides (`docs/guides/layered-assets.md`,
  `docs/guides/style-cards.md`). Codex metadata moved to `skills/reelwright/agents/`.
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
- **Setup:** `reelwright` command, `reelwright init`, a fuller `doctor`, and the
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
