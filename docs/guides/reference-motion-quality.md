# Reference-motion visual acceptance

This is an agent review protocol, not a new renderer schema or an automatic similarity
score. Use existing project.json, asset locks, pilot.json and reference-review.json.
Keep additional observations in a separate review-notes file in the project workspace.
Never insert these notes as unsupported fields in a strict request or project manifest.

## Evidence and visual specification

Inspect each image in the selected style and its accompanying prompts. Check inventory
hashes with video:reference evidence. Record missing/unreadable sources; do not replace
them with guessed details. Reuse inspection records only while their source hashes match.

For each scene, name the actual anchor image and record:

| Feature | Record from the image |
| --- | --- |
| Composition | Frame aspect ratio; visible hero and text bounding boxes as frame fractions; negative space; focal order; foreground/background relationship. |
| Typography | Line count, relative sizes, weight, alignment, emphasis shape/padding, text/hero overlap and margin. Identify visible hierarchy; do not pretend to identify an unknown font from pixels. Render Kurdish with the Kurdish font. |
| Palette/background | Background, accent and text colors; texture scale/strength; grid spacing/line weight; corner shapes; accent count and placement. |
| Materials | Matte/glossy/translucent areas, edge radius, bevel thickness, surface roughness, metallic highlights and visible internal detail. |
| Lighting/depth | Light direction, highlight position, shadow direction/softness/contact, reflections, occlusion and camera elevation/perspective. |
| Object proportions | Visible object scale, silhouette, part-to-hero ratios, orientation, attachment points and asset internal padding. |

Separate three evidence classes: observed still-image features; written motion directions;
authored/inferred movement. Give footage timecodes only when actual footage was inspected.
Still-image motion prompts are intentions, not observations of speed, easing or physics.
Call measured pixels measurements and visual estimates estimates. Do not invent exact
camera focal lengths, material values or lighting intensities from a poster.

Use one primary anchor for a scene's layout; use other same-style images to resolve
specific details, naming which feature each supports. Do not average conflicting layouts
into a generic style. Retain source aspect-ratio context when adapting to another format.
Document intentional changes such as the renderer's dark text on style-4 orange emphasis.

## Asset fit before scene assembly

Search the local library and inspect candidate pixels before generating/downloading.
Compare these six dimensions to the anchor: subject/silhouette, material, perspective,
light direction, usable resolution, and transparent-edge quality. A metadata tag or
passed-check percentage is insufficient evidence for any of these visual dimensions.

Inspect alpha edges on light, dark and intended backgrounds. Measure visible content,
not merely PNG canvas dimensions. Transparent padding can make a correctly sized layer
look too small. Review readable features at intended mobile size and texture/halos at
native size. Reject baked captions, unrelated icons, severe fringes, wrong perspective,
or finish/light mismatches that change the reference's character.

Prefer regeneration or a verified matching asset over forcing an unsuitable asset into
the scene. A CSS tint/rotation cannot recreate missing geometry, relight a raster, reveal
its unseen side, or turn glossy metal into matte clay. State what an approximation can
and cannot achieve. Split independently moving parts before animation; do not cut up a
finished reference poster and present its baked typography/background as original parts.

Keep originals immutable. Register a derivative as a variant only with verified
modification permission and parentAssetId. Retain source URL, exact downloaded file,
license evidence, creator, hashes and inspection notes. Generated output needs generation
provenance and applicable output terms; never invent a CC0 license. Pin actual selected
IDs and bytes in the project. If acquisition is blocked, supply an exact verified source,
required file and import steps; say which file was not acquired.

## Mechanism and timing review

For each sentence, write its meaning, physical action, moving parts, visible result and
handoff. If the metaphor conveys a different claim, fix the plan before asset assembly.
Preserve negation, conditions, uncertainty, quantities and causality in selected headlines.
Use one contiguous whole-word source range; do not silently rewrite or join distant words.

Sketch initial, active and resolved states. Identify pivots, occlusion order and movement
limits. A drawer slides relative to its housing; a slider changes position along its rail;
a dart approaches and stops at the target; a phone message visibly originates from the
device. Mere bouncing/scaling or motion unrelated to the sentence does not satisfy this.
No automatic rigging, collision system or constraints exist: author and inspect them.
Inspect reduced-motion output separately: this renderer holds authored parts at the
last keyframe, which can place a part offscreen or make it transparent. Choose a useful
resolved state; do not claim reduced motion guarantees all mechanism parts remain visible.

Use reviewed voice timing when present. Resolve speech anchors from source-word indexes;
do not turn reading speed, silence or character counts into alleged word timestamps.
Without voice, choose timing for visible action and reading, disclose it as authored,
and avoid imposing a six-second duration on every sentence. Verify timing after alignment
retimes scenes; normalized keyframes are not fixed absolute seconds.

Sample action onset, interior motion, maximum overlap, resolution and hold. Review the
frame before/at/after every cut at actual output FPS. Match carry-hero geometry and part
end/start states; do not assume the carry flag synchronizes independently authored parts.
Use animation previews or short encoded motion segments when static samples leave the
path/easing unclear. A few stills cannot establish smoothness or audible synchronization.

## Pilot decisions

The existing engine pilots the first scene. Review additional representative/hardest
mechanisms before scaling if the opener is a title or has unusually simple artwork.
Keep source order intact. An isolated test project may explore a mechanism, but its
review is not transferable approval for another project's fingerprint.

Compare actual reference pixels and preview pixels at matching display sizes, then
inspect native details. Evaluate the existing seven criteria: composition, material,
lighting, typography, overlap, motion and mobile-readability. Place palette/background
observations under composition/material rather than inventing extra schema criteria.

| Result | Evidence and permitted use |
| --- | --- |
| pass | The named criterion meets the scene's stated reference intent in inspected frames. Describe what was checked and where. This does not assert pixel identity. |
| accepted-departure | A minor difference that preserves the defining visual/semantic features, or a deliberate change explicitly requested/accepted by the user. Name the exact difference, its effect and why it is acceptable; put it in limitations. |
| fail | Wrong hero/meaning, defining material/perspective mismatch, missing essential mechanism, misleading text, broken glyphs, unreadable headline, destructive overlap, or incoherent motion/continuity. Correct in a separate revision and inspect again. |

Do not downgrade a major mismatch merely because the available tools make correction
difficult. If the requested fidelity is beyond current assets/tools, report the specific
blocked requirement and the prepared alternative; do not approve it as an exact match.
The user may choose a scoped approximation, but their request for fidelity alone is not
authorization to silently lower it. Resolve licensing, missing dependencies and unreviewed
exact voice alignment through their own blocking checks; visual approval cannot waive them.

For each assessment, record anchor path, preview frame/time, observed difference, and
correction or acceptance reason. Avoid repeated generic notes and unsupported percentages.
Never copy an old review into a new fingerprint without looking at the new evidence.
Technical tests establish deterministic behavior and schema validity, not visual approval.

## Completion evidence

Before claiming completion, confirm:

1. Full source text remains exact; selected headlines preserve meaning; the Kurdish font is
   actually loaded and connected Arabic-script words render without glyph splitting.
2. Every scene's separate assets and locks exist. Selected materials/perspectives fit;
   library provenance and licenses remain available. A poster is not used as a flat scene.
3. All full-preview sheets and representative native frames were inspected after the
   final relevant change; cuts, interior actions, holds and ending were included.
4. Audio was auditioned where possible, narration remains primary, and alignment is
   reviewed when exact sync is requested. If listening was unavailable, say so. Full
   decoding/probing is technical verification, not an auditory-quality review.
5. The existing final-output checks pass: codec/geometry/FPS/duration, full decode,
   frame count, regular presentation timestamps and stream alignment. Inspect encoded
   frames for each distinct mechanism and transitions; report what was actually reviewed.
6. Report containing folder, exact unique filename, format/duration, chosen style,
   acquired/reused asset counts, test results and remaining differences. Keep completed
   exports, original/pinned assets and failed-run evidence; never silently clean them up.

Only claim evidence for the styles/scenes examined. A single style-1 pilot is not
certification of seven styles. The previous demo is a baseline with documented departures,
not a quality ceiling or proof that its omissions are acceptable for future requests.
