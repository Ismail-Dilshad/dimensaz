# Styles and sound kits

No video has a fixed look and no video copies another. Each video's style is **generated
from zero** for it, trait by trait, steered by the brief, by what you said and by what the
brain learned from your verdicts. There are no named looks or examples to start from.

## How a style is made

A style is a set of traits: tone (light, dark, paper, tinted, brand colour), accent, surface
fill (solid, glass, gradient), border, depth (none, soft, hard offset, glow, puffy inset,
chunky lift), corner roundness, a backdrop (orbs, grid, dots, stripes, gradient, rings), fonts
for titles and numbers, weight, capitals and tracking, motion (curve, distance, scale, tilt),
check marks, avatars, transitions and sound (kit, pitch, brightness). For every video:

1. **The brief.** Words in the script nudge traits (night, code and tech lean dark; calm,
   premium and finance lean paper and serif; kids and fun lean round and puffy; bold lean hard
   shadows and capitals...). A dark brand background makes the style dark.
2. **You.** Your own words for the look (`"look": "calm paper, serif type"` in a request, or
   `--look` in the storyboard) and your feedback rules and preferences favour or avoid traits
   ("never dark" steers away from dark tones).
3. **Learning.** Every trait has a record in the brain (`pt-<trait>`, for example
   `pt-shadow-glow`). A video's traits are recorded with it; approving it raises them and
   rejecting it lowers them (`pnpm dimensaz brain verdict`). Approved traits come up far more
   often, rejected ones rarely. A style whose frames fail the contrast check is redesigned and
   its traits are marked down.
4. **Coherence.** The result is made to work: glass gets something behind it, hard shadows get
   a border, puffy surfaces get round corners, serif titles stay mixed case.
5. **Novelty.** The new style is compared with every style made before
   (`workspace/history/piece-styles.json`); anything too close is drawn again, so no two videos
   look the same.

The style gets a readable name ("Dark on rings, soft shadows, tight corners, grotesk,
springy") and is stored with the job, so a render is reproducible. The storyboard shows it and
why; running the storyboard again designs another one. `"pieceGenome": {...}` keeps an exact
earlier style: use it only when the user asks to repeat a look (a series, say); the storyboard
also uses it so the approved style is the one rendered.

### The whole frame

The generated style paints the whole frame, not just the pieces: the background colour and its
pattern (grid, dots, stripes, gradient, orbs or rings, at frame scale), the headline colour
and the highlighted words (both checked for contrast: text at least 7:1, highlights 3:1 and
distinct from the text), the headline font, weight, capitals and tracking (Latin-script lines;
Kurdish, Arabic and Persian keep their language's font), and the headline's motion curve and
strength. A dark style is dark from edge to edge; a paper style is paper with serif headlines.
This applies when the video has pieces and no director, reference style or explainer theme.

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
