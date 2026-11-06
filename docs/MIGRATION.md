# Migration guide

## 3.2.0 layout

| Old path | New path |
| --- | --- |
| `engine/`, `renderer/`, `components/`, `animations/`, `presets/`, `motion-library/` | `src/<same name>/` |
| `references/*.md` guides | `docs/guides/*.md` |
| `references/*.md` dated verification records and `original-skill-v2.md` | `docs/records/*.md` |
| `memory/README.md` | `agent/knowledge/memory.md` |
| `motion-library/research-notes.md` | `docs/guides/motion-research.md` |
| `templates/` | removed (unused) |
| 29 one-off scripts (white-grid, kak-ismael, clay-redesign, demos, inspectors) | removed; recover with `git show 3.1.0-commit:scripts/NAME` if needed |

Imports from outside `src/` change from `../engine/x.js` to `../src/engine/x.js`.

Removed presets and cards: saved projects that used `premium-viral`, `word-reveal`,
`active-word`, `text-bounce`, `spring`, `object-motion`, `saas`, `statistics`,
`camera`, `clay`, `premium-transition`, Citron Clay or Violet Cutout can no longer be
resumed with those choices; create a new version with `kinetic`, a reference style
or one of the eight cards. `--legacy-style` now falls back to `kinetic`.

Render fingerprints include source paths, so in-progress jobs need a fresh preview
approval after updating.

`.env` is now loaded by every command (not by tests). Old variable names
(`WORKSPACE_DIR`, `OUTPUT_DIR`, `DEFAULT_FONT`, `DEFAULT_WIDTH`...) were never read;
use the names in `.env.example`.

## 3.1.0: `main` to `feat/agent-foundation`

Every move used `git mv`, so history follows the files. Old pnpm scripts keep working.
Saved projects in `workspace/` keep their stored language and font paths and are not
restyled.

## Path map

| Old path | New path | Notes |
| --- | --- | --- |
| `SKILL.md` (full workflow) | `skills/reelwright/SKILL.md` | Single source of truth. Root `SKILL.md` is now a short pointer. |
| `.claude/skills/reelwright/SKILL.md` | generated copy | Rebuilt by `pnpm skills:sync`; do not edit by hand. |
| `skills/video-production/SKILL.md` | unchanged path | Still a forwarder, now to `skills/reelwright/SKILL.md`. |
| `src/lib/reelwright/` | `agent/status/` | Status states (`states.json`, `reelwright-states.ts`). `scripts/set_state.py` stays. |
| `output/custom-motion-shorts-v2/` | `skills/legacy/custom-motion-shorts-v2/` | Tracked skill copy moved out of the export area. |
| `output/tools/organize_references.py` | `scripts/tools/organize_references.py` | |
| `output/AGENTS.md` | `skills/legacy/OUTPUT-AGENTS.md` | `output/` is now fully ignored local output. |
| `reference-motion-update.patch`, `reference-motion-update-manifest.json` | `docs/archive/reference-motion-update/` | One-time handoff artifacts. |
| `AGENTS.md` (everything) | `AGENTS.md` (contributor rules) + `agent/` (behavior) + `skills/reelwright/SKILL.md` (workflow) | Policies moved, not dropped: asset, sound and reference rules live in `agent/policies.md`. |
| 29 symlinked PNGs in `assets/created-collection/` | regular files | Byte-identical copies of their targets in `assets/library/`. |
| absolute `D:\...` paths in `assets/sfx/index.json` | repo-relative paths | `src/engine/sfx.ts` now writes and reads relative paths. |

## New

| Path | Purpose |
| --- | --- |
| `agent/` | Agent definition: `agent.yaml`, `persona.md`, `policies.md`, `modes/`, `questions/`, `tools/registry.json`, `knowledge/`, `evals/`, `status/` |
| `config/defaults.json` `language` | `"auto"`: detect from the script, fall back to English |
| `config/locales.json`, `locales/` | Per-language direction, script, font sets and agent strings |
| `assets/fonts/open/` | Open-license (OFL) fonts for English, Arabic and Persian, each with its license |
| `brand/profile.json` | Your brand: logo, colors, fonts, voice |
| `packages/editor/` | Footage editor: edit decision list plus FFmpeg backend |
| `docs/AUDIT.md`, `docs/MIGRATION.md`, `THIRD_PARTY_LICENSES.md`, `LICENSE.todo.md` | Audit, this file, notices, license decision |
| `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `.github/` | Community files, templates, CI |

## Behavior changes for new jobs

- Language: requests, briefs and new projects detect the language from the script.
  Any Arabic-script letters select an Arabic-script language: Kurdish letters
  (ڕ ڵ ۆ ێ ە ڤ ھ) select Sorani, Persian letters select Persian, otherwise Arabic.
  Latin-only scripts select English. Pass `language` to override; Badini and
  Kurmanji must be named explicitly.
- Fonts: Kurdish uses only fonts already in `assets/fonts/`; other languages use
  the open-license set in `assets/fonts/open/`, chosen by style. The Latin fallback
  is the bundled open font instead of an OS font. Saved projects keep their paths.
- Code that calls `defaults()` without a language now gets English. Pass
  `{language: 'ckb'}` for Kurdish fixtures (the tests were updated this way).
- `autoMotion` (default from `brand/profile.json`, on) controls the existing
  reduced-motion path for new jobs.

## New commands

| Command | Purpose |
| --- | --- |
| `pnpm reelwright <command>` | One entry point (`init`, `doctor`, `create`, `edit`, `fonts`, `knowledge`, `tools`, `status`...) |
| `pnpm reelwright init` | First-run setup; never overwrites existing files |
| `pnpm video:edit` / `pnpm reelwright edit --edl FILE` | Footage editor |
| `pnpm knowledge`, `pnpm tools` | Knowledge base and tool registry |
| `pnpm skills:sync`, `pnpm skills:check` | Skill copy generation and CI check |
| `pnpm example:hello en|ckb` | Smoke examples |

All earlier pnpm scripts are unchanged.

## Tests

- `tests/clay-stage.test.ts` now skips when its saved local project is absent (it
  failed on every machine before, because tests run in an isolated workspace).
