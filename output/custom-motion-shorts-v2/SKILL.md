---
name: custom-motion-shorts-v2
description: Produce a Sorani-first motion short using the classified Classic and reference style library, a script-led style choice, isolated assets, phrase-safe typography, storyboard checks and an encoded-frame review.
---

# Custom motion shorts

Choose scene length from the script, reading hold and visible action. For narrated scenes, follow the recording’s bound cues and pauses. Use a fixed duration only when the user requests one.

For every scene and every style, complete the [seven-section scene packet](../../references/scene-packet.md).
Separate both master blueprints from the individual asset requests and motion instructions.
Run the [packet helper](scripts/scene_packet.py) before acquisition to reserve missing objects, and again
after still inspection to publish the final registry, layer timelines and scene summary. Only queue entries
may go to an image generator, one object per call. The host renderer assembles the complete frame.

1. Read the exact script, recording and explicit preferences. Identify topic, industry, audience, emotion and tone. If asked for a topic-based script, mark new writing as authored. For supplied copy, retain every word, separator and punctuation mark. Defaults are vertical 1080×1920, 60 fps and Rabar 021.
2. **Default to Blue Editorial.** A named choice overrides it. Use Auto only on explicit request. For all ten cards follow [layered scene direction](../../references/layered-scenes.md) and pass the resolved name as `styleCard`. Use [styles](references/styles.md) on demand and run the [picker](scripts/pick_style.py) on the brief. An explicit card or folder alias wins. Review recent visual similarities and record the final pick once. Classic keeps blue/white, a fine grid, glossy objects and blue phrase chips. Use the working library's catalog to locate actual visual anchors and check the material at mobile size.
3. Make one storyboard row per meaningful source slice. Begin with a hook visible within two seconds, end with an action or closing thought, and choose a [role template](references/production.md). Reserve fixed icon and text zones and generous safe margins. Each beat combines at least two distinct registered assets. Stage one focal object together with the thing it acts on, the destination, or the response. Assign depth, attachment, timing and a specific role to each companion. A phone must show the relevant state.
4. Draft each asset with the [image brief](references/prompt-for-each-image-reference.md). Name the symbol and source file in the already-used ledger. Use the [motion brief](references/prompt-for-motioning-each-image.md) for its one explanatory action. Hold by default. Use the card's easing and a 0.4–0.6 s window. Keep outgoing and incoming subjects apart, and carry a meaningful anchor across cuts.
5. Group the exact text by phrase, preserving RTL joining. Align narrated reveals to reviewed, audio-bound source cues, or to existing explicitly authorized automatic cues for that recording. For silent scenes, set comfortable reading holds. Search and audition permitted local sounds when useful and duck them beneath the narration.
6. Prepare a still for every scene. Run the [board check](scripts/check_board.py) and inspect the resulting table and stills for a clear hook, readable copy, object meaning, crop, contrast and shape. Revise failures before the full render. Preserve author-supplied repeated wording with an explanation. Document deliberate visual callbacks.
7. Use the host project's `video:create` workflow and its preview, revision, asset-lock, alignment and hash checks. See the [production notes](references/production.md) for how card names map to renderer capabilities. A reference poster is a design anchor. The renderer needs isolated objects and real type.
8. Sample the validated export with [frame QA](scripts/frame_qa.py). Inspect the actual letters, object bounds and handoffs alongside the storyboard. Record a score and an observation for clarity, repetition, smoothness, readability and balance. Revise any score below 4/5 and repeat the affected checks. Deliver the validated MP4, captions, silent preview and actual limitations.
