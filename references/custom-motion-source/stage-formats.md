# Stage 4 and Stage 5 formats

Contents: Stage 4 per-scene format, Stage 4 rules, typography rules, Stage 5 per-scene format and timeline, Stage 5 rules.

## Stage 4 - per scene

```
[S01]

SCRIPT LINE:
"[exact narration sentence]"

TEXT-TO-IMAGE PROMPT:
[complete prompt, see below]

TYPOGRAPHY TEXT:
[1-4 words copied from the narration]

TYPOGRAPHY STYLE:
[which faces from the style lock, plus size/placement notes]
```

The TEXT-TO-IMAGE PROMPT must contain, in this order, as flowing descriptive text:
1. Format: "Vertical 9:16 poster composition, mobile safe zone."
2. The STYLE LOCK values restated: background color/texture, grid type and strength, exactly N faint background lines with their color, palette hexes, lighting, shape language. (Image tools are stateless; repeat everything.)
3. One dominant hero object (a physical metaphor for the sentence) in the locked hero style, with material, color and position.
4. Up to 2 supporting vector or collage accents, never more.
5. Depth: foreground, middle ground, background layers.
6. The typography words exactly as spelled, with face, scale, color and how they interact with the hero (see below).
7. Lighting and directional shadows per the lock.

### Rules
- One hero, max 2 accents, deliberate editorial asymmetry, nothing important outside the safe zone.
- Subtle grid elements present; the background line count equals the lock (never more).
- Vary hero object, camera angle and typography placement from scene to scene, keep style identical.
- Typography stays in the image. It is core to the composition. Never remove it.

### Typography rules
- 1-4 words, taken directly from the narration, never reworded.
- Main words: the headline face from the lock, oversized. Accent words: the accent face. Solid accent-color blocks and low-opacity ghost words are allowed when the lock includes them.
- Hero and text must interact: text partly behind the hero, hero overlapping text, oversized ghost word behind the hero, key word beside the hero, or word inside a color block.

Hero metaphor ideas (pick what fits the sentence, invent freely): brain, eye, chess piece, clock, hourglass, staircase, dominoes, rocket, mask, spider web, currency, camera, phone, lightbulb, statues, CRT screens, UI cards, charts, columns, silhouettes, anatomical objects, vintage hardware, keys, locks, doors, mirrors, magnets, scales, maps, compasses.

After the last scene say: Type "NEXT" to generate video motion prompts.

## Stage 5 - per scene

Default length is 6 seconds; if the user chose another length, scale the time ranges proportionally.

```
Scene [N]

SCRIPT LINE:
"[exact narration sentence]"

MOTION STYLE:
[e.g. 2.5D Mixed-Media Floating Grid / Surreal Cutout Collage / Kinetic Serif Staging / Flat Vector Pop / Neon Glow Tech - match the style lock]

BACKGROUND MOTION:
Exactly [N] soft translucent [angle] lines move slowly and independently behind everything.

0.0-0.5s - OPEN
Start from the Stage 4 composition. Subtle grid and environment movement. Background lines begin their slow drift.

0.5-3.5s - KINETIC BUILD
Hero: [specific entrance/emphasis: slide from above/below/diagonal, spring scale, restrained rotation, Z-axis move, floating 2.5D, staggered accents].
Typography: [masked reveal, staggered words, scale pop, tracking expansion, ghost-text drift, text emerging from behind hero, subtle vertical movement].
Vector accents: [click, bounce, rotate, expand, follow a path, small state change].
Strong ease-out deceleration, about 5-10% overshoot where fitting.

3.5-4.7s - MICRO-MOTION & HOLD
Gentle floating, tiny 3D rotation, subtle reflections, ambient shimmer, slow parallax, minor camera drift. Typography stays readable. Background lines keep drifting.

4.7-6.0s - OUTRO & TRANSITION
[designed transition: tracking expansion, vertical mask wipe, hero glides out, scale-out, shape wipe, camera push-through, match-cut-ready end frame]. Background lines continue beneath the transition.

CAMERA:
[static / subtle push-in / subtle pull-back / gentle Z-axis drift]

SFX:
[soft paper whooshes, UI clicks, tactile thuds, light air swells, subtle transition sounds - chosen to suit the style: glitchy blips for cyber, warm thuds for editorial, etc.]
```

### Rules
- Exactly the chosen duration. SFX only by default: no music, no generated voice-over (narration is recorded separately). If the user asked for music, add a MUSIC line.
- Preserve hero, typography, background, palette, accents, composition and style from the image. Do not redesign, replace words, add new text, or introduce unrelated objects.
- Never exceed the locked background line count.
- No handheld shake. Professional After Effects-style easing.
- Vary entrances and transitions between scenes so the video has rhythm, but make the end of each scene able to cut cleanly into the next.

After the final scene print the flow: S01 -> S02 -> S03 -> ...
