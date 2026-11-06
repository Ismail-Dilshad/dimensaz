# Style Builder

Contents: parameters, how to interpret what the user says, color derivation rules, preset library, STYLE LOCK card format, non-Latin text.

## 1. Parameters of a style

Every style is the combination of these. The user can set any of them; you fill the rest.

| Parameter | Options (examples, not limits) |
|---|---|
| Background | any solid color or soft gradient; light, dark, or mid-tone; optional vignette |
| Texture | paper grain, film noise, brushed metal, concrete, canvas, glossy clean, fully flat |
| Grid | none, fine dashed grid, solid hairline grid, dot grid, cross-dot grid, blueprint grid, isometric grid, graph-paper (major + minor); plus strength: barely visible / subtle / visible |
| Background lines | count (default 2; 0-4), angle (default diagonal), color derived from palette, opacity 8-15% |
| Primary accent | any color; used for color blocks, key words, vector shapes |
| Secondary accent | optional second color, used sparingly (max ~10% of the frame) |
| Text colors | main headline color + accent word color + ghost-text color |
| Hero object style | photoreal 3D, matte clay, glass, chrome, neon tube, flat vector, halftone cutout, line art, pixel/voxel, isometric, paper-cut collage |
| Lighting | soft studio, hard directional, rim-lit, neon glow, golden hour, top-down flat, cinematic low-key |
| Typography | headline face (bold sans, condensed, geometric, mono, slab) + accent face (editorial italic serif, flowing script, none); uppercase or mixed case |
| Corner / shape language | organic blobs, sharp geometric, circles and arcs, brutalist blocks, none |
| Motion personality | springy and playful, smooth and premium, snappy and technical, slow and cinematic |

## 2. Interpreting the user

Turn natural wording into parameters. Examples:

- "blue color with white background and grid subtle" -> Background: clean white or very light cool white; Grid: subtle fine grid in pale blue-gray; Primary accent: a strong blue (suggest a hex such as #1F5FFF, offer to change); headline text: near-black navy; accent words in the blue.
- "black bg with grid subtle and red primary" -> Background: true black or near-black (#0A0A0B); Grid: subtle thin grid in dark gray (#1E1E22); Primary accent: red (#E5202E); headline text: white; accent words red; lines in dark gray-red at low opacity.
- A hex code or a color name overrides any suggestion. Use exactly what they give.
- A mood word ("luxury", "retro", "cyberpunk", "calm", "kids") maps to a preset or a blend; state which.
- A brand name or logo: use its colors if the user gives them or they are well known; otherwise ask for hex codes.
- If they upload a reference image, extract background, accent, grid and type feel from it and describe them back in the card.

When the user gives only a color ("I want green"), ask nothing: choose a background that makes it pop (green on off-white or green on charcoal), show the card, and offer the alternative in one line.

## 3. Color derivation rules (keep these consistent so every scene matches)

- **Background lines color**: take the background color and shift it 6-10% toward the accent hue (or toward gray for neutral palettes). Opacity 8-15%. They must stay "faint": visible only on a second look.
- **Grid color**: take the background and shift lightness by 6-10% (darker on light backgrounds, lighter on dark backgrounds); no color cast unless the user wants one.
- **Ghost typography**: the headline color at 6-12% opacity, or the accent at 10-15%.
- **Contrast**: headline text must have strong contrast against its direct background. If an accent color block holds text, choose white or near-black text, whichever passes.
- **60 / 30 / 10 rule**: ~60% background, ~30% neutrals and hero object, ~10% accent. A second accent only appears inside that 10%.
- **Hero object color**: keep it neutral or monochrome unless the user wants colorful heroes, so the accent stays special. Photoreal heroes may carry small accent-colored details.
- **Shadows**: tinted with the background hue, never pure black on light backgrounds; on dark backgrounds use subtle accent-colored glow instead.

## 4. Preset library (starting points; every one can be edited)

1. **Signature Editorial** - warm off-white paper texture, fine gray dashed grid, deep royal purple (#5B2BD6) accents, black + purple typography, editorial italic serif accents.
2. **Dark Technical Minimal** - charcoal/slate (#14181D), luminous grid, neon teal/cyan (#19E6D0) accents, faint glow, white + teal type.
3. **High-Contrast Academic** - pale cream/bone, thin cross-dot grid, terracotta/burnt orange (#C4552D) shapes, charcoal + orange type.
4. **Clean Blue on White** - pure white, subtle pale-blue-gray fine grid, vivid blue (#1F5FFF) accent, navy headline, crisp and corporate, springy-smooth motion.
5. **Black and Red Impact** - near-black (#0A0A0B), subtle dark-gray grid, red (#E5202E) accent, white headline, hard directional light, snappy motion.
6. **Midnight Gold Luxe** - deep navy-black, hairline gold grid, champagne gold (#D4AF37) accent, ivory headline, high-contrast serif accents, slow cinematic motion.
7. **Soft Pastel Friendly** - cream or pale peach, dot grid, coral + sky blue accents, rounded shapes, chunky sans type, playful springy motion.
8. **Neon Cyber Grid** - black-violet background, bright perspective grid, magenta + electric blue accents, glow, mono headline type.
9. **Blueprint** - deep blueprint blue (#12307A), white line grid (major + minor), white and pale-yellow accents, line-art heroes, technical mono type.
10. **Mono Brutalist** - concrete gray or white, solid hairline grid, single signal accent (orange or lime), huge condensed type, hard blocks.
11. **Nature Calm** - warm sand or sage-white, soft dot grid, forest green (#2F6B4F) accent, organic shapes, soft golden light, slow motion.

Offer 5-6 of these that suit the topic, not all of them every time.

## 5. STYLE LOCK card (show this, then paste it into every Stage 4 prompt)

```
STYLE LOCK - [style name]
Background: [color + hex], [texture], [vignette/gradient if any]
Grid: [type], [color + hex], [strength], [spacing]
Background lines: exactly [N] faint [angle] lines, [color + hex] at [opacity]%, drifting independently
Primary accent: [name + hex]   Secondary accent: [name + hex or none]
Text colors: headline [hex], accent words [hex], ghost text [hex @ opacity]
Typography: headline [face/style, case]; accent [face/style]
Hero object style: [e.g. photoreal 3D / clay / flat vector ...]
Lighting & shadows: [description]
Shape language: [description]
Motion personality: [description]
Format: 9:16 vertical, mobile safe zone respected
```

After showing it, ask: "Lock this, or change something?" Apply requested changes to the card and re-show only the changed lines.

## 6. Non-Latin text (Kurdish, Arabic, Persian, Hebrew, etc.)

Most image models render Arabic-script and other non-Latin text unreliably (broken joins, reversed order). When the narration language is non-Latin:
- Still write the on-image text in that language inside the prompt, with the exact words, and state "right-to-left, correctly connected letters" where relevant.
- Briefly warn the user that they may need to regenerate a few times, or add the text afterwards in an editor (the layout area is already reserved in the poster).
- Offer a fallback: keep the image prompt's typography area clean and supply the words separately as `TYPOGRAPHY TEXT`, so the user can overlay them in CapCut or Canva.
- Keep all non-text prompt content in English.
