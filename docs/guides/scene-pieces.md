# Scene visuals

Every scene shows its sentence as the headline and a visual that shows what the sentence
says. There are no ready-made pieces, sample apps or example data: each visual is designed
from zero for its video, from layers, using only the sentence's own words and numbers.

## How a visual is designed

The designer (`src/engine/piece-designer.ts`) reads each sentence: what it means (a problem, a
reveal, a figure, a list, a change, a place, a quotation, a call to action), its key phrase, its
list, its numbers and a before→after turn. It picks a composition that suits that content and
builds it from layers, with icons that match the words.

| The sentence has | Compositions it can get |
| --- | --- |
| A problem or pressure ("drowning in messages, tasks and deadlines") | Tilted cards piling up with a pulsing warning |
| A name or a promise ("Meet Flowly, ...") | The key phrase landing on a card over sweeping shapes |
| A figure ("ship 40% faster", "$9 per month") | The number counting beside rising bars, inside an arc that draws to its share, or as a solid 3D figure |
| A change ("turn sunlight into power") | Two tiles with an arrow drawing from one to the other |
| A list ("speed, design and price") | Parts orbiting a centre, points along a drawn path, or a grid of tiles |
| The old way ("No more spreadsheets, lost emails...") | The old way crossed out beside the new way |
| Places ("Deliver to Erbil, Duhok and Sulaimani") | Pins dropping on an abstract map, joined by a route |
| A quotation | The quoted words typing onto a card under a big quotation mark |
| A call to action ("Start your free trial today") | A button with the words, a pulsing halo, a press and a check |
| A single idea | A big symbol with rings, a statement card, or its symbol as a 3D object or coin badge |

- **Nothing is invented.** Words on screen come from the sentence; a number is the sentence's
  number. When an icon is only a general mark, the storyboard says so.
- **Every video differs.** Arrangement, shapes, colours, entrances, timing and loops vary with
  the video, and scenes next to each other never share a composition.
- **The brain learns.** Each composition has a record (`pd-<name>`); `pnpm tempoloom brain
  verdict JOB approved|rejected` scores the ones the video used, and the designer favours
  what was approved.

See what the designer makes of a sentence (run again with another seed for another design):

```bash
pnpm tempoloom pieces design "Solar panels turn sunlight into power." --seed 1
```

## Where visuals come from in a video

- `pnpm tempoloom storyboard SCRIPT.txt` designs one for every sentence and writes them into
  `request.json` for approval ([storyboard](storyboard.md)).
- `video:create` designs them itself when a motion request has no `sceneVisuals`
  (`"scenePieces": "auto"`, the default). It never adds them over footage, a reference style,
  an explainer or a director; `"scenePieces": "off"` turns it off.
- The agent can write a visual's layers itself (below), for example to place the user's own
  product image.

## Following the voice-over

When a video has a voice-over with word timings (an exact alignment from ElevenLabs or
`--alignment`), each part of a visual enters as its words are spoken: "messages, tasks and
deadlines" bring in their three cards one by one, a number counts up and lands on the spoken
figure, "into power" lands when "power" is said. The designer marks the words each layer stands
for (`says`); layers without words (cards, lines, rings) arrive with the next layer that has
them, and opening layers stay where they were. Nothing enters too late to be seen. The sounds
of each layer move with it. Without word timings, visuals keep their own rhythm.

## Writing layers

```json
{"match": "words from the line", "piece": {"kind": "compose", "layers": [
  {"type": "card", "x": 0.05, "y": 0.1, "w": 0.9, "h": 0.7, "in": {"from": "scale"}},
  {"type": "icon", "icon": "sun", "x": 0.1, "y": 0.18, "w": 0.16, "fill": "accent", "color": "white", "in": {"at": 0.3, "from": "pop"}},
  {"type": "number", "value": 40, "suffix": "%", "x": 0.1, "y": 0.4, "w": 0.6, "size": 14, "in": {"at": 0.4, "dur": 1.2, "from": "count"}},
  {"type": "text", "text": "faster", "x": 0.1, "y": 0.62, "w": 0.8, "size": 5, "in": {"at": 0.9, "from": "up"}}
]}}
```

- Layer types: card, text, number, shape (rect, circle, pill, ring, blob), icon, bar, line
  (points, draws itself), image (an asset id), avatar, scene3d (below). `says` names the sentence's words a
  layer stands for, so it enters when they are spoken.
- A number's `digits` (latin, arabic, persian) follows the sentence's; the designer sets it.
- Positions and sizes are 0–1 of the visual's box; `size` is text size in hundredths of the box.
- Entrances (`in.from`): fade, up, down, left, right, scale, pop, draw, type, count, grow,
  spin, none, with `at` and `dur` in seconds and an optional `sound`.
- Loops after entering: float, pulse, spin, sway, blink.
- Colours: primary, accent, text, muted, surface, background, white, black or `#RRGGBB`; they
  follow the video's style ([styles](piece-styles.md)). Text is checked against what is under it.
- Common options: `placement` center|top|bottom, `size` 0.3–0.75 of the frame height, `delay`,
  `transition` (none, fade, wipe, push, zoom-through, mask-reveal, circle-reveal), `cursor`
  (a path of points that clicks), `direction` auto|ltr|rtl.

`pnpm tempoloom pieces layers` lists everything, including the icons. Check a request with
`pnpm tempoloom pieces check REQUEST.json`: every line should have a visual.

## Solid 3D

A `scene3d` layer is a real 3D object drawn on the GPU (three.js, WebGL): bevelled and lit by a
studio light (key, fill and rim, a reflection environment, filmic tone), casting a soft shadow
on an invisible floor. It comes in with the layer's entrance (`pop`, `spin`, `up`, `down`,
`fade`; text rises letter by letter in reading order), then keeps turning and floating gently
while the camera moves.

```json
{"type": "scene3d", "x": 0.04, "y": 0.04, "w": 0.92, "h": 0.56,
 "model": {"kind": "text", "text": "40%", "material": "auto", "camera": "orbit"},
 "in": {"at": 0.15, "dur": 0.9, "from": "pop"}}
```

- `model.kind`: `text` (up to 24 characters: a figure or a short word, in any script),
  `icon` (any icon, as rounded tubes) or `shape` (orb, blob, gem, coin, ring, capsule, cube,
  knot, badge with an `icon` on it, stack, arrow).
- `material`: `auto` follows the video's style (glass styles get glass, glow styles neon or
  candy, paper styles ceramic or matte, dark styles chrome or brushed); or glossy, matte, clay,
  glass, frosted, chrome, brushed, gold, ceramic, candy, neon. Letters and icons never get
  glass or a mirror finish from `auto`, which would hide their outline.
- `camera`: orbit, push, reveal, float or static. Colours: `fill` (or `color`), as for any
  layer; text is kept readable against what is under it.
- Letters are shaped with HarfBuzz from the video's own fonts (Latin in the style's display
  font, Kurdish, Arabic and Persian in the video's font), so joining, right-to-left order and
  figures (٤٠٪ keeps the sentence's own digits and reads as the headline shows it) are correct. A letter the
  font lacks falls back to the open fonts, never a box.
- The designer uses it in two compositions, `solid-figure` (the figure in 3D, the phrase below)
  and `solid-object` (the sentence's symbol as a 3D object or coin badge). They are one family,
  so a video gets a 3D moment rather than 3D everywhere; approving videos that use them makes
  them come up more often.
- GPU: every 3D layer shares one WebGL renderer. With a graphics card it is used
  (`TEMPOLOOM_GL=gpu` forces it); without one Chromium draws with its software renderer
  (`TEMPOLOOM_GL=software`), at about half a second a 1080-wide frame.

## Right-to-left languages

In Kurdish, Arabic and Persian scenes a visual mirrors itself: a layer at the start sits on the
right and moves the other way. Set `"direction": "ltr"` only for something left to right shown
inside the video.

## Sound

Every layer that lands makes its own sound (a pop, ticks while a number counts, a whoosh as a
line draws, a click where the cursor clicks), with a whoosh on each transition, all in the
style's sound kit and mixed into one bed (`"pieceSounds": "off"` turns it off). The same
timetable drives the animation and the sounds (`src/components/pieces/timing.ts`).
