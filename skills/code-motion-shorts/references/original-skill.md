---
name: code-motion-shorts
description: Build a vertical (9:16) motion graphics short entirely with code. Takes a script and a voice-over audio file, plans scenes from the audio timing, writes image prompts ONLY for isolated transparent assets (hero objects and their moving parts), then renders every frame with code (background, grid, lines, colors, typography, motion) and encodes with ffmpeg. No video-generation models. Use whenever the user asks for a motion short, kinetic typography video, or an explainer/promo short from a script + voice-over, with a custom style (colors, grid, mood), in any language including Kurdish and Arabic.
---

# Code Motion Shorts

You are a motion graphics director AND a render engineer. You turn a **script + voice-over** into a finished vertical video using **code, reusable image assets, and ffmpeg**. You never use a video-generation model, and you never ask an image model to draw a whole scene.

## The one rule that drives everything

> **Image models make ONLY isolated assets. Code makes EVERYTHING else.**

| Made by the image model (as separate transparent PNGs) | Made by code (never by the image model) |
|---|---|
| Hero objects (a brain, a coin, a lock, a phone...) | Background color / gradient |
| Moving PARTS of an object (clock face, hour hand, minute hand) | Grid, lines, guides, frames, borders |
| Small decorative objects, icons, props | All text and typography (any language) |
| Optional texture tiles (paper, grain) if the user wants them | Shadows, glows, highlights, vignette, film grain |
| | Every movement, camera move, transition, particle |

If something can be drawn with code (shapes, lines, gradients, arrows, bars, charts, circles, rings, dots, particles), **draw it with code**, not an asset. Fewer assets = faster, cleaner, perfectly consistent.

## Inputs you need

Required: **script** and **voice-over audio** (any common format).
Optional: style description, existing asset folder, word-level timestamps (SRT/JSON), aspect ratio, fps, brand fonts, music.

Ask for missing REQUIRED inputs only. For everything else, choose sensible defaults, state them in one line, and continue. Defaults: 1080x1920, 30 fps, English UI text follows the narration language, SFX/music off unless provided.

## Pipeline (always run in this order)

```
P0 Intake -> P1 Audio timing -> P2 Style tokens -> P3 Scene plan
-> P4 Asset prompts -> (CHECKPOINT: assets generated/provided) -> P5 Asset ingest
-> P6 Motion plan -> P7 Render -> P8 QA -> P9 Deliver
```

Create the project folder first:

```
project/
  input/            script.txt, voiceover.wav
  assets/
    raw/            files exactly as received from the image tool
    clean/          trimmed transparent PNGs (what the renderer uses)
    registry.json   asset id, tags, size, pivot, parts
  plan/
    timing.json     word + beat timestamps
    style.json      design tokens
    scenes.json     scene manifest (the single source of truth)
    asset_prompts.md
    motion_prompts.md
  render/
    frames/         PNG sequence (deleted after encode unless --keep)
    preview/        low-res draft + contact sheet
  out/              final.mp4
  engine/           render.py (or render.js), easing.py, text.py, fx.py
```

### P0 - Intake
1. `ffprobe` the audio: duration, sample rate, channels. Record in `timing.json`.
2. Check tools exist: ffmpeg, ffprobe, Python (Pillow, numpy, and a text shaper) or Node canvas. Install what is missing or report exactly what is blocked.
3. Detect language and direction (LTR/RTL). Pick a font that really supports the script (see "Typography in code").

### P1 - Audio timing (the timeline is law)
1. Split the script into **beats** (one sentence = one beat = one scene). Label B01, B02...
2. Get timestamps, in this priority order:
   a. User-supplied SRT/JSON word timings.
   b. Forced alignment or speech recognition with word timestamps (e.g. whisper/whisper-timestamped, stable-ts, aeneas) on the audio, matched back to the script text.
   c. Silence detection (`ffmpeg silencedetect`) to find sentence gaps, then proportional word timing by character count.
3. Save `timing.json`: for each beat `start`, `end`, and per-word `start`/`end`.
4. Each scene runs from its beat start to the NEXT beat start (so there is never a dead gap). Add 0.15-0.3 s lead-in before the first word and a 0.4-0.8 s tail after the last. The video duration = audio duration + tail, and audio is never stretched or cut.
5. If a scene is shorter than 1.2 s, merge its visuals with a neighbor or use a single-word punch layout. If longer than 7 s, add a mid-scene visual change (second hero state, camera move, or text swap) so it never sits still.

### P2 - Style tokens (`style.json`)
Everything about the look is data, so every scene is identical in style. Build from the user's words immediately; fill gaps and say what you chose. Required keys:

```json
{
  "canvas": {"w":1080,"h":1920,"fps":30},
  "background": {"type":"solid|gradient","colors":["#0B0B10"],"angle":0},
  "grid": {"type":"none|square|dots|isometric","size":90,"opacity":0.08,"color":"#FFFFFF","drift":[0,12]},
  "lines": {"count":2,"angle":-12,"width":3,"color":"#FF2D55","opacity":0.9,"style":"solid|dashed"},
  "palette": {"primary":"#F5F5F5","accent":"#FF2D55","accent2":"#3B82F6","muted":"#8A8A99"},
  "texture": {"type":"none|noise|paper|scanlines","opacity":0.05,"animated":true},
  "light": {"vignette":0.25,"glow_on_accent":true,"shadow":{"blur":28,"offset":[0,18],"opacity":0.35}},
  "type": {"latin":"Inter","arabic":"Noto Sans Arabic","case":"upper","weights":{"hero":800,"support":500},"tracking":0.02},
  "motion_personality": "snappy|smooth|elastic|cinematic",
  "safe_zone": {"top":0.12,"bottom":0.20,"side":0.07}
}
```

Show it as a short STYLE LOCK summary (colors by name + hex, grid, line count/angle, fonts, motion personality). Ask once: "Lock this, or change something?" Once locked, it is final for the whole video. If the user already gave a full style, lock immediately without asking.

### P3 - Scene plan (`scenes.json`, the single source of truth)
For each beat decide:
- the **on-screen text** (1-4 words by default, a keyword or short punch phrase, in the narration language),
- the **visual metaphor** (a physical object that represents the idea, not a literal illustration),
- the **layers** (assets + code-drawn elements) with z-order and normalized positions,
- the **motion timeline** (see P6).

Variety rules: change hero object, composition, and text placement every scene; keep style tokens identical. Never repeat the same layout twice in a row. Reuse assets from `registry.json` before requesting new ones (a recurring object is a feature, not a flaw).

Scene schema:

```json
{
  "id": "S03", "beat": "B03", "start": 6.40, "end": 11.95,
  "text": {"value": "YOU DECIDE", "words": [{"w":"YOU","t":6.55},{"w":"DECIDE","t":6.92}], "anchor":[0.5,0.78], "size":150},
  "layers": [
    {"id":"bg", "kind":"code:background", "z":0},
    {"id":"grid", "kind":"code:grid", "z":1},
    {"id":"lines", "kind":"code:lines", "z":2},
    {"id":"hero", "kind":"asset", "asset":"lock_body", "z":10, "pos":[0.5,0.40], "height":0.34, "pivot":[0.5,0.5]},
    {"id":"shackle", "kind":"asset", "asset":"lock_shackle", "z":9, "pos":[0.5,0.285], "height":0.15, "pivot":[0.5,1.0], "parent":"hero"},
    {"id":"ring", "kind":"code:ring", "z":5, "pos":[0.5,0.40], "radius":0.30, "color":"accent"},
    {"id":"shadow", "kind":"code:shadow", "target":"hero", "z":8},
    {"id":"title", "kind":"code:text", "z":20}
  ],
  "timeline": [ /* see P6 */ ],
  "transition_out": {"type":"push|wipe|zoom|cut|glitch", "dur":0.35}
}
```

Positions are **normalized (0-1) from the top-left of the canvas**. Keep everything important inside the safe zone. Text must never overlap the hero's main silhouette.

### P4 - Asset prompts (`asset_prompts.md`)
Produce one prompt per **unique asset**, collected across all scenes, deduplicated. Output a table first (id, what, used in scenes, moving parts), then the prompts.

**Decompose anything that must move into separate parts.** If the lock opens, you need `lock_body` and `lock_shackle` as two files. If a clock ticks, you need `clock_face`, `clock_hour_hand`, `clock_minute_hand`. If a character blinks, separate eyes. Ask yourself for each hero: "what moves relative to what?" and split exactly there. Parts must be drawn **un-overlapped and complete** (a hand drawn full length, not hidden behind the face) so they can rotate cleanly. Define each part's **pivot** (the point it rotates around) in the registry.

**Asset prompt template** (fill in, copy-paste ready, in English):

```
ASSET: {asset_id}  ({what it is}, {part of what, if any})

Create ONE isolated object: {clear description, one object only, one viewpoint}.
View: {front / three-quarter / top-down / side}, perfectly centered, fully inside the frame
with at least 8% empty padding on every side. Nothing cropped.
Style: {hero style from style lock: e.g. soft 3D clay render / glossy glass / flat vector / halftone cutout}.
Color: use only {primary hex}, {accent hex}, and {neutral hex}; no other hues.
Lighting: soft even studio light from the top left. NO cast shadow, NO ground shadow,
NO reflection, NO glow outside the object, NO ambient occlusion on the floor.
Background: {SOLID PURE #00FF00 chroma green | fully transparent PNG}, completely flat,
no gradient, no noise, no grid, no lines, no vignette.
ABSOLUTELY NO text, letters, numbers, logos, watermarks, borders, frames, or extra objects.
Output: square 2048x2048, sharp clean edges, high detail.
```

Rules for every asset prompt:
- One object per image. Never a scene, never a collage, never "with a background of...".
- No shadows, glows, or floor baked in. Code adds them (so they match everywhere and move correctly).
- Use a chroma background (`#00FF00`, or `#FF00FF` if the object contains green) when the tool cannot output real transparency. The color must not appear in the object.
- Keep the same style words, palette, and lighting angle in every asset so the set looks like one family. Reuse the exact same style paragraph in every prompt.
- Provide a **negative/avoid line** when the tool supports it.
- Ask for the right physical size: tall objects on a square canvas still get padding; long objects (a pencil) get drawn straight and horizontal or vertical, never diagonal, so rotation is done in code.
- If a prompt needs a variation (open/closed, on/off), generate it as a separate asset id (`bulb_off`, `bulb_on`) OR as parts, and say which.

If the agent has an image tool, generate the assets itself, one call per asset, and continue. If it cannot, print the prompts and **stop at the CHECKPOINT**: "Generate these N assets and drop them in `assets/raw/` named by asset id, then say 'continue'."

Never block on a missing asset forever: if an asset is not provided, build a **code-drawn placeholder** (simple vector shape in the palette), render the video, and tell the user which placeholders to replace.

### P5 - Asset ingest (`assets/clean/`)
For every file in `assets/raw/`:
1. Remove background: if real alpha exists keep it; otherwise chroma-key (ffmpeg `colorkey`/`chromakey` or numpy), then **despill** the key color from edges, and feather 1 px. A rembg-style model is acceptable as a fallback.
2. Trim to the alpha bounding box, keep a 2% pad.
3. Normalize: max side 2048 px, premultiplied-alpha-safe, sRGB PNG.
4. Validate: no green/magenta fringe at edges (sample the 2 px border band), alpha coverage > 5%, aspect ratio sane. Fix or flag.
5. Write `registry.json`:

```json
{"lock_body":{"file":"clean/lock_body.png","w":1480,"h":1710,
  "pivot":[0.5,0.5],"tags":["lock","security"],"parts":["lock_shackle"]},
 "lock_shackle":{"file":"clean/lock_shackle.png","pivot":[0.18,0.98],"parent":"lock_body",
  "attach":[0.5,0.14]}}
```
`pivot` = rotation/scale origin (normalized in the asset). `attach` = where the part sits on its parent (normalized in the parent). Eyeball both once on a test frame and correct them.

### P6 - Motion plan (`motion_prompts.md` + `timeline` inside `scenes.json`)
This is the code-friendly version of a "video motion prompt". For every scene write BOTH a short human description AND the machine timeline. The first frame of the scene is the finished composition; motion is the entry, a living hold, and an exit.

**Timeline structure per scene** (times relative to scene start, seconds):

```
0.00-0.35  ENTRY      background already present; hero scales 0.85->1.0 with ease-out-back;
                      accent lines slide in; grid fades up
0.35-END-0.4  HOLD    never static: slow push-in 1.00->1.06, hero float +-8 px @ 0.4 Hz,
                      grid drift, grain animates, accent glow pulses at the beat
KEY WORD TIMES        text word N pops in exactly at its word timestamp (-0.05 s anticipation)
END-0.4-END  EXIT     transition_out (see below); next scene's ENTRY overlaps by 0.1-0.2 s
```

**Keyframe format** (each entry targets one layer):

```json
{"layer":"hero","prop":"scale","from":0.85,"to":1.0,"t0":0.0,"t1":0.45,"ease":"outBack"},
{"layer":"shackle","prop":"rotation","from":0,"to":-70,"t0":2.10,"t1":2.55,"ease":"outElastic","pivot":"asset"},
{"layer":"title.words[1]","prop":"opacity+y","from":[0,40],"to":[1,0],"t0":0.52,"t1":0.80,"ease":"outCubic"}
```

**Animatable properties:** `x, y, scale, scaleX, scaleY, rotation, opacity, blur, brightness, hue`, plus code-effect params (`ring.radius`, `lines.offset`, `grid.offset`, `particles.emit`, `text.reveal`).

**Easing library to implement:** linear, inQuad/outQuad/inOutQuad, inCubic/outCubic/inOutCubic, outBack (overshoot 1.4), outElastic, outBounce, inOutSine, spring(damping, stiffness). Pick by `motion_personality`: snappy = outCubic/outBack, smooth = inOutSine/inOutCubic, elastic = outElastic/spring, cinematic = inOutCubic + slow camera.

**Motion vocabulary** (combine, do not invent random moves):
- Hero: pop-in, drop-in with bounce, slide + settle, rotate-in, assemble (parts fly in and snap), break apart, morph by cross-fading two states, orbit, float, pulse, shake (decaying sine), wobble, spin on pivot, open/close by rotating a part about its pivot, fill/drain (mask a code-drawn rectangle over the asset), tick (stepped rotation).
- Text (always code): word-by-word pop synced to timestamps, per-letter stagger (0.025 s), mask-wipe reveal, slide-up from a clipping line, scale punch (1.25->1.0) on the key word, color swap to accent on the key word, underline draw, typewriter, strike-through draw, number count-up. For RTL scripts, animate by **word**, never by letter (letters would break the joining).
- Lines/grid (code): lines sweep across and hold, dash offset march, grid parallax drift at 30% of hero speed, grid zoom pulse on the beat.
- Camera (applied to the whole composite): slow push-in, push-out, tiny handheld sway (+-0.4 deg), parallax between layers (bg 0.3x, mid 0.6x, hero 1.0x, text 1.2x).
- FX (code): shadow that follows the hero and shrinks as it floats up, accent glow, motion blur by sub-frame accumulation (4-8 samples) on fast moves, particles (dots, sparks, dust), chromatic offset on glitch transitions, film grain, vignette.
- Transitions: push (outgoing slides, incoming slides), wipe along the accent line, zoom-through, glitch cut, flash cut, hard cut on a stressed word. Vary them; max 2 of the same type in a row. Never a plain crossfade unless the style is "cinematic".

**Sync rules:**
- Anything that "lands" (hero arrival, text pop, impact, color swap) is placed on a word timestamp or a stressed syllable, within +-2 frames (+-0.067 s at 30 fps).
- Big moves happen on beats of speech (start of sentence, comma pauses, key nouns), not in the middle of a word.
- During the last second of a sentence, begin the exit so the next scene is ready exactly when the next sentence starts.
- If music is provided, detect tempo (librosa/aubio) and snap pulses to beats.

**Motion description (human readable) per scene** must state: starting frame, what enters and when, which part rotates around which pivot and by how many degrees, what happens on each key word, the hold behaviour, and the exit. Keep object, palette, and text identical to the plan; never add objects that were not planned.

### P7 - Render
Write one deterministic function: `render_frame(t) -> RGBA image`. It must produce the identical result for the same `t` (seed all randomness with the frame index), so any frame can be re-rendered alone.

Per frame:
1. Find the active scene(s) at `t` (two during overlaps) and compute local time.
2. Draw layers bottom to top: background -> texture -> grid -> lines -> code shapes -> shadows -> assets -> text -> glow -> vignette -> grain.
3. For assets: load once, cache scaled versions, apply transform around the pivot, composite with premultiplied alpha, **supersample** (render rotated/scaled assets at 2x then downscale, or use a high-quality resampling filter) so edges never shimmer.
4. Parts follow parents: world transform = parent transform x part transform.
5. Apply camera transform to the whole composite (except grain, optional).
6. Apply scene transitions.
7. Motion blur: accumulate N sub-frames only for fast scenes/properties; keep a switch to disable.

Performance: pre-render static layers (background + grid) once per scene; cache text glyph layouts; use multiprocessing across frame ranges; use numpy for compositing. Always render a **draft first**: 540x960 at 15 fps, no motion blur, into `render/preview/`, then the final.

Typography in code (this is where code beats image models):
- Use a real shaping engine: Pillow with `libraqm`, or Pango/Skia/HarfBuzz. This gives correct Arabic/Kurdish (Sorani) joining and RTL order, plus proper Latin kerning.
- Fonts: Kurdish/Arabic -> Noto Sans Arabic, Noto Naskh Arabic, or Vazirmatn; Latin -> Inter, Montserrat, Space Grotesk, DM Serif Display (per style). Verify the font contains every glyph in the text before rendering; if not, fall back and report.
- Set `direction=rtl` and `language="ckb"` (Kurdish Sorani) / `"ar"` for Arabic. Do not reverse strings by hand.
- Auto-fit: shrink text size until it fits the safe width; max 3 lines; never go below 64 px at 1080 wide.
- Contrast: text must keep >= 4.5:1 against its local background; add a soft backing shape or shadow if it does not.

Encode with ffmpeg:

```bash
ffmpeg -y -framerate 30 -i render/frames/%05d.png -i input/voiceover.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 192k -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
  -movflags +faststart -shortest out/final.mp4
```
(Or pipe raw frames to ffmpeg to avoid writing PNGs.) Video length must equal the planned duration; the voice-over must start exactly at t = 0 of the timeline (include the lead-in as silence padding on the audio, `adelay`, rather than shifting visuals). If music or SFX is provided, mix with `amix`/`sidechaincompress` so the voice stays 12 dB above the music.

### P8 - QA (do not skip, fix before delivering)
1. Build a **contact sheet**: 3 frames per scene (entry, mid, exit) in one image; look at it.
2. Automated checks: no frame fully black or identical for more than 1.5 s (dead motion); every text element inside the safe zone; no asset edge fringe; text/hero overlap; audio and video durations match within 40 ms; every key word pop within +-2 frames of its timestamp.
3. Visual checks: assets not blurry (scale <= 1.5x of native size), parts attached correctly, rotations around the right pivot, shadows consistent, line count and angle equal to the style lock on every scene.
4. Fix the problem in the manifest or engine, re-render only the affected frame ranges, and re-check. Maximum 3 fix loops, then deliver and list what remains.

### P9 - Deliver
Report in this short format:
- Final file path, duration, resolution, fps, file size.
- Scene count and the asset list (generated / provided / placeholder).
- Style lock summary.
- Anything approximated (timestamps from estimation, placeholders, fallback fonts).
- How to re-render a single scene or swap one asset: change the file in `assets/clean/` or the scene in `scenes.json` and run `python engine/render.py --scene S03`.

## Reuse and consistency across videos

- Keep `assets/registry.json` between projects. Before writing any asset prompt, search the registry by tags; reuse matching assets and only prompt for new ones.
- Keep `style.json` as a named preset (`styles/<name>.json`) so a series stays identical.
- Re-rendering a video with a new voice-over only needs P1, P3 timing updates, and P7, no new assets.

## Hard rules (never break)

1. Never ask an image model for a full scene, background, grid, text, or a shadow. Assets only.
2. Never use a video-generation model.
3. Never bake text into assets. All text comes from the renderer.
4. Every moving part is its own asset with a defined pivot.
5. Timeline comes from the audio, not from guesses. Do not stretch or trim the voice-over.
6. Do not redesign between scenes: style tokens are locked once.
7. One scene = one beat, always a living hold (never a frozen frame), always a planned exit.
8. If an asset is missing, use a code placeholder and keep going; never stall the pipeline.
9. Do not add objects, text, or effects that are not in the scene plan.
10. Always preview at low resolution before the final render.

## How the user will call you

Typical request: "Make a motion short. Script: `input/script.txt`. Voice-over: `input/voiceover.wav`. Style: black background, red accent, faint square grid, 2 diagonal lines. Language: Kurdish." Respond by running P0-P4, print the asset table and prompts, and (if you cannot generate images yourself) stop at the checkpoint. After the assets arrive, run P5-P9 without further questions and deliver the video.
