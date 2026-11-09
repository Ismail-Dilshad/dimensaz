# Footage and audio

Import into each project's input/; originals are copied and never modified.
FFprobe metadata includes duration, dimensions, FPS and audio streams.
A project uses its first video as full-scene footage and its first image as a
supporting object. Extra imported assets remain available for future revisions.
The current engine is not a multi-clip nonlinear editor.

Fit modes: cover (crop), contain (letterbox), background-fill (blurred backdrop).
The browser seeks to each output timestamp; shorter footage holds its last frame.
A pale scrim protects text contrast. Browser decoding requires a supported source
codec; convert unsupported MOV/other codecs with FFmpeg before rendering.
Frame-accurate source seeking should be verified against the source for critical
edits; no assumption of identical timestamps across variable-FPS footage.

Original video audio is preserved by default. Voice and sound effects play at
their explicit imported at offsets; music loops. Configure per-kind volumes,
fadeIn, fadeOut and normalize. Loudness normalization and limiter precede AAC
encoding. Shorter original audio is padded with silence to the timeline end.
A voiceover longer than the timeline is rejected. Extend scenes intentionally.
Speech timing comes from ElevenLabs (speech-to-text for footage, text-to-speech with timings for
voice-overs, both only when a key is set) or timings you import; never invent precise speech timestamps.

Text-to-video defaults to silent. Revisions copy media and source settings.
Final export uses H.264/yuv420p/faststart and optional AAC audio.

## Talking-head footage, fully automatic

```bash
pnpm dimensaz edit auto talk.mp4                 # plan and render
pnpm dimensaz edit auto talk.mp4 --plan          # write edit.json and plan.md only
pnpm dimensaz edit auto talk.mp4 --like bold-reel --brand
```

From the speech's word timings (ElevenLabs speech-to-text, or `--transcript WORDS.json`):

1. **Tighten:** pauses over 0.6 s (`--max-pause`) and fillers are cut.
2. **Punch-ins:** sentences without a visual alternate between the normal framing and a closer
   one (×1.12, ×1.2), which hides the jump cuts (`--no-zooms`).
3. **Visuals on what is said:** the sentences worth showing (a figure, a list, a change, a
   quotation, the call to action; at most one every ~7 s, never two close together) get a visual
   designed from zero ([scene visuals](scene-pieces.md)) in a style generated for this video
   (`--like LOOK` steers it), on a panel between the face and the captions (the right side of a
   wide video); its parts enter on their spoken words (`--no-visuals`).
4. **Captions** from the words that stay, low and compact (`--no-captions`).
5. **Music** of the talk's mood under the voice, ducked while speaking (`--no-music`), then
   loudness to −14 LUFS. `--brand` adds the logo and end card.

Everything is an ordinary edit list in `workspace/edits/<name>/edit.json` with `plan.md`
explaining each choice; change it and run `pnpm dimensaz edit --edl …/edit.json`. The original
footage is never changed and exports are never overwritten.

## Editing footage with an edit decision list

Trim, cut, split, concatenate, crop, reframe, zoom, speed, fades, gain, loudness and
right-to-left caption burn-in run through `pnpm dimensaz edit --edl EDIT.json`.
See [src/editor/README.md](../../src/editor/README.md) and the footage-edit
playbook in [agent/modes/footage-edit.md](../../agent/modes/footage-edit.md).
