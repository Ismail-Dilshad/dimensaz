# Reference motion verification - 2026-10-27

Implementation and checks were performed in the attached C: working copy of
D:\kurdish-text-animation-video. The D: project has not been updated.

## Passed checks

- TypeScript strict typecheck.
- Skill Creator quick_validate.py: Skill is valid.
- video:doctor: local FFmpeg, FFprobe and Chromium available.
- Eight reference-motion tests: exact multilingual script preservation; all seven
  schema snapshots; headline word boundaries; layer limits; deterministic samples;
  backward seeking; actual palette colors; independent delayed parts; reduced motion;
  no-loop rotation; hidden-narration whitespace; persisted layer locks; asset tamper
  rejection; placeholder rejection; conflicting Director/reference choice rejection.
- 65 existing focused tests passed: production (4), voice alignment (5), Style
  Director (12), and timelines (44). Browser-dependent cases were enabled.
- One legacy clay-stage browser test passed after its existing saved-project fixture
  and input files were copied read-only from D: into the isolated working copy.
- Total: 74 distinct focused tests passed. This is not a claim that the full suite passed.
- video:reference list returned all seven choices. The plan command read exact Sorani
  UTF-8 text and produced two draft scenes with explicit missing-asset status.
- A complete preview -> visual inspection -> same-job approval -> MP4 validation
  workflow passed. A subsequent renderer edit invalidated approval; previews were
  regenerated, inspected and the same job rendered a new unique export.

## Encoded demonstration

Job: 2026-10-27_reference-motion-silent-vector-demonstration_066

Latest export:
mp2/24fps/vertical/reference-demo/reference-motion-silent-vector-demonstration_24fps_v1_export02.mp4

540 x 960, 24 fps, six seconds, 144 decoded frames, H.264/yuv420p, 1,177,509 bytes.
No audio was supplied; the demo is intentionally silent. No acoustic-quality claim.
The two scenes preserve exact Sorani source text and use the actual Rabar 021 font,
with no fallback glyphs. Preview contact sheets and the decoded encoded-frame PNG
were visually inspected. Phone, bubble and plane are separate original SVG layers.
This demonstrates actual code-driven layered rendering, not photorealistic likeness.

## Incomplete checks and limits

The full RUN_BROWSER_TESTS=1 test run was stopped by automatic approval review after
it detected a request to an external Visual Studio telemetry endpoint whose payload
was not established or authorized. That full run was not retried. Focused checks and
the production demo used the inspected renderer, which blocks external resources,
uses an offline browser context and loads its inputs from local files.

The full run initially also found an absent saved-project fixture in clay-stage.test.ts;
that fixture issue was resolved and the isolated legacy test subsequently passed.
Independent subagent skill forward-testing was unavailable due to the agent usage
limit; no independent validation is claimed. The actual render workflow was exercised
by the primary agent instead.

Python audio inference was not modified or exercised. Existing reviewed-cue tests
passed, but no new recording was aligned. No Internet or image-generation backend
was added to the CLI: the agent acquires/imports assets with available tools. True 3D
articulation, liquid simulation and raster relighting remain outside the renderer.

The adapted skill is project-local and prepared for the original project; it is not
installed in the personal ChatGPT Skills directory. Applying the patch and saving
these changes in the original project's version control remain pending writable access.

## Reference directory organization

All 69 original source files (54 images, 14 prompt documents, one skill archive)
were moved without byte changes. The seven style directories now live under
references/styles/custom-motion-shorts; the archive is retained under
references/custom-motion-source. The empty root-level source folder was removed.
Active CLI/planner paths, skill instructions and the SHA-256 inventory were updated.
Typecheck, skill validation and CLI style-directory checks passed after the move.
The migration script supports applying the same verified move to the D: project
once that project is writable; it refuses altered or unindexed source files.
