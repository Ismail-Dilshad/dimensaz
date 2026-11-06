# Production system

For an explicitly requested presenter edit with full-screen explanatory inserts,
use `preset: "presenter-inserts"`, a video starting at zero, caption scenes
covering the footage, and `presenterInserts: {brand,handle,handleAt,inserts}`.
Each insert supplies a kind (`message` or `viewers`), heading, start and end in
edited-timeline seconds. The presenter disappears during the entire insert; the
original sound continues across the picture cut. Return to the source at its
current playback time. Set caption boundaries from the retained speech and
preserve any limitations of the timing evidence.

## Named collection cards and layered scenes

The reference planner returns two planning-only blueprints and per-scene layer, asset, assembly and timeline tasks.
Complete the [scene packet](scene-packet.md) outside the strict manifest.
Use its isolated-asset queue for sourcing and translate the approved placements and times into supported scene fields.
The CLI marks new packet scenes with `referenceMotion.scoreFrames`. The render gate verifies
1080×1920, 60 fps and the number of video frames between each scene’s own boundaries. Bound speech times stay at their original precision. This opt-in also uses the card's quintic ease for the shaped phrase.
For a named card, an object can have one settle beat or an authored track with multiple actions.
Use `referenceMotion.heroMotion: {origin, action, keyframes}` for the focal subject and `layers[].origin/keyframes` for parts.
Set `keyframe.at = sceneFrame / scoreFrames` on a frame-aligned scene. Use matching start/end poses on both sides of a hold,
and a distinct destination pose for each 24–36 frame action. Each key is a full pose relative to the object's placement.
Use smooth easing on all moving segments. To park all artwork, set `holdArtwork: true` and omit moving tracks.

For new videos, video:create selects Blue Editorial unless the user requests another card or preset. Supply styleCard with the exact card name, e.g. "Red Signal". The selected name binds the actual organized library evidence, style snapshot and asset review. Seven historical numbered presets remain compatible. Saved pre-card jobs preserve their prior motion behavior. Explicit script-explainer requests retain their original path.

For every collection scene, supply a reviewed hero asset, a distinct reviewed companion and the actual project-relative anchor path from the style catalog in referenceMotion.evidence. Use a static camera, heroLoop "none", and loop "none" for parts. Set each layer's final center and size in normalized frame coordinates, with depth, optional pivot, and its action. To move a layer add, for example, `beat: {start: 0.35, duration: 0.55, fromX: -0.08, fromRotation: -4}`. Time is scene-relative seconds, displacement is relative to the final pose in fractions of frame width/height and rotation is in degrees. Stagger beats and reserve at least 0.15 s for the settled hold. The stage uses quintic smoothstep with zero velocity and acceleration at each end. Parked layers and the reading background stay fixed. Reduced motion removes travel.

Preview samples include each beat's start, quarter points and end. The gate checks visible layer rectangles against the frame and headline words. Art-to-art contact is intentional when documented. Inspect the anchor and final pixels for material, light, story and optical overlap. The installed skill includes an independent encoded-frame sampler.

## Neutral masters and video palette variants

User preference, recorded 2026-11-02: new generated **3D object assets** must be reusable across
videos with different designs and colors without regenerating the object for color
alone. The default is a neutral master, not a permanently blue/red/green asset.
This changes future acquisition practice; it does not restyle existing projects.
Scope: isolated 3D objects and their parts, including the project's 3D-style PNG
cutouts. This is not a blanket rule for photographs, 2D illustrations, icons, text,
backgrounds or other asset types. Actual 3D model sources, when available, should
retain neutral materials and separate named material slots for palette assignment;
their presence does not imply the current PNG renderer can render meshes directly.

- Generate a complete isolated object in neutral white/light gray, with neutral
  illumination, transparent background, useful midtones, highlights, shading and
  material detail. "No color" means no baked theme hue, not a featureless silhouette,
  missing shading or an invisible object. Avoid colored reflections and ambient tint.
- Keep independently moving parts separate. For independently recolorable surfaces,
  prepare grayscale coverage masks aligned exactly to the master canvas, dimensions
  and alpha edges. Derive masks from the actual master; separately regenerated views
  are not reliable masks. Give regions semantic names such as body, trim and accent.
  Retain non-theme materials/details separately where their identity requires it.
- Choose region colors from the resolved video palette (styleCard/styleDNA or the
  explicitly selected palette). Preserve shape, perspective, shading, highlights,
  transparency and fixed material regions. A palette change must not alter geometry.
  Example: one neutral megaphone master gives a blue body/white cone in video A and
  a red body/cream cone in video B, using the same masks and silhouette.
- A grayscale PNG alone does not support selective recoloring. Hue rotation cannot
  color a gray image, and a whole-image tint also changes areas meant to stay white,
  metallic or transparent. Inspect the actual compositing result; colorization of a
  flat render is not physically accurate material relighting or a new camera view.
- Preserve the master and masks together under the object's clearly named directory
  in assets/library/objects-3d. Record source/mask hashes, region names, target color
  values and the reproducible colorization method in an adjacent recipe. This is
  provenance/supporting data, not a new renderer manifest field. Do not invent schema
  fields or claim automatic runtime recoloring is already supported.
- With the existing PNG renderer, create a separate reproducible colored PNG before
  rendering, using an available permitted image-editing/compositing tool. Verify
  modification permission, register it with parentAssetId pointing to the master,
  and pin the selected variant through project.json.assetLocks. Preserve all old
  variants, masters, masks and pinned bytes. Different videos select different
  variants of the same master. Runtime palette-driven masking would need a separate
  validated implementation; documentation alone does not enable it.
- Inspect a new reusable master in two substantially different palettes, on light,
  dark and intended backgrounds, at native and mobile sizes. Check mask alignment,
  edge halos, retained shadows/highlights and unchanged fixed-color regions. Record
  actual review evidence. Do not label a source recolor-ready without working masks
  and verified variants. If tools cannot produce this, retain the neutral source and
  report the missing preparation step instead of quietly generating a colored master.
- Reuse matching existing assets first. Colored legacy assets stay unchanged; prepare
  neutral/masked variants only when needed and permitted. Explicit requests for fixed
  colors or intrinsic material colors override the neutral default for those regions.
  Material, camera or silhouette changes may require new artwork; color-only changes
  do not. A neutral master is not automatically suitable for every visual style.

## Script-led explainer mode (2026-11-01)

See [audit and workflow](explainer-workflow.md). Explicit native-vector requests select `preset: "script-explainer"`; old request defaults and
saved projects retain their behavior. The existing compositor dispatches to a registered
native-vector component; Chromium capture, narration checks, FFmpeg, project.json,
revision, fingerprint, preview approval and export logic are reused.

Request `explainer` contains `{brief:{topic,industry,audience,emotion,tone,domain},
overrides:{...}}`. Domain is commerce/nature/learning/productivity/general. Optional
overrides: palette (label), background/ink/accent/tint (#RRGGBB), backgroundStyle
(none/grid/dots/gradient/texture/mesh), iconSet (rounded/geometric/organic),
iconRendering (outline/duotone/solid), highlight (underline/pill/color), duration
(0.4–0.6), font. A palette label alone does not change color bytes; pass the colors.
Explicit top-level font overrides the default. Director/referenceStyle cannot mix
with this mode. `src/engine/explainer-schema.ts` is the authoritative schema.

Each supplied scene has `explainer:{template,icons,phrases,transition,transitionReason}`.
Templates: hook/problem/comparison/steps/stat/cta. Icons: `{name,meaning,at,callback?}`;
names come from `src/components/ExplainerIcons.ts`. Phrases: `{from,to,at,highlight}` with
complete source coverage, whole words and scene-relative real cue starts for narration.
The first icon is focal; remaining icons enter sequentially in smaller slots.
`match-slide` clears the outgoing icon before the next enters; text has a quiet
whole-phrase reveal and remains through the final word. `match-cut` requires a reason.
No geometry-based physical morph or parent rig is claimed.

`authorizedAutomaticAlignment: "path/to/alignment.json"` binds an existing validated
CTC analysis after media import. Use ONLY when the user has explicitly authorized
automatic timing. Preserve that authorization in the production receipt. It neither
sets reviewed flags nor changes exact-mode defaults. Paths resolve from the request.

Helpers: `video:theme --brief FILE [--output FILE]`, `video:duplicates --project ID`,
`video:frame-qa --project ID [--video MP4]`, `video:critic --project ID --video MP4
--review FILE`. Run `pnpm video:theme --help` for examples. Theme history is per-project
under workspace/history/explainer-themes. All design snapshots and plans live in the
versioned project, not in runtime sidecars.

Preview automatically adds storyboard.html/json, one still per scene and geometry QA.
Hard failures block encoding. Encoding adds half-second frame PNGs/contact sheets,
SRT and a six-second-or-shorter silent preview. Critic reports require five distinct
scores >=4 with evidence and the actual video SHA-256. The main render completion is
technical completion; the skill requires the separate visual critic before delivery.
Automatic QA cannot certify semantic relevance, optical centering or joined Arabic
glyph appearance. Reading-density and exact repeated-pixel reports are diagnostics.

## Code Motion Shorts integration

`skills/code-motion-shorts/SKILL.md` adapts the supplied isolated-asset/code-scene
workflow to this engine. Its original document is preserved under that skill's
references/original-skill.md. The root agent entry point and custom-motion workflow
load the adapter; it introduces no new renderer or manifest format. Existing timing,
reference review, asset pinning, preview, revision and export gates remain authoritative.

## Audit and incremental plan

Existing working layers: CLI lifecycle, brief/session workflow, Zod project schema,
scene heuristics, reference retrieval, deterministic DOM typography, local-only
Playwright capture, FFmpeg mixing/validation, reviewed audio alignment, Python CTC,
and offline review UI. These are reused, not rebuilt.

Issues found: orchestration spread across commands; repeated preset selection;
full-size previews; repeated font/asset reads; no unified job checkpoints; no SFX
catalog; unversioned project format; dense source formatting; PNG screenshot/pipe
throughput dominates rendering. Reference reindexing is expensive and should be
explicit, not repeated for every production request. Legacy preset/renderer
components are still used by classic projects: do not delete them as "unused".
config/naming.json and old template defaults are not authoritative runtime controls.
Windows font paths are saved explicitly; moving projects needs font reconfiguration.

Plan implemented incrementally: version project manifests; add validated request
adapter and stable jobs; expose registered motion as named presets; retain alignment
review gates; add scaled previews, resource/analysis reuse, SFX indexing, logs/tests.
Remaining work is listed under limits rather than hidden behind "production-ready".

## Commands

```powershell
pnpm video:doctor
pnpm video:create --manifest examples/reference-request.json
# Agent inspects returned preview images, then:
pnpm video:create --resume JOB_ID --approve-preview
# Corrected word alignment (creates a separate revision):
pnpm video:create --resume JOB_ID --alignment reviewed.json
pnpm sfx:index
pnpm video:export --project PROJECT_ID
pnpm video:revise --project PROJECT_ID
pnpm references:update
```

Existing video:new/import/plan/preview/render/validate/list/show/script and
video:brief/answer/prepare/finish remain available. Audio commands remain
 audio:doctor/analyze/correct/apply; no automatic model download is added.

## Request and render manifest

`src/engine/production.ts::requestSchema` is strict Zod; unknown request fields fail.
Required: schemaVersion:1, title, script. Optional voiceover and media paths resolve
relative to the request file. Font paths resolve relative to the toolkit root.

Fields: language (ckb default), aspectRatio (9:16), resolution {width,height}, fps
(60 for new final requests; saved jobs retain their value), preset (reference-style-1), background (auto), energy (balanced), font (the language default from config/locales.json; Kurdish uses the existing Kurdish fonts),
media [{file,kind,at}], wordAlignment, scenes, referenceQuery, sfx (off), previewScale
(.5), output {codec:libx264,pixelFormat:yuv420p,crf:18}. Media kinds are image/video/
music/sfx; voiceover is a separate field. Resolution must match aspect ratio and
satisfy the existing even-dimension render schema. SFX off avoids unsolicited audio.

The generated project.json is the ONLY render authority. schemaVersion distinguishes
format from revision version. Old manifests without schemaVersion load as version 1.
It stores script, config (geometry/FPS/font/design/output roots), imported media,
scenes (timing, animations, emphasis, word cues), alignment evidence, production
preset and SFX policy. Actual SFX assignments are imported media with timed `at`.
The request is a creation adapter, never a competing live scene plan.

## Architecture and stages

produce() calls existing create/importMedia/planProject/applyWordAlignment/preview/
render/validateVideo functions directly, the same implementations used by legacy
commands. Import probing verifies assets. Planning selects presets and exact source
ranges. Local audio analysis exposes waveform, pauses, sentence groups and editable
word JSON; it never self-approves. Exact evidence re-times scenes to actual voice cues.
Speech-driven entrances and active-word coloring follow cues. Caption fonts load
before measuring layout. FFmpeg receives deterministic PNG frames and emits H.264.
Full decode and stream validation precede unique export and history receipts.

States: pending -> asset-review -> alignment-review (if needed) -> pilot-review ->
preview-review -> rendering -> complete;
errors -> failed with actionable message. job.json preserves project ID, stages and
fingerprint; events.jsonl stores structured events and measured completion elapsedMs.
Resume retains imports and completed planning. Changed source invalidates approval.
A fully completed unchanged job revalidates and reuses its export (no duplicate).
Interrupted frame streams restart rendering; frame/scene-level resume is not implemented.

## Presets

Presets for new videos: `kinetic` (text-only kinetic typography, no assets needed),
`reference-style-1` through `reference-style-7` (and the eight named style cards built on
them), `pendulum-reveal`, `script-explainer` and `presenter-inserts`. They configure the
existing animation registry and components (src/engine/production-presets.ts).
Exact voice cues override
incompatible visual word entrances. Custom effects must be added to the registry
with deterministic tests, not evaluated as arbitrary manifest JavaScript.

## SFX

Place files in assets/sfx (subdirectories allowed). Optional FILE.wav.json contains
category and license. Index records SHA-256, duration, name/sidecar category, final
astats RMS dB when measurable, and licensing when supplied. Categories: clicks,
ticks, typing, pops, whooshes, impacts, notifications, digital, success. Name-based
classification is a heuristic, not acoustic recognition. Unknown licenses are never
auto-selected. Auto selection uses short CC0 sounds at spaced scene transitions;
it disables automatic effects over voice. Explicit sound tracks remain available.
Read the current assets/sfx/index.json rather than treating the initial inventory as
current availability. Verified acquisitions and unresolved legacy rights are documented
in sound-library.md. Indexing an empty directory honestly returns an empty catalog.

## Performance and recovery

PreviewScale reduces raster size without changing logical typography; .5 means
quarter the output pixel count. Final encoding always uses original resolution.
Inspect full-resolution encoded evidence; a small preview cannot certify every detail.
Resources are cached within a browser session; completed jobs reuse validated output.
Successful local analysis can be reused by script/audio/options/code hash. Failed
analyses are retried, never cached as success; refresh analysis after model changes.
Imported media is retained as the local asset cache. No cleanup runs automatically.

Technical failures are corrected conservatively: font fitting, even-size validation,
new preview generation, retryable stages. Invalid source text, unsupported glyphs,
missing media, incomplete alignment and subjective design concerns are reported,
not silently changed. No claim of perfect design is made.

## Limits

No new dependencies or large models installed. Automatic model route remains Sorani
only and requires reviewed results. Other languages accept reviewed provider/manual
word timing. No real-voice accuracy benchmark is implied by fixture tests.
No full 3D engine, multitrack editor, frame-resume, or model-independent alignment
confidence guarantee was added. Same-job concurrent execution is not supported;
run it sequentially. Audio is AAC encoded; originals remain untouched.

## Validation

pnpm typecheck; pnpm test; RUN_BROWSER_TESTS=1 and RUN_AUDIO_TESTS=1 pnpm test;
pnpm test:audio. Existing test:production and test:e2e remain supported. New
production-orchestration tests check request validation, backward compatibility,
preview gate, stable resume, and exact synchronization rejection. Measure elapsed
stage timings in events.jsonl rather than publishing invented speedups.

## Reviewed corrections and revisions

--alignment accepts either reviewed provider/manual wordAlignment JSON or a fully reviewed local analysis exported from review.html. It validates exact words, times and the audio hash before creating a revision. For visual corrections use video:revise, edit that new project.json, then video:create --resume JOB --revision NEW_PROJECT_ID. Only descendants of the same project lineage are accepted. Inspect the resulting new preview before approval.

Benchmark: `pnpm video:benchmark --project PROJECT_ID` saves measured full/half-scale preview timings, without changing the project or claiming a universal speedup.

Current measured results: [production-verification.md](../records/production-verification.md).

## Internet asset library
See [internet-asset-sourcing.md](internet-asset-sourcing.md) for local-first sourcing, provenance, validated imports, agent capability adapters, and current format boundaries.


Asset quality, local retrieval, Style DNA, pinned project dependencies and reviewed recipes: [asset-intelligence.md](asset-intelligence.md).


## Hardware-aware Sorani alignment

Audio setup, cache integrity, candidate research, automatic backend recovery and
review requirements are documented in [local audio pipeline](local-audio-pipeline.md).
New analysis uses `auto`; legacy explicit `ctc`, `whisper` and `pauses` commands remain.
Use `audio:setup` for explicit installation/acquisition and `audio:benchmark` for actual
backend comparisons. Missing downloads remain a blocker, not an estimated exact result.

Optional `project.json.speechAnchors` entries are `{kind:'object'|'camera'|'sfx',
wordIndex,edge:'start'|'end',offset,mediaId?}`. wordIndex is a zero-based global source
word, so scene regrouping does not change its identity. SFX requires an imported SFX
mediaId. Reviewed alignment retimes SFX and resolves visual event times. Bounds,
duplicate targets and stale SFX timing are rejected. Existing manifests omit this field
and retain their appearance. Camera motion remains deterministic 2D parallax.

Renderer presets, native 60/120 FPS, bounded capture, encoder selection and measured
results: [render-performance.md](../records/render-performance.md). The renderer upgrade's
remaining regression/benchmark checks are explicitly listed there.

## Unified Style Director integration (2026-10-26)
Use the existing brief/answer/prepare/finish conversation entry points for underspecified video styles. They now share one persisted director session and ask one primary question at a time. Preserve explicit preferences; distinguish Auto from saved Default; show the complete resolved summary before confirmation. Do not present unsupported 3D, audio synthesis or other effects as available. Read `docs/guides/style-director.md` for the supported schema, commands, tests and limitations. Low-level production manifests may supply a validated `director` object; older manifests continue to work without one.

## Clay studio illustration layout
The optional `config.illustrationLayout: "clay-stage"` enables a raised-card composition with pinned bundled illustrations, shaded surfaces, staggered spring entrances, floating accents, and narration-bound typography. It is an opt-in 2.5D CSS/vector treatment, not a 3D simulation. Legacy manifests retain their existing layout. Motion is sampled from scene time and respects reducedMotion. The separate clay revision preserves source script, audio and automatic acoustic cues; those cues remain explicitly not human reviewed.

## Reference motion videos
Seven references/styles/custom-motion-shorts presets and a project-local custom-motion-shorts renderer workflow are available. See [reference motion rendering](reference-motion.md). Use `pnpm video:reference list` and the existing `video:create` lifecycle.

## Reference production gates (2026-10-30)

New reference-style projects store referenceWorkflow.version:1. Existing manifests without this marker
retain their prior workflow. --legacy-style is an explicit migration/compatibility
escape hatch, not a new-video menu option; with it, an omitted preset resolves to
`kinetic`. Brief sessions use the same resumable production job and retain
failed job IDs. Confirm their resolved style before preparation.

An incomplete storyboard returns asset-review and asset-board.json. Resume the same
job with --storyboard FILE.json while unplanned; after planning use a separate revision.
Reviewed assets require referenceIdentity plus verified provenance. Pinned dependencies
now include immutable libraryEvidence so portability does not depend on mutable catalog
metadata. A bare pin is not visual/license approval.

The first scene is the pilot. preview(...,{pilot:true}) saves pilot.json; its samples
include action keyframes and adjacent frames. --review accepts the completed template
with a reviewer, actual selected reference image paths and seven assessments. Failed
criteria are rejected; accepted departures need limitations. Acceptance stores hashes
of reference sources. Stale/mismatched references or fingerprints block render/export.
The agent supplies this review after looking at pixels; the program cannot establish
visual equivalence. Full preview approval remains a separate gate.

See reference-motion.md for authored mechanism fields and reference-production-verification.md
for the actual demonstration, acquired assets and remaining limitations.
Apply [visual acceptance](reference-motion-quality.md) when preparing reviews. These
are agent decision rules; the current schema verifies report structure and hashes, not
whether a reviewer correctly classified a visual mismatch. Additional evidence notes
belong in sidecars, not unknown project/request fields.
