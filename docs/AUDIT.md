# Repository audit

Audit of `main` at `b2898a0` (2 commits, 1,625 tracked files, about 990 MB on disk
with assets), made before the `feat/agent-foundation` restructure.

Baseline before any change: `pnpm typecheck` passed; `pnpm test` passed 154 tests,
skipped 24, and failed 1 (`tests/font-catalog.test.ts`, because the only English
fonts were Windows system fonts that do not exist on Linux or macOS).

## 1. Broken on any machine except the author's

| Problem | Where | Effect |
| --- | --- | --- |
| 29 PNG files committed as symlinks to `D:/Coding - Projects/Motion-Graphic-Agent/...` | `assets/created-collection/scenes/*/assets/` | Broken images for every other clone. On Windows, git reports I/O errors and the files show as modified. Every target exists inside this repo under `assets/library/`. |
| Absolute Windows paths in data files | `assets/sfx/index.json` (42 entries), 20 files under `assets/library/`, `assets/created-collection`, `reference-motion-update-manifest.json`, two `references/*.md`, `.env.example` | Sound lookup and some asset metadata only resolve on the author's D: drive. |
| English fonts are Windows system fonts | `config/fonts.json` (Arial, Segoe UI, Calibri, Georgia with `C:/Windows/Fonts` paths), Latin fallback in `src/engine/config.ts` | English renders depend on the OS; one test fails on Linux and CI. |
| No CI | none | Nothing verifies a clean clone. |

## 2. Hardcoded language and font defaults

- Sorani is the default language in four schemas: `src/engine/schema.ts`,
  `src/engine/production.ts`, `src/engine/conversation.ts` (`languageSchema.default('ckb')`), and
  the CLI help.
- One Kurdish font is hardcoded as the global default for every language:
  `config/typography.json` (`font`), `src/engine/production.ts` (`font` default),
  `src/engine/font-catalog.ts` (recommendation note), `src/engine/style-director.ts`,
  `src/engine/reference-styles.ts`, and its name appears in 41 text files (AGENTS.md,
  SKILL.md, skills, references, tests, scripts, memory).
- "Sorani-first" wording appears in README.md, AGENTS.md, SKILL.md,
  `.claude/skills/reelwright/SKILL.md`, `output/custom-motion-shorts-v2/SKILL.md` and
  `docs/records/original-skill-v2.md`.
- No automatic language detection: a request without `language` is treated as Sorani
  even when the script is English.

## 3. Duplicate, stray and confusing files

| Item | Finding |
| --- | --- |
| Skill entry points | Five: root `SKILL.md`, `.claude/skills/reelwright/SKILL.md` (a different, older copy), `skills/video-production/SKILL.md` (forwarder), `skills/code-motion-shorts/`, `skills/custom-motion-shorts/`, plus a sixth inside `output/custom-motion-shorts-v2/SKILL.md`. |
| `reference-motion-update.patch` (166 KB) and `reference-motion-update-manifest.json` | One-time handoff artifacts at the repo root. Only referenced by `docs/records/reference-motion-handoff.md`. |
| `output/` vs `mp2/` | `mp2/` holds exports (ignored). `output/` is mostly ignored but tracks a skill copy, a Python tool and its own AGENTS.md; `tests/test_scene_packet.py` imports from it. |
| `src/lib/reelwright/` | Brand-kit status helpers, the only thing under `src/`. Imported by `scripts/create-video.ts`. |
| `assets/Rabar_021.ttf` | Byte-identical duplicate of `assets/fonts/Rabar-021-Bold.ttf`, kept because saved projects reference this path. |
| `agents/openai.yaml` | Codex skill UI metadata; describes only the code-motion workflow. |
| `AGENTS.md` | Mixes contributor rules, agent behavior, asset policy, sound policy and status reporting in one file. |
| `package.json` | Named `kurdish-text-animation-video`, `private: true`, no description, repository, bin or license. |
| Root-level one-off scripts | Several single-video scripts in `scripts/` (`build-kak-ismael-video.ts`, `*-white-grid-*.ts`, `clay-redesign.ts`). Kept; candidates for `scripts/archive/` later. |

## 4. Missing for an agent

- No agent definition (persona, modes, question flow), no tool registry, no evals.
- Knowledge exists (`memory/`, `motion-library/`, `references/`) but has no index,
  schema or source/license fields, and no reviewed update path.
- Footage editing (Mode B) has no basic tools: only `video:interpolate` exists.
  No trim, split, crop, reframe, zoom, speed, fade, loudness or caption burn-in.

## 5. Licensing of bundled third-party material

Do not treat this as legal advice; it records what the repository itself says.

| Item | Status in repo |
| --- | --- |
| Kurdish fonts (7 files in `assets/fonts/` plus the duplicate) | **Unknown.** `docs/guides/font-library.md` states that no licensing permissions are asserted. Confirm redistribution rights before a public release. |
| Sound effects (`assets/sfx/`, 42 files) | 11 marked CC0-1.0 (Kenney). **31 have `license: null`**, several with third-party names in the filename (Dragon Studio, Freesound community, Universfield). |
| Generated assets (`assets/library/`, 79 records) | Mostly "OpenAI output terms" or "generated output; reference rights unverified"; 2 MIT. |
| Reference images (`references/style-library`, `references/styles`, `references/style-library-review`, about 167 MB) | Third-party design references with no recorded rights. **The GitHub repository is already public.** |
| `ffmpeg-static` | The npm package is GPL-3.0-or-later and downloads GPL FFmpeg builds at install. Fine as a dependency; note it in third-party notices. |
| `playwright` (Apache-2.0), `zod` (MIT), `esbuild` (MIT), `typescript` (Apache-2.0), `vitest` (MIT), `tsx` (MIT) | Permissive. |
| Speech model `Akashpb13/Central_kurdish_xlsr` | Apache-2.0 per `config/speech-models.json`; downloaded on demand, not bundled. |
| Brand kit (`assets/brand/`) | Project-owned. Wordmark outlines come from Fredoka (OFL-1.1). |
| Project license | **None.** See `LICENSE.todo.md`. |

## 6. Fixed in `feat/agent-foundation`

See `docs/MIGRATION.md` for the path map and the final report in the pull request.
