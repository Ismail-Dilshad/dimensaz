# Applying a card in this project

From the project root use the existing video-production and code-motion-shorts instructions, then the technical reference in `references/production-system.md`. For a chosen numbered reference, follow its fidelity and pilot review. Imported posters and clips are reference-only unless separate rights evidence permits another use.

All ten cards run through the main project’s existing reference-stage renderer. A fresh
creation request without a style defaults to **Blue Editorial**. Use `styleCard` for an
explicit card and omit the low-level preset unless choosing a compatible numbered variant.
Run `pnpm video:reference cards` for the supported names. See [layered scenes](../../../references/layered-scenes.md)
for each composition family. Each scene needs a hero, separate compatible companion,
a source anchor, and either timed object actions or an explicit static artwork hold. Resume asset and pilot review
on the returned job ID. Read the geometry report and inspect the encoded clip.

For independently moving focal art, use `referenceMotion.heroMotion` with `origin`, `action` and ordered `keyframes`.
Pass the chosen positive integer `scoreFrames` in each packet scene's referenceMotion and set the production frame rate to 60.
This checks each scene against its own duration and applies the same quintic smoothstep to the shaped text.
Each companion supports its own `origin` and either `beat` or `keyframes`. The local pivot uses 0–1 fractions.
Set `at` to the scene-local frame divided by its total frame count for frame-aligned cuts. For subframe narration cues use scene-relative seconds divided by its exact duration. Translation is in frame-size fractions, rotation is in degrees,
and scale/opacity are absolute. Repeat a complete pose at both ends of any hold and set each destination easing
to `smooth`. Keep moving intervals 24–36 frames and schedule object actions sequentially.
To hold all art while the phrase appears, set `referenceMotion.holdArtwork: true`.

| Template | One visual decision |
|---|---|
| Hook | Pose the source question or show the consequence within the first two seconds. |
| Problem | Show a visible obstacle and the object it affects. |
| Comparison | Set the main option and one quieter comparator in distinct slots. |
| Steps | Show the current operation first. Introduce later steps only when their roles are clear. |
| Stat | Use a number present in the script and a readable unit or comparison. |
| CTA | Hold one achievable next action and its complete final phrase. |

**Planning board.** Save UTF-8 JSON with `script`, `style`, `safe`, `textZone`, `iconZone` and `scenes`. Rectangles are normalized [left, top, width, height]. Each scene has `id, role, copy, duration, phrases, icons, motions, still`. Each phrase is an exact contiguous string and all phrases concatenate to the scene copy. An icon has `subject, meaning, box` and optional `callback`. List the focal icon first. A motion has `target, start, end, reason` and optional `dominant` (default true). Provide the actual relative still path for that scene. Use `copyCallback` for repeated supplied wording. Never infer spoken word times from these durations. Save authoritative voice evidence in the host project. Run `python check_board.py BOARD.json` to validate structure and write a uniquely named storyboard HTML beside it.

For collection cards, each board row also needs `anchor` and `relationship`, each icon needs an actual `assetId`, and each motion target must name an icon. A mechanical part can be as large as its receiver. For a larger thin halo behind the hero, record depth "behind", its overlap and a quietReason explaining the low visual weight. Set `role: "part"` and use `overlaps: {"earlier subject": "why the silhouettes touch"}` to document deliberate contact with a previously listed object. Optional per-scene iconZone and textZone support changes in headline position.

**Final review.** Extract half-second encoded samples using `python frame_qa.py VIDEO.mp4 --out QA-FOLDER`. The tool creates a fresh subfolder, computes pixel-repeat diagnostics and binds its report to the export hash. Compare the source stills and decoded frames at full size, checking text joins, contrast, hero/text intersections, margins and repeated concepts. For card projects inspect the host layer geometry report. For explicit script-explainer projects inspect their contrast and geometry report. Add samples around short transitions. Check movement in playback. Score each of the five criteria with an observed example and time; record corrections and re-review when a score is below four. Frame hashes can detect identical pixels, while the ledger and reviewer detect reused meanings.
