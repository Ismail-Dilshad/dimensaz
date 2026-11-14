# Footage clean-up

Three fixes for the user's own footage: shaky clips are measured and steadied (or flagged as too
shaky to save), private details are blurred when the user asks, and screen recordings get a
highlighted cursor, zooms where clicks change the screen, and the waiting trimmed. Each one works
from the terminal, in an edit list and on the page (**Edit by text**, Clean-up), and the studio's
footage jobs use them. Every result is a new file; nothing the user made is overwritten.

## Shaky footage

`pnpm tempoloom media shake FILE...` measures each clip with FFmpeg's own stabiliser (vid.stab), so
no extra tools are needed. Shake is how far the camera's path strays from a straight line fitted to
the half second around each frame, in pixels at 640 px wide (a steady pan is not shake). Each clip
gets a verdict:

| Verdict | When | What to do |
| --- | --- | --- |
| `steady` | shake 1.5 or less | Leave it |
| `fix` | up to 14, with a zoom of 20% or less | `media stabilize FILE`, or the `steady` operation |
| `too-shaky` | above 14, or it needs more than a 20% zoom | Use another take, or only its steadiest part (the report lists the worst seconds) |

`pnpm tempoloom media stabilize FILE [--out FILE] [--smoothing 1.0]` writes `NAME-stabilized.mp4`
with the sound kept and reports the shake before and after. It zooms only as much as the shake
needs. `--engine opencv` uses the media tools' older stabiliser instead. In an edit list,
`{"op": "steady", "smoothing": 1}` does the same as a step (put it first). On the page, **Steady the
picture** measures the clip first and says if it is too shaky to save.

## Private details, blurred when asked

Only when the user asks. `pnpm tempoloom media private FILE` finds faces (OpenCV's YuNet detector,
about 0.2 MB, MIT) and text (RapidOCR, Apache-2.0) every quarter second, on this computer; nothing
is uploaded. Text becomes a phone number (7 to 15 digits, in Latin, Arabic-Indic or Persian digits;
only the number's part of the line is blurred) or a number plate (4 to 10 letters and digits, at
least 2 digits, on a plate-shaped box). What is found is linked into tracks, so a blur follows a
face or a car as it moves, and only while it is there.

- **The speaker is kept**: the biggest face present most of the time is not blurred. `--all-faces`
  blurs every face.
- `--no-faces`, `--no-plates`, `--no-phones` leave a kind out.
- `--edl-out EDIT.json` writes the `blur` operation as an edit list to check or change first.
- `pnpm tempoloom media blur FILE [same flags] [--out FILE]` writes `NAME-blurred.mp4` directly.
- The face model is downloaded once with `pnpm tempoloom media download private` (or
  `--allow-download`); RapidOCR comes with `pnpm tempoloom media setup`. Without RapidOCR, faces
  are still found and the report says text was not looked at.

The `blur` operation takes `regions: [{kind, start, end, keys: [{t, x, y, w, h}]}]` (fractions of the
frame; `kind` is `face`, `plate`, `phone` or `you` for an area you draw) and `strength` (0.8). Keys
are joined smoothly, so two keys are enough for a slow move. Detection can miss a face in profile
or a plate at a steep angle: look at the result before posting it.

## Screen recordings

`pnpm tempoloom media screen FILE [--out FILE]` writes `NAME-polished.mp4`:

- **The cursor** is found in the picture by its arrow outline (light or dark, at several sizes) and
  gets a soft yellow highlight; a ring shows each click.
- **Clicks** are where the cursor rests and the screen changes next to it within a moment. The view
  zooms in where the click acted (up to `--max-zoom`, 1.8) and back out before the next click.
- **Waiting** (nothing changes and the cursor rests for 1.5 s or more, `--wait`) is cut, keeping
  0.3 s at each side. The time after a click, while a zoom shows what it opened, is kept.

`--plan` prints what was found without rendering; `--no-highlight`, `--no-zooms` and `--no-trim`
leave a part out. Finding the cursor in the picture is a heuristic: a custom cursor, a hidden
cursor or a very busy screen can defeat it. A recorder's log gives exact positions:
`--log CURSOR.json` with `{"cursor": [{"t", "x", "y"}], "clicks": [{"t", "x", "y"}]}` (pixels, or
fractions of the frame). The edit list operations are `cursor` (`path`, `clicks`, `size`, `color`,
`opacity`) and `zooms` (`items: [{start, end, x, y, scale}]`, `ramp`), followed by a `cut`.

## In the studio

Footage-edit jobs measure the shake of each clip and plan screen recordings in their analysis step,
and their finishing step steadies clips that need it. Blurring happens only when the user asked for
it, and the report says what was blurred and that the speaker was kept.
