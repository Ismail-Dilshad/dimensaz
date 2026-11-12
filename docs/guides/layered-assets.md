# Layered assets: isolated objects, code-made scenes

Image tools create isolated objects and parts. The existing code renderer creates
backgrounds, grids, lines, typography, composition and deterministic motion. Never
use a video-generation model or generate a complete scene/poster as a final layer.

Use this guide for the asset/code boundary and motion planning; use
the [style card guide](style-cards.md) for reference selection,
scene schema and asset review, and the [main skill](../../skills/tempoloom/SKILL.md)
for the single resumable `video:create` lifecycle. Read each once and continue the
current stage; these links are not instructions to restart intake.

The supplied document is preserved byte-for-byte in
[the original skill record](../records/code-motion-original-skill.md). Consult it for asset
prompt and motion-description examples. Its standalone Python renderer, sample
JSON formats, estimated timestamps and destructive encode/cleanup examples are
not executable project instructions. Apply the integration rules below instead.

## Intake, timing and style

- Preserve the supplied script verbatim, including whitespace and punctuation.
  Voiceover is required for a narrated request, optional for a silent short. Ask
  only for indispensable missing input. Preserve explicit language metadata;
  shared Arabic-script characters do not establish dialect.
- Default to Blue Editorial, the language's font from the font policy (Kurdish: one of the open Kurdish-capable fonts, chosen by style) and 1080×1920 at 60 fps. For any named card,
  plan the hero, independently moving companions and relevant signals as a single
  composition. Use the existing reference-layer stage with the resolved styleCard.
  Follow the [layered scene guide](layered-scenes.md).
- Use reviewed, audio-hash-bound complete-word cues for exact synchronization.
  Sentence SRT is not word timing. Automatic alignment needs review; silence,
  reading speed and character proportions never establish word timestamps.
  Keep unresolved times null and use the existing alignment-review gate.
  Consult [local audio](local-audio-pipeline.md) before analysis.
- Keep narration unchanged, starting at the existing timeline origin. Do not add
  lead-in, tail, normalization, time stretching or speech anticipation merely
  because the source example does. Voice cues govern scenes and speech events.
- For reference jobs, reuse the selected lock in config.referenceStyle and styleDNA.
  For script-led jobs, use config.explainer and the matching styleDNA; read
  [explainer method](explainer-workflow.md). Never apply both modes.
  State the palette, grid/lines, font and motion briefly; preserve explicit user
  choices. Use the existing Style Director confirmation when needed, without
  adding another approval to a resolved brief. Unsupported effects remain design
  notes until implemented and verified separately.

## Plan code and isolated assets

1. Group exact contiguous script slices into meaningful beats. Their concatenation
   must equal the source. Select headlines by supported complete-word ranges;
   retain qualifiers and negations. Plan a causal mechanism, readable hold and
   handoff, varying composition within the saved style.
2. Draw suitable geometry, charts, rings, arrows, lines and backgrounds in code
   using existing registered components. Generate imagery only for heroes, props,
   independently moving parts or a specifically requested texture tile.
3. Search `assets:library search/assess/check/style/similar` before acquisition.
   Reuse suitable assets and inspect actual bytes. Keep provenance, modification
   permissions, referenceIdentity and review evidence; measured scores are checks,
   not aesthetic certainty.
4. For a moving mechanism, list each independent part, its attachment and intended
   pivot. For example, opening a lock requires a body and separate shackle. Keep
   parts complete and unoccluded in source images. Author supported layer positions
   and keyframes explicitly. Set each movable reference layer's local pivot in
   `origin: {x, y}` (0–1). Place related parts explicitly in the absence of a parent rig.
5. For each unique missing asset, write a prompt specifying one isolated text-free
   object/part, fixed viewpoint, matching material/light, complete silhouette,
   transparent background and padding. Exclude baked grids, typography, borders,
   floors, cast shadows, external glow and extra objects. Code supplies scene effects.
   For 3D object assets (including 3D-style PNGs), generate recolorable surfaces in
   neutral white/gray with visible material shading,
   not the video's accent color. Prepare aligned masks for independently colorable
   regions; apply the selected video palette in a separate derived variant. Reuse
   the master for later palettes. Follow the
   [neutral asset contract](production-system.md#neutral-masters-and-video-palette-variants).
   Restate the same style paragraph for the set. Request true transparency when
   supported; use a contrasting flat chroma key only when necessary.
6. Use available image tools to generate needed assets and continue an authorized
   end-to-end request. If unavailable, use legitimately reusable provider assets
   where suitable; report a concrete sourcing blocker when unresolved. A placeholder
   may illustrate a disclosed draft, but cannot pass a missing-hero or fidelity gate.
   Do not finish with prompts alone when a finished MP4 was requested.

## Ingest and author motion

Preserve received originals. Create permitted cleaned variants separately with
parentAssetId; never edit pinned bytes. Inspect alpha edges on light, dark and final
backgrounds for spill/halos, trimming and resolution. Register and pin actual selected
assets through the existing library and project assetLocks. Follow
[asset intelligence](asset-intelligence.md).

Write a short scene motion description: starting composition, entrances, part action
and attachment, reviewed speech triggers, hold and exit. Map it to supported
referenceMotion fields and registered easing/samplers, following
[reference rendering](reference-motion.md). The source's timeline,
registry and style JSON are conceptual examples, not accepted manifest schemas.
Use project.json as the sole render authority; sidecar plans never compete with it.

Use deterministic render(t); seed any procedural variation deterministically.
Prefer purposeful part motion and static holds. Animate only with a stated reason,
start and end; honor reduced motion. Animate Arabic-script
text as complete shaped words; never reverse strings or split joined glyphs.
Use reviewed speechAnchors where supported. Do not claim automatic stressed-syllable
or music-beat detection, sub-frame blur, partial re-rendering or parent constraints
unless the existing implementation actually provides and verifies them.

Search and audition local SFX for each video; respect explicit silence and keep
narration priority. Source missing reusable effects through the documented
`sfx:acquire` workflow, stopping for unresolved rights, payment or login. Follow
[sound selection](sound-library.md).

## Render, inspect and deliver

Run `video:create` through the main skill. Retain the job ID and resolve its
asset, alignment, pilot and full-preview stages sequentially. Inspect scaled
previews and full-resolution representative frames: exact RTL text, safe bounds,
contrast, hero/text overlap, alpha edges, part attachment, interior motion samples,
cuts and final hold. Compare the actual reference pixels, not filenames or prompts.
Fix failures in a separate revision and resume the same job with fresh reviews.
After agent inspection, approve through the existing preview gate.

Encode and validate through the existing Chromium/FFmpeg pipeline. Do not create
a replacement renderer, execute the source's overwrite command or delete frames,
media, projects or completed exports. A technical pass does not certify visual
fidelity or speech accuracy. Unresolved failures remain blockers or disclosed draft
limitations; a fixed loop count is not permission to certify them.

Inspect encodedFrame plus representative encoded mechanisms and transitions.
Deliver the containing folder, unique MP4 path, duration, dimensions, FPS, size,
scene count, style and asset origins, with actual limitations. Replacements require
separate asset variants/revisions and fresh previews; never tell the user to replace
pinned asset bytes or run the source's nonexistent Python scene command.
