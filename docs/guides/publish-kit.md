# Publish kit

What comes after the video is made: covers and titles to choose from, everything to post it on
each platform, and a timeline to keep working in another editor. Nothing is posted for the user;
every result goes in a new folder beside the video, and nothing is overwritten.

## Covers and titles

`pnpm tempoloom publish covers VIDEO --titles "Five camera mistakes|Why it looks flat"` picks the
best frames (sharp, colourful, well exposed, away from fades), far enough apart to be different
pictures, and draws each one with each title, turning through the layouts: `side` (the title on a
shaded side), `bottom` (over a shaded foot, the default for tall covers) and `big` (centred, the
last word on an accent block). The last word takes the brand accent and the logo sits in a corner.
A long title shrinks until it fits. `covers-sheet.jpg` shows them all side by side.

- `--count 3` frames (up to 6), `--size 16:9|9:16|1:1` (the video's shape by default), `--at S`
  one exact frame, `--layouts side,big`, `--no-logo`, `--out FOLDER`.
- Up to four titles. Without titles the covers have no text.
- Kurdish, Arabic and Persian titles are set right to left in the open fonts of the language.

`pnpm tempoloom publish titles SCRIPT.txt` (or `--edit TEXT-EDIT`) suggests titles from what the
video says: its strongest lines (a question, a number, a strong claim, speaking to the viewer),
under 60 characters, each with why. They are a starting point; the studio's writer sharpens them.

## Post package

`pnpm tempoloom publish package VIDEO --for tiktok,reels,shorts,youtube --title "..." --caption "..." --tags camera,tips`
writes `NAME-post/`:

| File | What it is |
| --- | --- |
| `video-9x16.mp4`, `video-16x9.mp4` | The video in each shape the platforms need (made with `media formats`: a crop around the subject, or the whole picture over a soft copy of itself) |
| `cover-9x16.jpg`, `thumbnail-16x9.jpg` | A cover for each shape, with the title |
| `captions.srt` | The captions, from `--srt FILE` or from an edit by text (`--edit TEXT-EDIT`) |
| `post.md`, `post.json` | For each platform: which files, the title, the caption with its hashtags, and the checks |

The checks, per platform: the title and caption against its limits (and the 60 characters a phone
shows of a title, the 125 before "more" on Reels and TikTok), the number of hashtags (3 to 5 work
best), the video's length, and YouTube's 2 MB thumbnail limit. The limits were checked on
2026-11-14 (`publish platforms` lists them); platforms change them, so they warn and never block.
`publish check --for ... --title ... --caption ...` checks words alone.

## A timeline for another editor

`pnpm tempoloom edit export EDIT.json --to premiere,resolve,fcp,edl,capcut` (or a text edit's
name instead of the file) writes `NAME-timeline/` with the source clips cut where the edit cuts
them. The footage is not copied; the timeline links to it where it is.

| Editor | File | Import |
| --- | --- | --- |
| Premiere Pro | `NAME.xml` (Final Cut Pro 7 XML) | File, Import |
| DaVinci Resolve | `NAME.xml` or `NAME.fcpxml` | File, Import, Timeline |
| Final Cut Pro | `NAME.fcpxml` (FCPXML 1.10) | File, Import, XML |
| Any editor | `NAME.edl` (CMX 3600, one picture track) | Import the EDL, then link each reel to the file named under it |
| CapCut | `README.txt` cut list and `NAME.srt` | CapCut cannot open another editor's timeline: add the clips in the cut list's order and import the captions |

What carries over: every cut, trim, split and rearrangement (a part played twice is there twice),
clips joined before or after, b-roll and images on the tracks above (with their size; a position
off the centre is in the cut list), the music below with its level, and the captions as SubRip.
What only the render makes is listed in `README.txt`: a steady picture, blur, reframing, zooms,
colour, fades, loudness, the sound layer, the logo and end card. A speed change is carried by the
EDL; the XML timelines keep normal speed and say which speed to set.

The files were checked by reading them back with OpenTimelineIO (the picture, the overlays and the
music land where the edit puts them) and the FCPXML against Apple's FCPXML 1.10 document type.

On the page: **Edit by text** has **Open in another editor** (Premiere or Resolve, Final Cut Pro,
any editor, CapCut) with each file to download, and every video in the **Gallery** has
**Publish it** for covers and the post package, with the checks as you type.
