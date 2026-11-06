# Reference production verification

Implemented and inspected in the local Motion-Graphic-Agent project, 2026-10-29/30.

## Corrected weaknesses

| Weakness | Implemented correction |
| --- | --- |
| Unrelated styles could enter new-job defaults or saved-preset selection | Seven active reference presets; reference-style-1 default; legacy projects and explicit legacy commands retain their settings. |
| An accepted pilot could not be read back because stored audit fields violated its strict input schema | Separate review input from stored audit fields; verify fingerprint, actual selected-style images and reference-source hashes. |
| A pinned file could be mistaken for reviewed provenance; central metadata changes could break portability | Pin the reviewed library record with asset bytes; reject missing or mismatched evidence; preserve source originals. |
| Brief recovery could duplicate work or use stale request settings after revision | Retain the failed job ID and load current project.json as authority; require confirmed direction before new production. |
| Sparse previews missed internal actions and cuts | Capture keyframe times and neighboring frames, scene starts, holds and endings. |
| Generic fades suppressed very short effects | For new reference jobs, bound fades to the effect's actual duration; preserve legacy mixing behavior. |
| Spring text changed pixels after out-of-order seeking | Stable compositor layers for director words; the existing exact screenshot equality test now passes across five reveal modes and ten entrances. |
| The pilot's grid was faint, headline slow, and objects insufficiently matched | Separate revision with a stronger grid, earlier readable headline, larger matte phone and pale bubble, joined emphasis, and a stationary hero across the cut. |

Core implementation remains TypeScript/Zod with deterministic render(t), real Rabar 021,
local pinned dependencies and argument-array child processes. No renderer AI service,
framework, model installation or deletion of existing production work was introduced.

## Reference evidence and asset collection

All 54 images were reviewed individually: style 1: 10; style 2: 9; style 3: 8;
style 4: 5; style 5: 10; style 6: 9; style 7: 3. Per-image observations and source
hashes are in config/reference-evidence.json. Written motion directions are distinguished
from actual movement evidence. Still posters do not establish timing or easing;
styles 4–7 have missing written motion content and require disclosed authored choices.

Five new transparent assets were generated: matte phone, pale chat bubble, paper plane,
blue target and separate dart. Two earlier generated assets (glossy phone and bubble)
were also registered. All seven were inspected against light, lavender and dark backgrounds.
They primarily support styles 1 and 2; they are not universal substitutes for other styles.

Records retain previews, searchable descriptions, fixed perspective/material/light notes,
style compatibility, source/license evidence and SHA-256 hashes. Generated output uses
the recorded OpenAI output terms, not a fabricated CC0 license. Original bytes are retained.
These are original assets, not modified variants; future variants require parentAssetId
and verified modification permission. Demo dependencies are pinned inside its project.

Kenney's creator-published Interface Sounds archive was downloaded from
https://opengameart.org/content/interface-sounds. Its 100 OGG effects and bundled CC0
license are retained. Eight effects were imported through sfx:acquire, fully decoded,
probed, hashed and indexed. Existing sounds and their unresolved license status remain.
No ambientCG texture was acquired; that attempted source was unavailable.

Review the portable gallery at workspace/reference-production-assets/asset-catalog.html.
Original generated files, import manifests, acquisition receipts and provider license
are retained in that folder and the content-addressed assets/library collection.

## Demonstration and visual assessment

Job: 2026-10-30_reference-mechanism-demonstration_482.
Corrected project: 2026-10-30_reference-mechanism-demonstration_482_v2.
Format: 1080 × 1920, 60 fps, 10 seconds, H.264 with AAC event audio.

The exact new Sorani demonstration script is preserved in project.json. It has no
narration and makes no speech-alignment claim. A bubble forms over a matte white phone,
then changes into a separate paper plane that leaves the phone. The hero remains in the
same position across the cut. Text is rendered independently, never baked into the assets.

Pilot and complete contact sheets were visually inspected against the actual style-1
phone/chat reference. Native frames and cut neighbors were inspected. The review covers
composition, material, lighting, typography, overlap, motion and mobile readability.
It records accepted differences rather than treating technical checks as visual approval.

Remaining differences: phone and bubble geometry, lighting/contact shadows, headline/object
gap, corner decoration and omitted orbital trail/check badge. The bubble-to-plane change
is a coordinated scale/fade, not a physical morph. Motion and shadows are 2.5D; there is
no mesh rotation, refraction or fluid simulation. Only style 1 has this asset-backed pilot;
the seven-style browser tests establish renderer behavior, not full visual certification.

Audio files were technically verified; auditory quality could not be assessed in this
session because audio input was unavailable. The gallery provides playback controls.
No perfect-match percentage or acoustic-quality claim is made.

## Operating instructions

Give the agent the exact script, reference style (1–7), intended format and optional
narration. The agent uses video:create internally; users need not edit manifests.
The workflow is asset review → pilot comparison → full preview → approved render.
Missing assets trigger local search and inspected acquisition, not generic replacements.
Fix a prepared project as a separate revision, attach it to the same job and inspect
fresh evidence. Resume the existing job after interruption. Existing exports survive.

Technical entry points and command arguments are documented in production-system.md
and reference-motion.md. scripts/reference-demo.ts resumes this demonstration's receipt;
scripts/reference-motion-demo.ts remains an explicitly legacy vector example.

## Verification results

- pnpm typecheck: passed.
- RUN_BROWSER_TESTS=1 pnpm test: 28 test files passed, 164 tests passed, one optional
  Python audio bridge test skipped. Includes seven-style rendering, exact text/RTL,
  out-of-order seek equality, pinning/tamper detection, pilot review and recovery tests.
- video:doctor: FFmpeg, FFprobe and Chromium ready.
- Asset catalog: seven images decoded, eight sound controls, no horizontal overflow.
- Pilot and both full-preview sheets refreshed after the final renderer change and
  inspected. Final fingerprint: e502e8524e6354a3b3c4fba19ae0ca2017a9d70579f3bac8e6610afe0e446cc2.

Final export: mp2/60fps/vertical/reference-demo/reference-mechanism-demonstration_60fps_v2_export02.mp4.
All 600 frames were generated and decoded; zero failed captures. H.264 yuv420p,
1080 × 1920, 60 fps, 10 seconds, 2,375,027 bytes. Full-stream decoding, uniform
presentation timestamps, stream duration agreement and audio/video start alignment passed.
Both streams start at zero. SHA-256:
772b68f47137f452036cfe96e8935d625d08c6f0bce3f24bd959e6078ba1d864.

The encodedFrame and eight frames extracted from the MP4 were inspected, including
4.9833/5.0000/5.0167 seconds around the cut and the plane handoff/departure. The phone
remains stationary across the cut; the new headline begins its authored entrance.
Inspection evidence is retained in the project's renders/3cd2e593-c928-4db6-afcd-12de6020103a
folder. An interrupted earlier render was preserved; the same job resumed successfully.
The earlier completed export was not overwritten.

Portable reusable-assets.zip contains seven PNGs, their import metadata, eight OGG effects,
eight strict sound-import manifests, provenance receipts and the Kenney license. The
original 100-effect provider archive is retained separately. The full local sound index
has 42 entries: 31 user-provided, three other pre-existing effects and eight new imports.

Python audio-analysis code was not changed; its opt-in integration suite was not rerun.
The project workflow files are saved locally. The attempted Git index write was denied,
so these edits were not committed or synchronized to a remote.
