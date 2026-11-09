# Piece styles, sound kits and composed pieces

Scene pieces never have a fixed look, and no video copies another. Each video gets a **new
design style**, bred for it. Its sounds are tuned to that style. Saved pieces are varied every
time they are used. The named styles and saved pieces are **examples** the system learns from
and starts from, not looks to reuse.

## How a new style is made

A style is a set of traits: tone (light, dark, paper, tinted, brand colour), accent,
surface fill (solid, glass, gradient), border, depth (none, soft, hard offset, glow, puffy
inset, chunky lift), corner roundness, a backdrop (orbs, grid, dots, stripes, gradient,
rings), fonts for titles and numbers, weight, capitals and tracking, motion (curve,
distance, scale, tilt), check marks, avatars, transitions and sound (kit, pitch,
brightness). For every video:

1. **Parents.** The examples are scored against the brief (mood words, genre, brand colours,
   your stated preferences, each example's approval record) and the best few become parents.
   Examples used for the last videos are marked down, so the starting point moves around.
2. **Breeding.** Traits are taken from the parents (the best-fitting one leads tone, colour
   and corners), then mutated: numbers drift and some traits switch to new values.
3. **Learning.** Every trait has a record in the brain (`pt-<trait>`, for example
   `pt-shadow-glow`). A video's traits are recorded with it; approving the video raises
   them and rejecting it lowers them (`pnpm dimensaz brain verdict`). Traits that keep being
   approved are chosen far more often, rejected ones rarely. "Never brutal" in your feedback
   removes that example as a parent and steers away from its signature traits.
4. **Coherence.** The result is made to work: glass gets something behind it, hard shadows get
   a border, puffy surfaces get round corners, serif titles stay mixed case.
5. **Novelty.** The new style is compared with every style made before
   (`workspace/history/piece-styles.json`) and with the examples. Anything too close is bred
   again, so no two videos look the same.

The style gets a readable name ("Dark on rings, soft shadows, tight corners, grotesk,
springy") and is stored with the job, so a render is reproducible. The storyboard shows it
and why; running the storyboard again designs another one.

- `"pieceStyle": "neon"` (or `--style neon` in the storyboard) means *start from that
  example*: it leads the breeding, and the result is still new.
- `"pieceGenome": {...}` keeps an exact earlier style. Use it only when the user asks to
  repeat a look (for example a series); the storyboard also uses it so the approved style is
  the one rendered.

### The whole frame

The bred style paints the whole frame, not just the pieces: the background colour and its
pattern (grid, dots, stripes, gradient, orbs or rings, at frame scale), the headline colour
and the highlighted words (both checked for contrast: text at least 7:1, highlights 3:1 and
distinct from the text), the headline font, weight, capitals and tracking (Latin-script lines;
Kurdish, Arabic and Persian keep their language's font), and the headline's motion curve and
strength. A dark style is dark from edge to edge; a paper style is paper with serif headlines.
This applies when the video has pieces and no director, reference style or explainer theme.

### Layouts

Where a piece's parts sit changes too. Each of these pieces has several layouts, all with
the same timing (so motion and sounds stay in step):

| Piece | Layouts |
| --- | --- |
| dashboard | `cards` (tiles and a chart), `hero` (one big number, a trend line, the rest in a strip), `list` (rows of label and value) |
| checklist | `rows`, `grid` (tiles), `stack` (staggered cards) |
| notifications | `stack`, `cascade` (a tilted pile), `banner` (big pills) |
| progress | `bars`, `rings`, `columns` |
| counter | `big`, `ring` (the number inside a filling ring), `split` (number, divider, caption) |
| chat | `bubbles`, `thread` (names and avatars, no bubbles) |
| avatars | `row`, `grid` (cards), `stack` (overlapping) |
| quote | `card`, `big` (no card, large words), `split` (the person beside their words) |
| chart (bar) | `vertical`, `horizontal` |
| tasks | people `bottom`, `top` or `side` |
| pricing | `columns`, `rows` |

Each video picks layouts from its style's seed; two pieces of the same kind in a video get
different layouts. The brain keeps a record for each (`pt-layout-<piece>-<layout>`), raised
by approvals and lowered by rejections, so layouts that work come back more often. The
storyboard shows each piece's layout. A piece can set its own with `"layout": "hero"`.

### The examples

| Example | Look | Motion | Sound | Suits |
| --- | --- | --- | --- | --- |
| `soft` | White cards, soft shadows, rounded corners | Springy | library | SaaS, product, friendly |
| `glass` | Frosted cards over blurred brand-colour orbs | Smooth | soft | Premium, AI, fintech |
| `neon` | Dark grid stage, glowing edges, grotesk caps | Snappy | digital | Tech, developers, night |
| `brutal` | Square, thick black borders, hard offset shadows | Fast, tilted | punchy | Bold, fashion, agency |
| `editorial` | Paper, hairlines, serif, no shadows | Slow fades | minimal | Luxury, finance, reports |
| `clay` | Puffy pastel surfaces, very round, rounded type | Bouncy | soft | Playful, kids, education |
| `outline` | Line-drawn surfaces on a dot grid | Precise | minimal | Technical, data |
| `pop` | Solid brand-colour cards with chunky edges | Big pop-ins | punchy | Consumer, retail, social |

`pnpm dimensaz pieces styles` lists them.

## Sound kits

| Kit | Sound |
| --- | --- |
| `library` | The CC0 recordings in `assets/sfx` |
| `soft` | Warm, rounded synth tones: gentle pops, soft clicks, airy whooshes, a bell chord |
| `digital` | Crisp square-wave blips and bit-crushed whooshes |
| `punchy` | Short, loud transients and low-end hits |
| `minimal` | Only transitions, clicks and the final chime, very quiet |

The synth kits are original sounds made with FFmpeg from formulas (no samples, no licences),
each in two pitch variants so repeated cues alternate. Every video's style also tunes its
sounds: one pitch and brightness for the whole video, with small steps between repeated cues. They are generated once into
`workspace/cache/sound-kits`. A request takes `"soundKit": "auto"` (the style's kit),
a kit name, or `"pieceSounds": "off"`. `pnpm dimensaz pieces sounds` lists them.

## Composed pieces

When no ready-made piece shows a sentence well, compose one from layers:

```json
{"kind": "compose", "layers": [
  {"type": "card", "x": 0.05, "y": 0.06, "w": 0.9, "h": 0.88, "in": {"from": "fade"}},
  {"type": "icon", "icon": "rocket", "x": 0.42, "y": 0.14, "w": 0.16, "fill": "primary", "color": "white", "in": {"at": 0.2, "from": "pop"}, "loop": {"kind": "float"}},
  {"type": "number", "value": 3, "suffix": "×", "x": 0.05, "y": 0.4, "w": 0.9, "align": "center", "size": 20, "color": "primary", "in": {"at": 0.4, "dur": 1.2, "from": "count"}},
  {"type": "text", "text": "faster launches", "x": 0.1, "y": 0.63, "w": 0.8, "align": "center", "color": "muted", "in": {"at": 1, "from": "up"}}
]}
```

- **Layer types:** `card`, `text`, `number`, `shape` (rect, circle, pill, ring, blob), `icon`
  (35 built-in line icons), `bar`, `line` (points), `image` (an asset), `avatar`.
- **Placement:** `x`, `y`, `w`, `h` are shares (0–1) of the piece's box; in right-to-left scenes
  the layout mirrors itself.
- **Colours:** `color` and `fill` are `primary`, `accent`, `text`, `muted`, `surface`,
  `background`, `white`, `black` or a hex code, so a composition follows the brand and the style.
- **Entrances** (`in`): `fade`, `up`, `down`, `left`, `right`, `scale`, `pop`, `spin`, `draw`
  (lines and icons), `type` (text), `count` (numbers), `grow` (bars), with `at` and `dur`.
- **Loops** keep holds alive once a layer is in: `float`, `pulse`, `spin`, `sway`, `blink`.
- **Sound:** each entrance has a fitting cue (pop, ticks while counting or typing, a whoosh
  for drawing); set `"sound"` in `in` to change it or `"none"` to mute it.

### Designed for a sentence

The storyboard designs new composed pieces itself when nothing ready-made fits a sentence
(see the [storyboard guide](storyboard.md)). Approving the video (`brain verdict JOB
approved`) saves them here as templates, and the brain learns them.

### Saving and reusing

A good composition becomes a template for later videos. A template is never reused as is:
every video varies its scale, timing, entrances, shapes, colours and idle motion.

```bash
pnpm dimensaz pieces save my-piece.json          # {name, description, tags, vars, piece}
pnpm dimensaz pieces templates                   # what is saved
```

Words and numbers in a template are `{{variables}}`; a request fills them:
`{"kind": "compose", "template": "stat-hero", "vars": {"value": 42, "suffix": "%", "label": "faster"}}`.
Saved pieces live in `assets/pieces`, the brain learns them (`pc-<name>`), and the storyboard
uses one when its tags fit a sentence. Starters: `stat-hero`, `icon-trio`, `hero-tagline`,
`growth-arrow`, `step-flow`, `badge-burst`.
