# Style cards and reference-led shorts

Read [production workflow](../../skills/dimensaz/SKILL.md),
[reference rendering](reference-motion.md), and
[asset acquisition](internet-asset-sourcing.md).
Apply [visual acceptance rules](reference-motion-quality.md) before
approving assets, a pilot or an export. Use the main skill for job orchestration;
use this guide for creative decisions. Do not recursively restart either workflow.
This is a project workflow, not a standalone renderer or an installed cloud service.

Apply the [layered asset guide](layered-assets.md) for the isolated-asset/code
boundary, moving-part decomposition and motion descriptions. Continue this guide
for reference fidelity and the main skill for job stages; do not restart intake.

## Outcome and priorities

Produce an actual validated MP4 through video:create. Prompts and storyboards are
intermediate tools, not the finished result, unless the user asks only for prompts.
Adapt the source package; never execute its "NEXT" stopping points during an authorized
end-to-end render. Preserve exact source script, the project font chosen under the font policy, Unicode/RTL and original
recordings. Do not replace the current production system. Existing projects remain intact.

The original prompt package is kept at
`references/style-library/shared/original-packages/custom-motion-shorts.skill`. Its original baked-in typography, six-second timings, English default and SFX-only
default do not override this project's Sorani, real typography or voice timing rules.

## 1. Resolve the brief

Use the supplied exact script and selected style. If the user provides a topic instead,
draft a script consistent with their stated purpose; do not use reference poster copy as
their new script. Ask only for indispensable missing information.
Use 9:16 and existing export defaults unless specified. Respect explicit no-icons,
text-only, no-SFX and reduced-motion instructions; no-icons removes decorative icon
accents but does not silently remove requested hero objects.

Use **Blue Editorial** when the user delegates the choice. Run `pnpm video:reference cards` for the eight available styles.
Run `pnpm video:reference cards` for names and `video:reference plan --style "NAME"`
for a starting board. With no style argument the plan uses Blue Editorial. Explicit
choices win. Read the [composition and motion guide](layered-scenes.md).
For every scene cite its actual collection anchor and compose a relationship with
separate pinned objects. Put the receiving part at the actual point of contact.
Approve the pilot only after the intermediate positions and final hold match the
card's material, palette, hierarchy, light and lettering.

## 2. Read evidence and plan scenes

For **every scene** complete the [seven-section scene packet](scene-packet.md).
Write the still and motion blueprints, inventory reusable layers, queue one isolated request per missing object,
then assemble and inspect the still and the scene’s chosen frame range. Deliver the scene/asset/timing summary.
The blueprints stay in the planning sidecar. Only individual missing-asset prompts may go to an image tool.
The [six-scene worked packet](../../output/scene-packets/why-customers-buy-elsewhere/review/scenes.md)
includes its still inspections and final timing table. Its [editable source](../../output/scene-packets/why-customers-buy-elsewhere/plan.json)
shows the registry, layer instances, pivots and exact frame ranges.

Inspect the selected references/style-library/styles folder, including its posters, briefs and clips. For historical numbered projects also retain their original references/styles/custom-motion-shorts evidence.
Inspect every image individually when establishing the selected style, including small
details at native resolution. A contact sheet, filename, prompt or catalog observation
is not a substitute. For unchanged, previously inspected sources, retain the inspection
record and reopen the actual scene anchors. Inspect new or changed sources in full.
Read docs/records/reference-motion-audit.md and run video:reference evidence --style style-N
for the hash-checked, per-image observations and missing-reference inventory.
Static images establish composition/material/palette, not measured movement.
Folders 4–7 have empty motion documents: design their movement and label it inferred.
Record a visual specification with source paths/hashes, observed features, written
directions and inferred choices separated. Name an anchor image for each scene and
measure the visible hero/text bounds, hierarchy, overlap and light direction. Keep
review notes in a sidecar; do not add unsupported keys to strict render/request schemas.

Use `pnpm video:reference plan --style style-N --file SCRIPT.txt --out NEW-STORYBOARD.json`.
This preserves the script and returns a draft request plus sourcing tasks. Set each silent cut from reading time, the planned actions and the hold needed to understand their result. For narrated cuts, follow the bound voice cues and pauses.
If a boundary conflicts, identify it explicitly. Replace each placeholder
metaphor; choose one physical visual mechanism that explains the sentence.
State the causal chain: source meaning -> object/parts -> physical action -> visible
result. Reject a mechanism that only illustrates a keyword or adds meaningless motion.
Plan beginning, development, readable hold, ending and the handoff to the next scene.
Choose headline ranges as complete words from the exact scene text; retain the full
narration in scene.text and project.script. Vary top/bottom/side compositions intentionally.
Use one contiguous UTF-16 range; do not splice nonadjacent words, remove a negation or
change a qualifier to make a punchier headline. Concatenated scene.text must equal the
original script exactly, including whitespace and punctuation. If a shorter valid
headline changes meaning, retain more words and adjust the composition.
Do not show unsupported numbers or invent statistics.

## 3. Build actual separate assets

For each hero and independently moving part, search local assets first with
assets:library search/assess/check/style/similar. Inspect the selected file, not only tags.
Use code for suitable SVG geometry and UI; use available image tools for glass,
photoreal/clay heroes; research official providers for suitable reusable imagery.
Do not substitute unrelated generic icons and claim the reference was matched.

Generate isolated text-free assets with transparent backgrounds when appropriate.
Keep camera, material and lighting consistent. Restate the complete style lock for
every generation call, using actual reference images when the tool supports them.
For new 3D object assets (including 3D-style PNGs), express the generation color lock
as neutral white/gray surfaces
with preserved shading. Apply the card's final palette afterward using aligned
region masks and a separate color variant; judge that colored variant against the
anchor. Reuse masters across videos instead of regenerating for a palette change.
See [neutral assets](production-system.md#neutral-masters-and-video-palette-variants).
Specify subject, separate parts, fixed view, light direction, surface finish, canvas,
transparency, negative space and exclusions. The renderer owns typography and scene
composition. It currently adds a layer drop shadow and hero ground shadow; prefer
assets without a conflicting baked ground shadow. No per-layer shadow-disable field
exists. Fix the asset or implement a separately validated extension instead of inventing
manifest controls or accepting doubled shadows.
Do not ask an image model to spell Kurdish captions into the hero image.
Use reference posters only as visual guidance. A finished poster animated as one
rectangle is not independent object motion.

Import each asset through `pnpm assets:library import --manifest META.json --file FILE`
(or the documented download command). Preserve actual source, permissions, generation
provenance, reference IDs and hashes. Include referenceIdentity with compatible style
IDs, subject, part, material, perspective, lighting and visual review notes. Set reviewed:true only after visually inspecting
the actual imported bytes against their anchor, on light/dark and final backgrounds
at mobile and native sizes. Review all six fit dimensions in the acceptance rules;
correct important mismatches before building the scene. Technical scores are not
visual similarity. Preserve originals; register variants with parentAssetId and
verified modification permission, then pin selected assets through the existing flow.
An unavailable generation/browser adapter is a blocker to report, not a tool
to invent. Do not install large models or dependencies without the requested confirmation.

## 4. Implement the scene plan

Write the storyboard's request object as its own manifest:
- preset: reference-style-1 through reference-style-7.
- scenes: exact contiguous source slices, chronological timing, actual hero asset IDs.
- referenceMotion: metaphor, layout, headline offsets, entrance, transition, camera.
- referenceMotion.layers: actual asset IDs for hero parts or at most two accents,
  normalized placement, delay fraction, travel, rotation and loop.
- For functional motion, use ordered keyframes with at in [0,1] and normalized x/y,
  scale, rotation and opacity. The destination keyframe selects easing. These override
  a part's generic entrance/travel/loop. Use action to explain the physical function.
- For a named card put a focal track in `referenceMotion.heroMotion` and give parts their own
  `origin` and `keyframes`. The style uses smoothstep for each 24–36 frame movement.
  Repeat the complete pose at both ends of a hold. Use `holdArtwork: true` for a deliberate still.
- Keep part attachment points coherent throughout the action. Check closed/open states,
  occlusion, collision and pivot placement. A drawer needs a visible cavity and sliding
  part; a dart needs an approach and stop at the target. Scaling a whole object is not
  opening it. Label crossfades, warps and swaps honestly; they are not physical morphs.
- Use composition.hero/text rectangles for intentional overlap, headlineRevealSeconds
  for visual pacing without voice, and carry-hero only with identical stationary hero
  geometry, static cameras and a preceding cut. Voice cues always override visual cadence.
- Do not assume parent-child rigs or automatic constraints. Part positions and motion
  must be authored explicitly. Check the coordinate/time conventions in reference-motion.md;
  defaults on omitted keyframe fields are values, not inheritance from the preceding key.
- Use no arbitrary JavaScript from manifests; only registered deterministic samplers.
- Use layered translation/scale/rotation for 2.5D mechanisms. Real mesh turning, liquid
  simulation, articulation and relighting require suitable pre-rendered assets or an
  explicitly implemented renderer extension. Never describe a flat warp as true 3D.
- Record any departure from the reference and inspect it at mobile size.

Do not add a director object unless needed. If supplied, its referenceStyle must match
the selected reference preset. Never let another palette silently overwrite the lock.

## 5. Synchronize and render

Run `pnpm video:create --manifest REQUEST.json`; keep its job ID.
If asset-review, complete its asset board and resume with --storyboard FILE.json.
That file must be a scene array or {"scenes":[...]}, not the planner's {"request":...}
wrapper. Keep source slices exact; use --revision after the project has been planned.
--storyboard updates scenes only. It cannot attach missing narration or change language
and export settings. Inspect the current manifest first; handle those changes through
a separate revision and the existing media/alignment workflow, preserving the same job.
If pilot-review, inspect its frames against actual source images, then complete all
seven assessments in pilot-review-template.json and resume with --review FILE.json.
Use the acceptance rules to distinguish pass, minor/authorized departure and failure.
Never relabel a material mismatch as accepted-departure just to advance the job.
The engine pilots the first scene. If that scene is not representative, inspect the
hardest mechanism too before expanding; do not reorder or omit script to change the pilot.
A review binds project inputs, renderer code and reference sources. Changes require
fresh evidence; do not edit a prepared project in place.
For voiceover, supply voiceover and use reviewed audio-hash-bound word cues through the
existing alignment-review workflow. Use the recording to set individual scene boundaries and update the motion score to match.
Use speechAnchors for hero/SFX events where needed. Reference camera and parts use
scene/hero-relative time; author part delays from reviewed cues for precise triggers. Do not fabricate timing,
speed up narration, or treat automatic confidence as human review.
Without voiceover, scene durations and word reveals are visual pacing only.

Use the existing sound library first, audition suitable effects, and source missing
effects as part of authorized video production; a separate request for each sound is
unnecessary. Respect explicit silence/no-SFX. If listening is unavailable, record that
limitation and do not claim audition or acoustic approval. Keep voice intelligible.
Do not promise synthesized voice, music, or automatic access to unavailable services.

Inspect EVERY preview sheet plus full-resolution representative frames:
connected Sorani glyphs, selected headline meaning, safe bounds, material consistency,
independent motion, line count, transparent edges, readable holds and transitions.
Compare source and preview at matched framing. Record concrete differences with frame
times/paths, rather than a similarity percentage. Inspect interior motion samples and
one frame before/at/after every cut; keyframe endpoints alone can miss collisions.
Fix failures in a separate revision, attach it to the SAME job using --revision.
After agent inspection, resume with --approve-preview; no extra user permission is
needed for routine preview approval.
Inspect encodedFrame and validate the final MP4 through the existing tools.
Inspect encoded frames across each distinct mechanism, the transitions and ending;
one encoded frame is not a complete-video review. Use the delivery checklist in the
acceptance rules. Deliver both the containing folder and exact unique MP4 path,
format/duration and material limitations. Distinguish generated, downloaded, imported,
reused and merely proposed assets. Never claim all seven styles were visually validated
from a one-style demonstration or from seven-style technical tests.
Do not claim exact aesthetic or acoustic accuracy without the evidence.

## Recovery

Resume the same failed job. Preserve source references, pinned layer bytes, completed
exports and originals. If the production directory cannot be written, prepare and test
a patch in the attached writable workspace and clearly state that applying it to the
original project remains pending. Never claim it is installed there.

