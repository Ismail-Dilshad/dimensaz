# Learn a look from a video

Show Dimensaz a video whose feel you like (a TikTok, a Reel, a YouTube Short, any link, or a
file) and make your own videos in its spirit, never as a copy.

```bash
pnpm dimensaz look learn https://www.tiktok.com/@someone/video/123 --name night-reel   # shows title, length, size
pnpm dimensaz look learn https://www.tiktok.com/@someone/video/123 --name night-reel --confirm
pnpm dimensaz look learn my-favourite-ad.mp4 --name calm-paper
pnpm dimensaz make script.txt --like night-reel
```

## What it measures

The video is studied with the existing reference tools (a link is downloaded for study only,
after `--confirm`, into `workspace/downloads/reference`; it is never placed in a video):

| Measured | Becomes |
| --- | --- |
| Brightness and the background's colour | A dark, light, paper-like or strongly coloured tone |
| The accent's colour temperature | Warm, yellow or cool accents |
| Cut rhythm (cuts per minute, shot length) and motion energy | Snappy, springy, smooth or calm motion, and matching transitions (quick pushes and zooms, or fades and reveals) |
| Motion easing | The motion curve |
| All of it | The music's mood (energetic, upbeat, calm, dark, warm) |

Only these numbers are kept, in `assets/looks/NAME.json` (`look show NAME`). No frames,
colours, typefaces or footage of the source are kept or used.

## How it is used

`--like NAME` (in `make` and `storyboard`, or `"like"` in a request) makes those traits much
likelier when the video's style is generated, and sets the music's mood unless you chose one.
That is all it does:

- Your brand colours stay; the look never brings its colours.
- Every video is still generated from zero and must differ from every earlier style, so ten
  videos "like" one look are ten different designs with the same feel.
- Your own words for the look (`--look`) and your feedback still apply on top.
