# Motion kit

Pieces for motion videos and edits: captions that follow the words, transitions chosen by what a
scene says, a sound layer under the voice, perfect loops, a product photo in motion, maps and
routes, and screenshots inside a moving device. Every clip is drawn by the browser, so text in any
language is shaped correctly, and saved as an ordinary MP4 to use in an edit (`overlays`, b-roll)
or a motion video (`import --kind video`).

## Caption styles

`pnpm tempoloom edit captions list` shows them; on the page, **Edit by text** has a caption style
menu and **Save as my style**.

| Style | What it does |
| --- | --- |
| `clean` (the default) | A phrase at a time, white with a dark edge; it fades in |
| `karaoke` | The whole phrase, the word being said lit in the highlight colour |
| `word-pop` | One big word at a time, in capitals; each pops in |
| `build-up` | Words appear as they are said and stay until the phrase ends |
| `key-word` | A phrase at a time, its key word (a number, or the strongest word) lit |
| `boxed` | On a dark box, no edge; each phrase slides up |

Captions follow the words' own times when they come from speech (edits by text, automatic edits);
from an SRT file the words are spread over the cue by their length. **Your own style:**
`edit captions save "My style" --from word-pop --highlight #00E5FF --default` (or on the page); the
default style is the one new edits use. In an edit list, `"preset": "NAME"` on a `captions`
operation uses a style, and the fields the operation sets itself win; or set `style` (`phrase`,
`word`, `karaoke`, `build`), `reveal` (`none`, `fade`, `pop`, `rise`, `slide`), `keyword`, `upper`
and `highlight` directly.

## Transitions that match the content

The storyboard picks how each scene comes in from what its sentence does after the one before:
the opening fades in; a turn ("but", "instead", a problem answered, a comparison) wipes across; an
answer to a question, a result or a figure is revealed (a circle or a zoom); the next step pushes
on; a quotation settles in; the call to action comes forward. The style's own three transitions
come first; a turn, an answer and the ending may use another, because there the meaning matters
more. The storyboard says why for every scene.

## The sound layer

Whooshes, pops, clicks and hits where something moves, from the same sounds as motion videos
(the CC0 sounds in `assets/sfx`, or a synthesised kit). In motion videos the scene sounds were
already there; now they are also pushed down while the voice speaks. Edits by text and automatic
edits get a `sounds` operation: a pop when a visual comes in, a whoosh when b-roll cuts in or the
frame punches in, a hit where the opening hands over to the talk, never two within 0.35 s, all
under the voice (`--no-sounds`, or the switch on the Edit by text page). In an edit list:
`{"op":"sounds","cues":[{"time":1.2,"sound":"whoosh"}],"kit":"soft"}`.

## Perfect loops

`pnpm tempoloom media loop FILE [--crossfade 0.6]` makes a video loop with no seam: its end
crossfades into its opening (picture and sound), and the opening is taken off the front, so the
last frame leads straight into the first. `media loop-check FILE` measures the seam (the jump from
the last frame to the first, against an ordinary frame step). In an edit list: `{"op":"loop"}`.

## A product photo in motion

`pnpm tempoloom media product PHOTO [--move orbit|push|rise] [--title "TEXT"] [--shape 9:16]`. The
product is cut out of its background (a PNG with a transparent background is used as it is; other
photos need the media tools: `pnpm tempoloom media setup`, then `media download cutout`). It floats
in front of a backdrop of its own colours, turns a little in depth, casts a soft shadow, and a
band of light passes over it. Without a cut-out the photo becomes a card with the same depth,
light and shadow, and the result says so.

## Maps and routes

`pnpm tempoloom media map "هەولێر" "Istanbul" "Berlin" [--theme dark] [--no-route]`: the land and
borders around the places (Natural Earth, public domain), each place marked and named in the
words you gave, and the route drawn as it is travelled, a marker riding along. The region's cities
are known by their Kurdish, Arabic and English names, and big cities of the world too; any other
place is looked up once on OpenStreetMap (read-only) and remembered, or give it yourself:
`"Our shop@36.2,44.05"`. The built-in places are approximate, for drawing a map.

## Device mockups

`pnpm tempoloom media mockup SCREEN1.png [SCREEN2.png ...] [--device phone|tablet|laptop]
[--move float|tilt|slide]`: the screenshots inside a generic device (no brand's product) that
turns gently in depth, tilts up to face the viewer or slides in. Several screenshots follow one
another; one taller than the screen scrolls down while it shows; a wider one fills the screen's
height.
