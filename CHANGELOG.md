# Changelog

## 5.1.1

- Learned rules are read correctly from `memory.md` on Windows (CRLF line endings).

## 5.1.0: Learning from your feedback

- `pnpm dimensaz feedback add`: every rejection, correction or specific praise is
  recorded at once, without waiting for approval. The user's words go to
  `agent/knowledge/feedback.jsonl`; a rule written for future videos goes to the
  "Learned from your feedback" section of `memory.md`. The same point said again is
  merged and counted, and the newest wording wins.
- `feedback lessons --for "<brief>"`: the rules to apply to a new video. A rule seen twice,
  or one from a rejected video, applies to every video; others apply when the brief
  matches their topics. `feedback list` and `feedback forget ID` manage them.
- The workflow loads the rules at intake, lists them as "Lessons applied" in the
  production design, checks them before every preview, and records feedback during
  review. The Flowly rejection is the first saved rule.

## 5.0.2: Instagram profiles and posts from the page

- When Instagram's data API refuses (HTTP 404 even when logged in), `reach instagram
  profile` and `reach instagram posts` read the profile page itself in the Dimensaz
  browser: name, follower, following and post counts from the page, and recent posts
  and reels with their captions and links. A login page gives NEED_LOGIN.

## 5.0.1: Reach fixes from the first live check

- Site errors such as HTTP 404 from a site API, "not found", page layout changes and empty
  results are treated like Agent Reach does (broken, not "not found"), so the next backend
  or the public web is tried and a missing login turns into NEED_LOGIN. Dribbble search
  falls back to web search when its page layout changes.
- X needs both `auth_token` and `ct0` to count as logged in.
- YouTube transcripts: when yt-dlp gets no subtitles, OpenCLI's transcript reader is tried
  next; the ElevenLabs step no longer hides the real error.
- `reach check` lists what each backend answered.

## 5.0.0: Reach, social platforms and the agent's browser

Agent Reach's core ported into Dimensaz (TypeScript), with its tools and Dimensaz's own
channels:

- `pnpm dimensaz reach <channel> <action>`: read-only access to YouTube (search, video,
  transcript, comments, channel), Instagram, TikTok, X, Facebook, Pinterest, Dribbble,
  Behance, Threads, Vimeo, Reddit, LinkedIn, Bluesky, Product Hunt, Google (images,
  trends, news) and GitHub; `reach read URL` routes any link by itself.
- Agent Reach's logic: ordered backends with fallback, final error codes that stop at
  once, one JSON result shape with hints, search spacing per site, browser slots (2 per
  site, 4 overall), a one-hour pause after a rate limit, short pauses for broken
  backends, public web first for sites not set up, and a public last resort.
- Agent Reach's tools: OpenCLI 2.0.2 (project dependency, read commands only, write
  commands refused), its browser extension (downloaded once, hash-checked), yt-dlp
  (installs itself into .venv at the tested version), Jina Reader, Exa search, and
  optional CloakBrowser.
- The Dimensaz browser: its own profile, hidden, closes after 10 minutes unused, a
  window only for logging in; site logins copied once from the user's Chrome (that site
  only) or made by the user in the window; saved and restored between runs.
- `reach download URL [--confirm]`: study-only reference downloads from any of these
  platforms with that site's login; `reach youtube transcript` uses subtitles first and
  ElevenLabs only with `--allow-upload`.
- `pnpm dimensaz browse`: open, read, extract, scroll and screenshot any page in the
  Dimensaz browser; eval and upload need `--confirm`.
- `reach add|login|logout|remove|doctor|check|update|uninstall`, workflow research
  stage, policies, production design template and skill updated.

## 4.4.0: Free sources and reference videos

- `pnpm dimensaz source search|get`: free 3D models, textures and HDRIs (Poly Haven),
  icons (Iconify), images (Openverse, Pexels, Pixabay), stock video (Pexels, Pixabay),
  sounds (Freesound, Openverse) and music (Openverse). Every result is classified as
  final, study or blocked; blocked licenses (NC, ND, unknown) are never downloaded, and
  each download keeps a `source.json` with its license and attribution line.
- `source render-3d`: glTF/GLB models to transparent PNG views and a transparent
  turntable with three.js in Chromium.
- `source reference URL [--confirm]`: reference videos with yt-dlp (added to the media
  tools), info first, download only when confirmed, always study only.
- `source credits`, `source list`, `source doctor`; new keys `PEXELS_API_KEY`,
  `PIXABAY_API_KEY`, `FREESOUND_API_KEY` (all free) in `.env.example`.
- Workflow, policies, production design template and skill use the free sources in the
  Research, Prepare and Deliver stages.

## 4.3.0: Research and production design before building

- Workflow now has eight stages: a **Research** stage (the product's facts and brand
  from its official site, its existing videos, and current examples of the genre on the
  web plus the local reference styles, all with sources) and a **Production design**
  stage that fills `agent/templates/production-design.md` (goal, product facts, brand,
  references, concept, script, storyboard, visual system, motion system, voice, music
  and sound, timing, assets, deliverables, risks) for approval before anything renders.
- `pnpm dimensaz media brand-scan URL [--download]`: logo candidates, theme colour,
  ranked CSS colours and fonts from a product's website.

## 4.2.0: One workflow for every request

- `agent/workflow.md`: seven stages every request follows (Intake, Brief, Plan with
  approval, Prepare, Build, Review with approval, Deliver), with a routing table for
  prompt-only, script, reference, footage, revision and resume requests, a storyboard
  format, mandatory checks before every preview and delivery, and a fast lane that
  skips approvals but never the checks. Linked from the skill, agent.yaml and AGENTS.md.

## 4.1.0: Pure reusable reference styles

- `references/` is now eight reusable styles and sixteen motion references, written as
  text with only the frames that matter: 274 files and about 158 MB became 120 files and
  20 MB. Each style has `style.md` (look, measured palette, rhythm and motion, all
  observations, the shared prompt base), `style.json`, 3–6 frames and a motion sheet in
  place of its clips. `references/catalog.json` indexes everything.
- Removed duplicates and raw material: the numbered `references/styles/style-1..7`
  copies, the style-library review evidence, every reference video (now motion sheets
  and notes) and the old prompt package (in git history).
- The engine reads the catalog: card evidence, numbered presets, reference folders and
  older saved anchors resolve to the kept frames.
- `pnpm dimensaz media style FILES --save --name NAME` adds new references the same way.

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
