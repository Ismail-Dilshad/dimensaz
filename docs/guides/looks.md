# Learn a look from a video

Show Tempoloom a video whose feel you like (a TikTok, a Reel, a YouTube Short, any link, or a
file) and make your own videos in its spirit, never as a copy.

```bash
pnpm tempoloom look learn https://www.tiktok.com/@someone/video/123 --name night-reel   # shows title, length, size
pnpm tempoloom look learn https://www.tiktok.com/@someone/video/123 --name night-reel --confirm
pnpm tempoloom look learn my-favourite-ad.mp4 --name calm-paper
pnpm tempoloom make script.txt --like night-reel
```

## What it learns

The video is studied with the existing reference tools plus a text-and-layout measurement (a
link is downloaded for study only, after `--confirm`, into `workspace/downloads/reference`; it
is never placed in a video). Every part goes to one place only:

| Learned from the video | Goes to |
| --- | --- |
| Brightness and the background's colour | The style's tone: dark, light, paper-like or strongly coloured |
| The accent's colour temperature | Warm, yellow or cool accents |
| Cut rhythm, motion energy and easing | The motion curve and the transitions (quick pushes and zooms, or fades and reveals) |
| Headline size (text line height) | The headline size (×0.8–1.3) |
| Stroke weight of the text | The title weight (heavy or light; calibrated on known font weights) |
| Where the text sits and how busy the frame is | Where the visual sits and how big it is |
| Shot length | Scene pacing, for videos without a voice-over (a voice-over keeps its own timing) |
| Its music's tempo and how busy its sound is | The music's mood and tempo, and the sound kit (punchy or sparse) |

Fonts and words are not read: a typeface cannot be identified from frames, so the font stays
one of the open fonts. All measurements are saved as numbers in `assets/looks/NAME.json`
(`look show NAME`); no frames or footage are kept.

## Copying, only when you ask

By default nothing is copied. `--copy colors` (with `--like`, in `make` or `storyboard`, or
`"likeCopy": ["colors"]` in a request) uses the video's own background, accent and text colours
exactly, instead of your brand's, and matches the style's tone to them; text is still checked for
contrast. Other parts are always learned as a feel, never copied.

## How it is used

`--like NAME` (in `make` and `storyboard`, or `"like"` in a request) applies each part above
in its one place, and only there:

- Your brand colours stay unless you say `--copy colors`.
- Every video is still generated from zero and must differ from every earlier style, so ten
  videos "like" one look are ten different designs with the same feel.
- Your own words for the look (`--look`) and your feedback still apply on top.
