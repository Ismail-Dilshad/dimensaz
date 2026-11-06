# Changelog

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
