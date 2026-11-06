---
name: kurdish-text-animation-video
description: Create professional Kurdish Sorani-first kinetic typography and optional claymorphism motion-graphics MP4s from scripts, with RTL-safe shaping, scene planning, deterministic rendering, and visual QA.
---

# Kurdish Text Animation Video — Production Skill v2.0

## Mission
Turn an exact user-supplied script into a beautiful, coherent, short-form motion-design MP4. Prioritize Kurdish Sorani and the bundled `assets/Rabar_021.ttf` font. Support Arabic, Persian, and LTR scripts. Use clean typography as the foundation; add tasteful visual assets when they materially communicate the message. Never require visuals or web assets for an effective text-only video.

## Trigger
Use when asked to animate a script as kinetic typography, a text reel, TikTok/Reels/Shorts motion graphic, SaaS motion design, or animated promotional text. If the user requests a storyboard/prompt only, provide that rather than rendering an MP4.

## Inputs and defaults
- **Script** (required): preserve visible characters, punctuation, diacritics, and wording exactly. Markdown `**...**` is a styling directive, not visible text; it marks a primary phrase. `[[...]]` optionally forces emphasis. Do not silently fix or translate wording.
- **Font:** bundled `assets/Rabar_021.ttf` is the default and primary typeface. Do not replace it without explicit permission. Additional fonts are permitted for Latin/numerals or secondary UI text only if Kurdish glyph support is confirmed and stylistically compatible. Never expose or redistribute the font separately; keep it as an internal render asset.
- **Format:** 1080×1920, 9:16, 30 fps, MP4 H.264 yuv420p; optional 1080×1080 or 1920×1080; optionally 60 fps.
- **Background:** `white-grid` default; alternatives `black-grid`, `solid`, `soft-gradient`, `paper`, `studio`.
- **Palette:** primary `#1F5EFF`, dark ink `#111318`, white `#FFFFFF`, muted `#64748B`. Secondary colors must harmonize; use sparingly. Keep sufficient contrast.
- **Audio:** silent by default. Optional supplied narration/music, with user-authorized sourcing. Do not assume internet access, stock licenses, or TTS availability.
- **Motion:** `auto-directed` default; explicit style overrides supported. Default pacing optimized for reading, not a fixed 30–45-second duration.
- **Visual mode:** `typography-only` by default; `auto-supporting-visuals` or `claymorphism` on request. If user requests optional footage or visuals, prefer purposeful animated stills and icons to unrelated footage.
- **CTA/logo:** only if provided or requested. Never invent contact information, prices, claims, or brand marks.
Ask only for missing essential script or truly required input. The bundled font means a separate font upload is not required.

## Stage 1 — Parse and plan
1. Detect text direction per paragraph and isolate mixed LTR tokens (URLs, English brand names, numerals) with Unicode bidi isolation; retain their exact visible order.
2. Split paragraphs into scenes without merging paragraphs. Split long paragraphs into sequential scenes at natural sentence/clause boundaries while preserving the complete original text and punctuation. Avoid arbitrary 12-word hard caps; fit by measured width and reading time. Preserve scene order.
3. Build a scene manifest with: `id`, `exact_text`, `direction`, `role` (hook/problem/explanation/proof/benefit/CTA), `layout`, `animation`, `emphasis_spans`, `visual_asset`, `duration`, `start`, `end`.
4. Treat user bold as primary; normal text may receive 1–3 emphasized semantic phrases. Do not change the source string to insert visible marker characters. List auto-selected emphasis phrases in the delivery notes.
5. Select a consistent visual language: limited palette, same corner radii, lighting, shadows, grid density, and easing family throughout. Rotate animation patterns meaningfully, not randomly.
6. For scripts with voiceover, time scenes from narration/transcript timestamps when available. Without timing metadata, estimate using actual script reading load and allow the user to specify a target length. Never compress so much that the text becomes unreadable.

## Stage 2 — Motion library
Implement reusable presets with parameterized durations and easing, all deterministic at time `t`:

**Text reveal modes**
- `center-one-by-one`: one large word at a time, anchored to a fixed central baseline; crossfade/scale between words, no cumulative layout shift.
- `sentence-build`: reveal each word in natural reading order while earlier words remain in place; final sentence holds before exiting.
- `sentence-by-sentence`: each complete sentence enters, holds, and exits; preserve paragraph boundaries.
- `line-stack`: successive phrases form a deliberate vertically stacked composition.
- `type-composition`: mix large headline, smaller support line, accent pill, and separators with balanced visual hierarchy.
- `keyword-punch`: normal sentence remains readable; emphasized keyword scales/colors/glows briefly.
- `text-highlighter`: underline, marker stroke, rounded highlight background, or wipe reveals across a phrase, with correct RTL direction.
- `mask-wipe`: reveal from a clipped mask, RTL-aware.
- `saas-motion`: text accompanied by floating interface cards, counters, chips, chart lines, and tasteful depth/parallax.

**Motion variants**
- `bounce-up`: vertical entry with restrained back-out overshoot.
- `bounce-slide-up`: horizontal/vertical translation plus soft overshoot.
- `bouncy-slide-glow`: bounce-slide with a very subtle accent glow that peaks then fades; avoid blurry text.
- `soft-rise`: fade, gentle translateY, minimal scale.
- `blur-focus`: brief entry blur to sharp, with text sharp during hold.
- `pop-scale`: 0.92→1.03→1.00 with restrained spring.
- `slide-directional`: respect RTL reading direction and logical entrance.
- `staggered-phrase`: stagger grouped semantic phrases, not necessarily every word.

**Selection logic**
- Hook: `center-one-by-one`, `keyword-punch`, or `pop-scale`.
- Explanation: `sentence-build`, `sentence-by-sentence`, `line-stack`.
- Comparison: two aligned text panels or before/after cards, never falsely implying factual proof.
- Benefits/numbers: `saas-motion` or `type-composition`.
- CTA: focused headline, restrained accent, clean final hold.
Avoid more than two dominant entrance families in a short video. Use at most one major hero effect per scene. Provide `style=...` to force a preset; `auto-directed` chooses deliberately.

## Stage 3 — Visual assets and claymorphism
Only generate or fetch visuals if requested or if visual mode explicitly allows them. Prefer user assets, then legally reusable/licensed assets with recorded attribution and usage terms, then generated originals when an image-generation tool is available. Do not assume image-generation or internet tools exist. If unavailable, create simple SVG/CSS/Canvas vector graphics or fall back to text-only and disclose it.

Claymorphism art direction: original soft rounded matte-clay 3D-like objects, subtle ambient occlusion, diffuse studio lighting, blue accent palette, simple silhouette, generous whitespace, no crowded scenes. Relevant icon motifs: megaphone, phone, shopping bag, chart, cursor, message bubble, search, link, sparkle. Never create a generic random object unrelated to the text.

Animated still techniques: layered parallax, 2.5D drift, gentle floating/rotation (1–3°), soft scale (1.00–1.04), depth shadows, masked reveals, slow camera movement. Do not present a still as real video footage. Avoid unlicensed logos, watermarked images, recognizable copyrighted characters, or false endorsements. Keep text the visual priority.

## Stage 4 — RTL typography and layout correctness
- Use Rabar 021 for Kurdish text, loaded with `@font-face`; await `document.fonts.load(...)` and `document.fonts.ready`.
- Use browser-native text shaping. **Do not split Arabic-script words into individual letter spans**, which breaks contextual shaping. Word spans are acceptable only after testing ligatures and spaces; prefer grouped text runs and mask-based reveals when joining/shaping could break. Keep real whitespace and avoid CSS letter-spacing on Arabic script.
- Do not apply `dir=rtl` to the whole HTML document. Keep viewport LTR; apply `direction:rtl`, `unicode-bidi:plaintext` or isolation as appropriate to text blocks. Set fixed scene coordinates and width for centering.
- For sentence-build, use correctly ordered visual/DOM runs and bidi isolation; test mixed numbers, punctuation, emoji, and English tokens.
- Avoid fixed `word-spacing:0.14em` and fixed `line-height:1.75` as universal defaults. Start with `line-height:1.25–1.5`, normal word spacing, adjust by measured font metrics. Baseline font size ~86–108px at 1080 width, CTA ~110–128px; responsive fit to text and available space. Keep a minimum safe margin of 8% width and 10% height (unless explicit full-bleed artwork). Text width ~84% max.
- Wrap by measured browser layout; avoid orphan single words where possible. Scale down only to a sensible minimum, otherwise create another scene.
- Check Kurdish glyphs `ڕ ڵ ۆ ێ ە` and Arabic/Persian punctuation.

## Stage 5 — Timing and transitions
Use a timeline model, not uncontrolled CSS animations:
- Typical intro 0.20–0.35s; entrance 0.35–0.65s; stagger 0.10–0.22s per word (sentence-build only); hold depends on visible word count, typically 1.0–2.4s; exit 0.30–0.50s.
- For center-one-by-one, each word must stay long enough to read; avoid rapid flashing.
- `duration(scene) = intro + reveal_sequence + readable_hold + exit`; use exact frame counts to avoid fractional drift. Apply time scaling mainly to holds and gaps, preserving a readability floor.
- No accidental overlap of outgoing and incoming scenes. Intentional crossfades are allowed if legible and clean.
- Use smooth easing (`cubic-bezier`, back-out, or analytically computed spring); limit bounce amplitude. Respect reduced-motion requests by substituting gentle fades.
- Animate backgrounds slowly: white grid on white, 2px lines at ~0.07–0.10 alpha, 90px cells; oversized inset at least 200px and transform only. Use a subtle edge vignette. Black grid analogous. Optional 8–14px top progress bar, synchronized to global time.

## Stage 6 — Deterministic render pipeline
1. Create a project directory containing a single `index.html`, scene manifest, approved visual assets, and a **local rendering copy** of the bundled font. The user-facing artifact is the MP4, not the font.
2. HTML exposes `window.render(t)` and `window.TOTAL`. `render(t)` must be idempotent: same `t` yields identical pixels, independent of prior calls. No CSS keyframe animation, setTimeout, random unseeded values, or clock-dependent state.
3. Prefer Playwright Chromium at the target viewport/deviceScaleFactor=1; disable motion preferences if relevant, wait for fonts and images to load. Test 2–3 representative frames before bulk rendering; inspect an RTL sentence, mixed-script line, and complex composition.
4. Render frames sequentially at `t=i/FPS` for `i=0..ceil(TOTAL*FPS)-1`. PNG preferred for crisp typography; JPEG quality ≥95 permitted for performance. Render to a numbered sequence and check for missing frames. Avoid writing 1000+ huge PNGs if storage is limited: pipe raw frames to ffmpeg when feasible.
5. Encode with `ffmpeg -framerate 30 -i frame_%06d.png -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart output.mp4` (substitute actual FPS). Use consistent color range and proper scaling. Audio, if provided, must be mixed/muxed with correct stream mapping and duration; do not truncate narration without permission.
6. Validate with `ffprobe` (duration, width, height, frame rate, codecs, audio), sample beginning/middle/end frames and all transitions, and inspect at least one extracted frame from the final MP4.
7. If rendering fails, report the blocker rather than claiming an MP4 exists.

## Quality gates
- **Text fidelity:** compare normalized display text against input after removing only styling delimiters; preserve all meaningful Unicode code points and punctuation. Document any deliberate line breaks.
- **RTL:** no reversed words, broken joins, mirrored digits, mixed-script reorder, clipping, or horizontal shifts.
- **Visual:** font correct, consistent hierarchy, contrast, aligned layouts, safe margins, tasteful effects, no collisions or invisible text.
- **Timing:** each scene readable, transitions complete, audio synced, no dropped/duplicated frames.
- **Assets:** permission/license provenance known for fetched media; generated assets are original; no unwanted watermark.
- **Delivery:** verify output exists and is playable before linking.

## Output
Provide the MP4 link, aspect ratio, resolution, fps, and exact duration. Briefly summarize chosen motion presets, highlighted keywords, visual mode, and palette. Offer targeted edits such as black-grid, alternate ratio, narration sync, softer motion, logo, or CTA. When requested, provide scene manifest and editable HTML separately, but do not expose bundled font as a standalone downloadable file.

## Customization
```yaml
brand_name: null
logo_file: null
default_cta: null
primary_color: '#1F5EFF'
background: white-grid
font: assets/Rabar_021.ttf
motion_style: auto-directed
visual_mode: typography-only
ratio: '9:16'
fps: 30
extra_rules: []
```

## Example user requests
- "Animate this Kurdish Sorani script with sentence-build and bounce-slide-glow on a white grid."
- "Use center-one-by-one for the hook, SaaS cards for the benefits, and a clean CTA end card."
- "Make a 20-second 9:16 claymorphism motion reel with Rabar 021 and my voiceover."
