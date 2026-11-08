# Dimensaz: agent and contributor guide

Dimensaz is an open-source AI agent for motion graphics and video editing.
English is the default language; Kurdish is first-class.

## If you are handling a video request

Follow [skills/dimensaz/SKILL.md](skills/dimensaz/SKILL.md). It links the persona,
production policies, mode playbooks, briefing questions, tools and knowledge in
[agent/](agent/README.md). Do not require users to edit JSON or run commands; prepare
requests and run the tools yourself.

## If you are changing the code

### Invariants

- Strict TypeScript, Zod validation at every boundary, child processes with argument
  arrays (never shell strings).
- Preserve Unicode, whitespace, punctuation, right-to-left shaping and complete words.
  Never reverse strings or split Arabic-script words into animated letters.
- `project.json` is the authoritative versioned render manifest; `job.json` is
  recovery state; request JSON is creation input. Never render from job or request data.
- Deterministic `render(t)`: no real-time timers or external AI services in the
  renderer. No UI framework. Reuse registered presets and components.
- Saved projects are never restyled: new defaults apply to new jobs only. Keep legacy
  commands and configs working (add aliases rather than removing scripts).
- Never overwrite exports or automatically delete media, projects, completed renders,
  pinned assets or fonts. Writes to one project are sequential.
- Fonts: never modify or delete font files. Kurdish text uses only the open fonts in
  `assets/fonts/open/` that cover every Kurdish letter; other languages use
  open-license fonts in `assets/fonts/open/` too. No hardcoded font names in instructions or code defaults:
  defaults come from `config/locales.json` and `config/fonts.json`.
- Keep `docs/records/original-skill-v2.md` unchanged. Saved projects that point at the
  removed duplicate font path are mapped to its copy in `assets/fonts/`
  (`legacyFontPath` in `src/engine/schema.ts`).
- Every bundled asset, sound, font or reference needs a recorded source and license.
- Ask before large downloads (models, packages, media).

### Where things live

| Area | Path |
| --- | --- |
| The flow every request follows | `agent/workflow.md` (production design template in `agent/templates/`) |
| Agent behavior, modes, questions, tools, knowledge, evals | `agent/` |
| Workflow skill (single source) | `skills/dimensaz/SKILL.md` (`pnpm skills:sync` updates `.claude/skills/`) |
| Languages and font sets | `config/locales.json`, `agent/locales/`, `config/fonts.json` |
| Planning, timing, typography, production | `src/engine/` |
| Frames and encoding | `src/renderer/`, `src/components/`, `src/animations/`, `src/presets/` |
| Reference analysis and motion recipes | `src/motion-library/` |
| Footage editor | `src/editor/` |
| Python tools | `audio_pipeline/` (speech alignment), `media_tools/` (silence, scenes, beats, faces, cut-outs) |
| Commands (`pnpm dimensaz`, `pnpm video:*`) | `src/cli/`; developer tools in `scripts/` |
| Brand profile and settings | `config/` (`config/brand.json`) |
| Fonts, brand kit, sounds, asset library | `assets/` |
| Finished example scenes and smoke examples | `examples/` |
| Technical guides | `docs/guides/` (start with `docs/guides/production-system.md`) |
| Historical verification records | `docs/records/` |
| Reference media and style catalogs | `references/` |

Keep workflow instructions in the skill, behavior in `agent/`, and technical detail in
`docs/guides/`. Avoid copying large instructions between files.

### Verify

```bash
pnpm typecheck
pnpm test
pnpm skills:check
RUN_BROWSER_TESTS=1 pnpm test   # rendering changes
RUN_AUDIO_TESTS=1 pnpm test     # Python bridge changes
pnpm test:audio                 # audio_pipeline changes
```

For rendering changes also run `pnpm video:doctor`, render a smoke project, and inspect
the preview and an encoded frame. Record real blockers and results. An isolated test
project may be created for workflow validation; it must not modify engine code.

### Status reporting

`video:create` reports planning, rendering, review, completion and errors. Outside it,
report manually: `python scripts/set_state.py <state> "<detail>"` from the project root.
States are in `agent/status/states.json`. Viewer: run
`python -m http.server --bind 127.0.0.1` and open
<http://127.0.0.1:8000/assets/brand/web/state-viewer.html>.
