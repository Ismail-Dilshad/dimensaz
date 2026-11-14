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
pnpm tempoloom edit auto talk.mp4                 # plan and render
pnpm tempoloom edit auto talk.mp4 --plan          # write edit.json and plan.md only
pnpm tempoloom edit auto talk.mp4 --like bold-reel --brand
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
explaining each choice; change it and run `pnpm tempoloom edit --edl …/edit.json`. The original
footage is never changed and exports are never overwritten.

## Edit by text

```bash
pnpm tempoloom edit text talk.mp4                 # read it into an edit by text
pnpm tempoloom edit text talk-1a2b                # every sentence, every cut and why
pnpm tempoloom edit text talk-1a2b --cut 3 --hook 1 --shape 9:16 --render
```

Footage becomes its words (ElevenLabs speech-to-text, or `--transcript WORDS.json`), on the page
under **Studio, Edit by text**, or from a terminal.

- **Strike a sentence and it is cut** (click its number; select words to cut only those). Bring
  it back the same way. The preview plays only what stays, in its order, before anything is made.
- **Fillers, long pauses and the silence at the ends** are cut from the start, by the same rules as
  the automatic edit. Every cut is on one list with why, and any of them can be kept again, one at a
  time or all of a kind (every pause, every filler).
- **Lines said more than once** (neighbouring sentences that start alike and share most words, or a
  sentence started again without a pause) are grouped as takes. The strongest is kept, with the
  reason: complete, no fillers or long pauses, no stumbles, nothing left out, clear (and, at a tie,
  the last one). Choose another take with one click.
- **The opening:** the ten strongest moments of one or two sentences (1.5 to 15 s) are ranked: a
  question, a concrete number, a strong claim, speaking to the viewer, a turn; a greeting or a line
  that needs what came before scores low. The one you pick plays first, and still in its place
  unless you move it.
- **A shape that follows the speaker:** vertical, square or 4:5 crops follow the face the media
  tools find (`pnpm tempoloom media setup`, then the 0.2 MB face model); the crop holds while the face
  stays near the middle and glides after it when it moves, never faster than a third of the frame a
  second. Without the media tools the crop is centred and says so. `media reframe FILE --follow`
  gives the same moving crop for any edit list.
- **B-roll from your own clips:** add clips under **Your clips, for b-roll** (or `edit broll add`).
  Each is split into shots with a sheet of three frames and a description, from the file name at
  first; describe what a shot shows in your own words (the studio's analyst describes them too, after
  looking at the sheets). For each sentence, the shot whose description says the same thing is
  suggested, with the words they share; use it and it covers the speaker for that sentence.

**Make the edit** writes an ordinary edit list (`edit.json`: reframe, arrange, b-roll, captions,
loudness) and renders it next to the text edit; it shows in the Gallery. Removing a text edit
keeps the videos made from it and your footage. A studio job editing footage plans its cuts this
way, and its page links to the text edit.

## Editing footage with an edit decision list

Trim, cut, split, concatenate, crop, reframe, zoom, speed, fades, gain, loudness and
right-to-left caption burn-in run through `pnpm tempoloom edit --edl EDIT.json`.
See [src/editor/README.md](../../src/editor/README.md) and the footage-edit
playbook in [agent/modes/footage-edit.md](../../agent/modes/footage-edit.md).
