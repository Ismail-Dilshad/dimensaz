# Editor

Edits footage from an **edit decision list** (EDL): a JSON file listing operations that
run in order. The agent writes the EDL from the user's instructions or its approved
suggestions; you can also write one by hand.

```bash
pnpm dimensaz edit --edl edit.json            # run
pnpm dimensaz edit --edl edit.json --validate # check only
```

- Paths in the EDL are relative to the EDL file.
- The input is never modified. The output is never overwritten: without `output`, it
  goes to `mp2/edits/<name>-edit-NNN.mp4`.
- A receipt (`<output>.edit.json`) records the EDL, every step and the final media info.
- Each step re-encodes at high quality in a temporary folder that is removed afterwards;
  the final encode uses the export preset. The frame rate of the first clip is kept.

## Example

```json
{
  "version": 1,
  "input": "interview.mp4",
  "operations": [
    {"op": "trim", "start": 3},
    {"op": "cut", "ranges": [{"start": 12.4, "end": 14.1}]},
    {"op": "reframe", "aspect": "9:16", "focusX": 0.55},
    {"op": "zoom", "scale": 1.15, "start": 20, "end": 26, "ramp": 0.3},
    {"op": "captions", "srt": "interview.srt"},
    {"op": "loudness", "target": -14}
  ],
  "export": {"preset": "social"}
}
```

## Operations

| op | Fields (defaults) | Effect |
| --- | --- | --- |
| `trim` | `start` (0), `end` (clip end) | Keep one time range |
| `cut` | `ranges: [{start, end}]` | Remove ranges and close the gaps (ripple delete) |
| `split` | `at: [t...]`, `keep: [i...]` (all) | Split at times, keep segments in the given order |
| `concat` | `files: [...]`, `position` (`after`) | Join clips; others are scaled and padded to the current size and frame rate; silent clips get silence |
| `crop` | `x`, `y`, `width`, `height` | Pixels, or fractions of the frame when 1 or less |
| `reframe` | `aspect` (`9:16`, `16:9`, `1:1`, `4:5`), `focusX` (0.5), `focusY` (0.5), `width`/`height` | Crop to the aspect around a focus point, then scale (default 1080 wide) |
| `zoom` | `scale` (1.15), `start` (0), `end`, `ramp` (0 s), `focusX` (0.5), `focusY` (0.4) | Punch-in over a time range, with optional eased ramps |
| `speed` | `factor` (0.25 to 4) | Speed up or slow down; audio pitch preserved |
| `fade` | `in`, `out` (seconds) | Fade picture and sound |
| `brand` | `watermark` (true), `position` (`top-right`), `width` (0.16), `opacity` (0.85), `margin` (0.05), `logo` (`primary`, `mark`, `onLight`, `onDark`), `endCard` (true), `endCardDuration` (2.5 s), `endCardText` (brand name) | Logo watermark from `config/brand.json` in a corner, and an animated end card appended (logo springs in, call to action slides up, background drifts). Put it last |
| `overlay` | `file`, `start` (0), `end`, `x` (0.5), `y` (0.5), `width` (0.3), `opacity` (1), `loop` (false) | Place an image or video over the footage. `x`/`y` is the overlay's centre and `width` its width, as fractions of the frame. Transparent `.mov`, `.webm` and `.png` keep their transparency; a video overlay ends with its own length unless `end` or `loop` is set |
| `volume` | `gainDb` | Change audio gain |
| `loudness` | `target` (-14 LUFS), `truePeak` (-1.5), `lra` (11) | Two-pass EBU R128 normalization |
| `resize` | `width`, `height`, `mode` (`pad`, `crop`, `stretch`), `color` | Fit to a size |
| `captions` | `srt` or `cues`, `language` (`auto`), `fontPreset`, `size` (0.055 of height), `color`, `stroke`, `strokeWidth`, `background`, `position` (`bottom`), `margin`, `maxWidth`, `weight` | Burn in captions rendered by Chromium, so Kurdish, Arabic and Persian are shaped correctly. Fonts follow the language policy; missing glyphs stop the edit |

Export presets: `social` (CRF 18), `web` (CRF 23), `archive` (CRF 14, slow), `draft` (CRF 28).

Audio-only operations on footage without sound are skipped with a note.

## Planned

Color grading, transitions between clips and b-roll insertion. They are listed as
`planned` in `agent/tools/registry.json`.

Silence removal, face-aware reframing, stabilization, voice separation and Lottie
rendering are media tools (`pnpm dimensaz media`, see `docs/guides/media-tools.md`);
silence and reframe write `cut` and `reframe` operations for this editor.
