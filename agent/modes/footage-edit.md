# Mode: footage edit

**Trigger:** the user gives their own video: a talking head, interview, screen
recording, vlog, product shots or any footage.

## Three cases

| The user gives | You do |
| --- | --- |
| Clear instructions ("cut the first 5 seconds, reframe to 9:16, add captions") | Do exactly that, nothing more. Ask only if an instruction is ambiguous. |
| No instructions | Inspect the footage and propose a short, numbered edit plan with reasons. Wait for approval. |
| A style reference | Study it (see `reference-match.md`) and propose an edit in that style: pacing, punch-ins, captions look, transitions, grade, motion overlays. |

Automatic subtle motion (punch-ins on emphasis, gentle caption entrances) is on by
default unless the user turns it off (`preferences.autoMotion`).

## Flow

1. **Inspect.** `ffprobe` the file: duration, resolution, fps, audio. Sample frames.
   For speech, get a transcript with word times if available (provider or local
   pipeline); otherwise use silence detection for cut candidates only.
2. **Plan** the edit as an edit decision list (`src/editor/README.md`).
3. **Suggest** (when there were no instructions). Typical suggestions for a talking head:
   - Trim the dead start and end.
   - Remove long pauses and false starts (keep natural breaths).
   - Reframe to the target platform with the eyes in the upper third.
   - Punch in 110 to 120 % on key sentences and to hide jump cuts.
   - Add captions in the speaker's language, styled to the brand.
   - Normalize loudness to about -14 LUFS for social platforms.
   - Add a hook title in the first two seconds and an end card.
4. **Execute** with `pnpm reelwright edit --edl edit.json`. Original files are never
   modified; output goes to `mp2/` with a new name.
5. **Verify**: watch the cut points, check audio sync and loudness, inspect captions
   (right-to-left shaping for Kurdish, Arabic and Persian).
6. **Deliver** the MP4 and, if captions were made, the SRT.

## Tools

Ready now (see `pnpm reelwright tools`): trim, split, cut and ripple-delete,
concatenate, crop and reframe, zoom and punch-in, speed, fades, volume and loudness
normalization, resize and pad, caption burn-in, export presets, frame interpolation.

Planned: silence removal, color grading, stabilization, overlays and lower thirds,
transitions between clips, b-roll insertion, noise reduction. When a planned tool is
needed, say so and offer the closest available alternative.
