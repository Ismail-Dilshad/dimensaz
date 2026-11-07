# Contributing to Reelwright

Thanks for helping. Reelwright is an AI agent for motion graphics and video editing.
English is the default language and Kurdish is first-class, so changes must work for
both left-to-right and right-to-left text.

## Set up

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm reelwright doctor
```

## Before you open a pull request

```bash
pnpm typecheck
pnpm test
pnpm skills:check          # only if you edited skills/reelwright/SKILL.md
RUN_BROWSER_TESTS=1 pnpm test   # rendering changes
pnpm test:audio            # audio_pipeline changes
```

For rendering changes, render a short preview and look at it. Attach a frame or a
contact sheet to the pull request.

## Where things live

| You want to change | Edit |
| --- | --- |
| How the agent behaves, asks questions or chooses modes | `agent/` |
| The production workflow the agent follows | `skills/reelwright/SKILL.md`, then run `pnpm skills:sync` |
| Rendering, timing, typography | `src/engine/`, `src/renderer/`, `src/components/`, `src/animations/` |
| Footage editing tools | `src/editor/` |
| Language direction, scripts and font sets | `config/locales.json`, `agent/locales/` |
| Fonts | `assets/fonts/` and `config/fonts.json` (see the font rules below) |
| Contributor rules | `AGENTS.md` |

## Rules that keep the project safe

- Preserve the user's exact text: Unicode, whitespace, punctuation, right-to-left
  shaping and complete words. Never reverse strings or split Arabic-script words into
  letters for animation.
- Do not restyle saved projects. Defaults apply to new jobs only.
- Never modify or delete font files. Kurdish text uses only the fonts already in
  `assets/fonts/`. New fonts for other languages need an open license, the license
  text next to the file, and an entry in `THIRD_PARTY_LICENSES.md`.
- Every bundled asset, sound or reference needs a recorded source and license.
  Do not add media you cannot redistribute.
- Keep strict TypeScript and validate inputs with Zod. Call child processes with
  argument arrays, never shell strings.

## Commit style

Short imperative subject lines, for example `editor: add speed ramp`. Explain the why
in the body when it is not obvious.
