# Unified Style Director — implementation and validation

Implemented 2026-10-26 in the existing TypeScript engine. This is a working supported subset of `new.md`, not a claim that all its advanced effects are implemented.

## Workflow

When a video request lacks style details, use the existing `video:brief` entry point. It now opens one unified interview and returns exactly one primary question. Present that question naturally, wait for the user, and submit the answer through `video:answer`. Do not present the internal JSON schema as a giant form. Translate the user's natural choices to the validated choices internally.

- Quick: seven primary questions.
- Standard: up to nineteen questions, with irrelevant questions skipped.
- Advanced: all relevant supported categories.
- Auto: resolve unspecified fields with deterministic local script rules.
- Default: resolve from a saved default snapshot, separately from Auto.
- Scope: typography, sound or background only.
- Fully specified supported settings: no mandatory interview.
- Commands: Auto, Default, Custom value/JSON, Skip, Next (skip this choice), Back, Explain, More options, Show examples, Change CATEGORY, Show my selections, Start over, Quick setup, Ask me everything, Customize typography/sound/background only, Use Auto/Default for the rest, Finish configuration, Confirm.
- `Save this style NAME` saves a new preset. Existing names are protected.

Every answer returns a unified resolved summary with original selections and provenance. Confirm that summary before final rendering. Prepare/inspect a lightweight preview and then use the existing finish command. Changing a prepared design retains its previous attempt and requires a fresh preparation/preview. Confirming after a preview also requires refreshing preview evidence. Explicit `auto:true` grants style confirmation for automated briefs; existing preview QA remains in place.

Existing numbered legacy answers are accepted. Existing production manifests and commands continue to work; legacy `video:create` remains the non-interactive low-level entry point. Its optional `director` field integrates the same style schema. Existing projects without that field keep their prior visual behavior.

## Architecture and files

- `src/engine/style-director-schema.ts`: strict version-1 selection/resolved schema and explicit limitations.
- `src/engine/style-director.ts`: persisted interview, adaptive questions, named choices, Auto/Default separation and preset operations.
- `src/engine/director-presets.ts`: seven coherent visual/type/sound presets.
- `src/engine/director-integration.ts`: translates settings to existing config/scenes; derives sound events; validates confirmation, contrast and reviewed timing; preserves manual sound edits.
- `src/engine/schema.ts`: optional director and sound timeline fields; older manifests remain valid.
- `src/engine/conversation.ts`, `src/engine/production.ts`: existing workflow integration.
- `src/components/KineticText.ts`, `src/components/Background.ts`, `src/engine/compositor.ts`: deterministic render-time implementation.
- `src/renderer/audio-mixer.ts`: per-event gain, trim and fades; narration sidechain ducking for music/SFX; limiter without automatic make-up gain.
- `src/renderer/render-controller.ts`: final style and sound approval gate.
- `scripts/style-director-cli.ts`, `scripts/style-director-smoke.ts`: administration and disposable integration samples.
- `tests/style-director.test.ts`, `tests/director-rendering.test.ts`: interview, persistence, protection, timing, sound and browser checks.

No additional packages or models were installed. Rabar 021, scripts, original voice files, asset libraries, existing exports and the Python alignment pipeline were preserved. FPS and hardware-aware capture/encoding remain in the existing renderer.

## Supported controls

Visual: solid/grid/gradient/abstract/noise backgrounds; square/dotted grids with spacing, opacity, width, color and static/horizontal/vertical/diagonal motion; palettes with a 4.5:1 base text/background contrast gate; existing illustrations; center/stack/card compositions; static/gentle zoom/pan camera; cut/fade/slide/zoom/mask transitions. Clay-like visuals use existing 2.5D assets; glass styling is a translucent 2D card, not optical refraction.

Typography: complete-sentence, cumulative words, active-word highlighting, current-word replacement and fixed three-word groups. Fade, directional slides, bounce, spring-like overshoot, scale, blur and mask entrances; independent cut/fade/slide/scale/blur exits; color/underline/background/scale highlights. Font path, size, line height, alignment, width and vertical position are configurable. Use the existing font catalog for available, permitted alternatives. Rabar 021 remains the default. Whole words and directional runs preserve Arabic-script shaping; characters are not split into animated spans.

Word-dependent modes with a voiceover are blocked for final output without reviewed alignment. The original hash-bound alignment checks still run. Missing cues can be previewed as an explicitly unaligned sentence; no exact synchronization is inferred. Fixed three-word grouping is not semantic phrase understanding.

Sound: selection and placement are independent automatic/approval/manual decisions. Candidate events come from selected emphasized words with reviewed cues, object entrances and transitions. Automatic density is bounded; imported sound assets are reused. The automatic matcher currently accepts short CC0 sounds only, through the existing eligibility function. Empty eligible results produce an explicit project warning, never invented licensing. Music is user-provided; enabling it without supplying a music track blocks final rendering.

The project sound timeline stores event/scene IDs, type, time, offset, duration, gain, fades, priority, confidence, media ID, source, license, manual state, approval and disabled state. Automatic event timing is rebuilt when the scene plan changes. Manual corrections remain intact. Manual absolute times stay absolute; review those when narration changes. Unapproved suggestions block final output. Music and SFX duck beneath narration; imported source audio is unchanged.

## Presets and commands

Presets and saved default: `workspace/style-director/presets/` and `workspace/style-director/default.json`. Sessions: `workspace/style-director/sessions/`. `VIDEO_WORKSPACE` overrides the workspace location.

Built-ins: Premium SaaS White Grid, Viral Kinetic Typography, Minimal Editorial, Soft Clay 2D Composite, Glass Tech 2D Cards, Dark Cinematic, Hybrid Motion.

```powershell
pnpm video:style init
pnpm video:style begin --file style-request.json
pnpm video:style answer --session SESSION --text "Quick setup"
pnpm video:style answer --session SESSION --text "Default"
pnpm video:style answer --session SESSION --text "Use Auto for the rest"
pnpm video:style show --session SESSION
pnpm video:style answer --session SESSION --text "Confirm"
pnpm video:style apply --session SESSION --project PROJECT
```

`apply` creates a project revision; it never restyles the original in place. Then generate and inspect that revision's preview using the existing workflow.

A minimal standalone request is `{"script":"Your original script","mode":"quick","voice":true}`. For the ordinary brief workflow, add `"director":{"mode":"quick"}` to the normal title/script/media brief. Do not ask the user to hand-edit these files during a conversation.

Preset commands: `save/load --name NAME --session SESSION`, `duplicate/rename --name NAME --target NEW_NAME`, `default --name NAME`, `list`, and `delete --name NAME --confirm`. Overwriting a saved preset requires `save ... --confirm`; ordinary saves use exclusive creation. Edit by loading a preset into a session, changing its settings, then saving under a new name or explicitly confirming replacement. `previous --project PROJECT` reuses a video's stored director; legacy videos without one return an explicit limitation rather than pretending to reconstruct every creative choice.

Sound correction: `pnpm video:style sound-edit --project PROJECT --name EVENT_ID --text '{"gain":0.1,"offset":-0.05,"approved":true}'`. This creates a revision. You can also disable an event, change time/fades/duration, or select an already imported SFX media ID. Source licensing must be reviewed before importing a replacement.

## Measured validation

Base suite: 130 tests passed, 14 conditional tests skipped. Director browser test was separately enabled and passed: five reveal modes, ten entrances each, repeated timestamp screenshots identical. Supplied test cues validate rendering behavior, not real-speech alignment accuracy. TypeScript checking passed. Separately enabled rendering/language/kinetic/director browser suites passed all 18 tests, including legacy RTL and deterministic seeking. Two additional regression cases cover legacy numbered answers and confirmation after preview.

Three 2-second, 360x640 H.264 samples used a real excerpt of the project's voiceover, synthetic test music and a synthetic test SFX event. Latest measurement directory: `workspace/benchmarks/director-17925b22-a812-4f5e-9a2f-2cab602b79d5/`.

| Style | FPS | Decoded frames | Render/mix/validation time | Output bytes |
|---|---:|---:|---:|---:|
| Premium SaaS White Grid | 60 | 120 | 4.74 s | 239622 |
| Minimal Editorial | 30 | 60 | 1.71 s | 127266 |
| Dark Cinematic | 60 | 120 | 4.79 s | 283338 |

All durations were 2.0 seconds. Audio and video start timestamps were both zero. All three mixed samples measured -16.0 LUFS integrated and -2.7 dBFS true peak using FFmpeg ebur128. These short excerpts do not certify full-program loudness or auditory clarity; no human listening review is claimed. Narrative word alignment was not certified by these sentence-level samples.

Representative frames were inspected for visible Kurdish shaping, text containment and object/text separation. Browser tests also exercise existing rendering components. Timing results are local samples, not an encoder speed guarantee. Detailed capture stats, FFprobe metadata, audio measurements and screenshots remain in the measurement folder. Generated test MP4s were deleted after inspection/measurement; production exports were not overwritten.

## Deliberate limits and remaining work from new.md

- Auto uses deterministic rules and existing scene roles, not a semantic LLM or aesthetic intelligence certification.
- This implementation is conversational/CLI-backed; there is no new graphical wizard or in-question audio audition player. "Show examples" provides parameter examples and explicitly says these are not rendered previews. The existing preview renderer supplies actual contact sheets after preparation.
- No real-time 3D, material relighting, physical roughness, glass refraction, arbitrary mesh morphs, curved/perspective/isometric grids, custom keyframe editor, advanced spring physics parameters or motion blur.
- No character-by-character Arabic animation, line reveal, semantic phrase segmentation, recent-word trails, animated marker geometry or variable font-weight animation. Unsupported enum values are rejected.
- Icon material/color conversion is not automatic; source artwork retains its appearance. Creative labels do not imply arbitrary artwork can be converted into that material.
- Scene overrides currently support reveal, entrance, exit, highlight, object entrance, animation, camera and transitions only; unsupported global-only overrides fail explicitly.
- Advanced parameters not present in the strict schema are not implemented. No silent approximation is accepted as a completed feature.
- Automatic sound sourcing/synthesis, music search, licensed non-CC0 automatic eligibility and a graphical sound timeline remain outside this release. Existing reviewed acquisition tools remain available.
- Legacy saved director-less videos are preserved but do not have an automatic comprehensive style migration. New director configurations are version 1; unknown future schema versions fail validation.
- End-to-end samples were small test renders, not new full-resolution production exports. Existing 60 FPS final export support is unchanged.
