# Motion Reference Library

Put new videos anywhere under references/motion-examples/. Existing videos directly
under references/ are also indexed in place. Automatic indexing never moves or edits originals. Explicit user-requested organization may rename and move files while retaining their content hashes and reference IDs.

Commands:
- pnpm references:update (incremental)
- pnpm references:update --full (rehash and reanalyze everything)
- pnpm references:status
- pnpm references:search --query "saas cards" --reviewed-only
- pnpm references:show --id ID
- pnpm references:annotate --id ID --file review.json
- pnpm references:clip --id ID --start 3 --duration 4
- pnpm references:source --file source.json

Read motion-examples/_library/index.md for the current inventory. index.json is
machine-readable. Category folders contain _category.json membership lists;
the same source can belong to multiple categories without copying it.

Automatic analysis uses FFprobe, SHA-256, sampled frames, cut candidates and
luma differences. Filename labels are tentative. It does NOT automatically
recognize tutorial instructions or recover easing curves. When asked to update
the library, Codex must inspect contact sheets for reviewNeeded IDs and submit
hash-bound review metadata with evidence, timestamps, confidence and uncertainties.
The review schema is in motion-library/model.ts. Labels/controls outside the
actual animation must be described as interface, not reproduced as design.

The first 120 seconds are measured for cuts/motion; frames sample the full
duration. Sampling can miss brief techniques. No speech transcription is bundled.
Timestamp intervals are approximate unless specifically verified more closely.

video:plan refreshes the index incrementally. The planner uses confident reviewed
techniques to choose registered presets, recommended entrance easing/duration,
and licensed local illustration tags. Reference notes and source hashes are
saved in new scene plans. Source frames/logos are never inserted as output assets.
Explicit animation overrides remain authoritative. Set useReferences:false to
disable guidance; referenceQuery:"pendulum" narrows retrieval to a technique.

New original reusable techniques:
- flow-gradient background: deterministic soft radial color layers inspired by
  the observed CapCut gradient tutorial; select presets/backgrounds/flow-gradient.json.
- pendulum object motion: deterministic badge swing, selected with scene.objectMotion.
Both preserve reduced-motion behavior and use no copied reference artwork.

All ten categories remain present. Claymorphism and 3D currently has no verified
local example. Existing original clay-style assets remain the fallback. Consult
official Blender documentation for Principled BSDF roughness and area-light
softness when real 3D art is requested:
https://docs.blender.org/manual/en/latest/render/shader_nodes/shader/principled.html
https://docs.blender.org/manual/en/latest/render/lights/light_object.html
Official easing reference:
https://helpx.adobe.com/mena_en/after-effects/desktop/animate-in-after-effects/speed-between-keyframes/speed.html

Research checks on 2026-10-25: the Blender search excerpts describe roughness as
surface microfacet roughness and area lights as producing soft shadow borders.
Adobe describes Graph Editor speed adjustment and Easy Ease. These are general
principles, not recovered settings from the uploaded videos. Store future verified
findings through references:source. No unattended online downloader is installed.

The scanner skips unchanged size/mtime entries; changed files are hashed and
unchanged bytes reuse their analysis. Use --full to detect edits that deliberately
preserve both size and modification time. Missing sources remain in the index as
unavailable. Changed content invalidates its old review. Generated derivatives
and index history are preserved. Do not place original media in _library/.

On 2026-10-26, all 14 loose reference videos were visually categorized and moved into the category folders at the user''s request. Editorial narrative examples live under Viral Typography/Editorial Storytelling/. Original bytes, IDs, reviews and derived previews were retained; the relocation receipt and prior index are in workspace/history/.

