# Migration guide: `main` to `feat/agent-foundation`

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
| absolute `D:\...` paths in `assets/sfx/index.json` | repo-relative paths | `engine/sfx.ts` now writes and reads relative paths. |

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

- Language: detected from the script (Kurdish letters ڕ ڵ ۆ ێ ە select Sorani;
  Persian letters select Persian; other Arabic script selects Arabic; Latin selects
  English). Pass `language` to override; Badini and Kurmanji must be named explicitly.
- Fonts: Kurdish uses only fonts already in `assets/fonts/`; other languages use the
  open-license set, chosen by style. Saved projects keep their font paths.
