# Piece styles, sound kits and composed pieces

Scene pieces never have one fixed look. Every video's pieces are drawn in a **design style**,
sound in a **sound kit**, and when no ready-made piece fits a sentence the agent **composes a
new one**. All three are chosen automatically from the brief, the brand, the brain and the
recent videos, and you can ask for any of them.

## Design styles

A style is a whole design language: its own palette (built from your brand colours),
surfaces, corners, depth, type, check marks and avatars, motion character, a backdrop behind
the piece, transitions and a sound kit.

| Style | Look | Motion | Sound | Suits |
| --- | --- | --- | --- | --- |
| `soft` | White cards, soft shadows, rounded corners | Springy | library (CC0 recordings) | SaaS, product, friendly |
| `glass` | Frosted translucent cards over blurred brand-colour orbs | Smooth, unhurried | soft | Premium, AI, fintech |
| `neon` | Dark stage with a faint grid, glowing brand-colour edges, grotesk numbers, uppercase labels | Crisp snap | digital | Tech, developers, gaming, night |
| `brutal` | Square corners, thick black borders, hard offset shadows, uppercase type | Fast, tilted | punchy | Bold, fashion, agency |
| `editorial` | Paper surfaces, hairlines, no shadows, serif titles and numbers | Slow fades | minimal | Luxury, finance, calm, reports |
| `clay` | Puffy pastel surfaces with inner light, very round, rounded type | Elastic bounce | soft | Playful, kids, education |
| `outline` | Line-drawn surfaces on a dot grid, tracked uppercase labels | Precise, smooth | minimal | Technical, data, engineering |
| `pop` | Solid brand-colour cards with chunky 3D edges and yellow highlights | Big tilted pop-ins | punchy | Consumer, retail, social |

`pnpm dimensaz pieces styles` lists them. In a request: `"pieceStyle": "neon"` (or `"auto"`,
the default). One piece can differ from the rest with `"style": "brutal"` on that piece.

### How the style is chosen

With `"pieceStyle": "auto"` (and in `pnpm dimensaz storyboard`), each style is scored by:

- the words of the title and script against each style's mood ("calm premium finance" →
  editorial, "developer tool at night" → neon, "kids games" → clay);
- the genre (a SaaS promo leans soft, glass or outline; an app launch pop, clay or glass);
- the brand (a dark brand background favours dark styles);
- the brain: your preferences and rules that name a style ("use glass", "never brutal"), and
  each style's record (`ps-<style>`), which rises when a video in it is approved and falls when
  one is rejected (`pnpm dimensaz brain verdict`);
- recent videos (`workspace/history/piece-styles.json`): the last styles are marked down, so
  styles rotate instead of repeating.

The storyboard shows the chosen style, why, and the alternatives.

## Sound kits

| Kit | Sound |
| --- | --- |
| `library` | The CC0 recordings in `assets/sfx` |
| `soft` | Warm, rounded synth tones: gentle pops, soft clicks, airy whooshes, a bell chord |
| `digital` | Crisp square-wave blips and bit-crushed whooshes |
| `punchy` | Short, loud transients and low-end hits |
| `minimal` | Only transitions, clicks and the final chime, very quiet |

The synth kits are original sounds made with FFmpeg from formulas (no samples, no licences),
each in two pitch variants so repeated cues alternate. They are generated once into
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

### Saving and reusing

A good composition becomes a template for later videos:

```bash
pnpm dimensaz pieces save my-piece.json          # {name, description, tags, vars, piece}
pnpm dimensaz pieces templates                   # what is saved
```

Words and numbers in a template are `{{variables}}`; a request fills them:
`{"kind": "compose", "template": "stat-hero", "vars": {"value": 42, "suffix": "%", "label": "faster"}}`.
Saved pieces live in `assets/pieces`, the brain learns them (`pc-<name>`), and the storyboard
uses one when its tags fit a sentence. Starters: `stat-hero`, `icon-trio`, `hero-tagline`,
`growth-arrow`, `step-flow`, `badge-burst`.
