# Production policies

Rules the agent follows while producing videos. They were previously in `AGENTS.md`.
Technical details live in the linked references.

## Motion and design (every video)

The user's standing rule, recorded 2026-11-07 after a text-only promo was rejected as
too slow, empty and undesigned. It applies to every new video unless the user changes
it in writing for a specific request.

1. **Motion is mandatory.** No scene may be a static image or text on a plain
   background. Every scene moves from its first second to its last: elements enter,
   move, transform and exit. Holds stay alive (push-in, drift, parallax, counters).
2. **Show, don't tell.** Each scene visually demonstrates the sentence it covers
   ("tasks assign themselves" → task cards fly to team avatars). Build it from UI
   mockups, cards, charts, icons, cursors, progress bars and counters. Text is a
   supporting label, never the whole scene.
3. **Design is mandatory.** One clear style (palette, grid or shapes, typography,
   depth, shadows), consistent across all scenes. Brand colours are used exactly.
4. **Pacing fits the time.** Divide the length by the beats. A new visual event at
   least every 1–2 seconds; scenes of 2–5 seconds; no dead time. Match content to
   length: about 70–80 words and 6–8 scenes for 30 seconds (scale proportionally).
5. **Real animation.** Eased motion (springs, ease-out), staggered entrances, camera
   pushes or parallax, number count-ups, and designed transitions between scenes
   (wipes, morphs, zooms, masks), not hard cuts or fades to blank.
6. **Build it for real.** Deliver a rendered MP4 (1080×1920 for vertical) made with
   code or a motion tool, never only a prompt, script or slideshow.
7. **Check before delivering.** Run `pnpm dimensaz media pacing FILE` and look at
   frames across the whole timeline. Any plain text-on-blank scene, or anything still
   for more than 1.5 seconds, is fixed before delivery. Deliver the video with one
   line per scene describing what happens in it.

Consequences:

- Missing user assets (screenshots, logo, footage) are never a reason to fall back to
  text only. Draw the UI, cards, icons and charts in code from the brief, use the
  asset library, or ask for the files. Say which visuals are stand-ins.
- The `kinetic` preset alone (words on a background) does not meet these rules. Use
  it only inside a designed, moving scene, or when the user explicitly asks for
  text-only in that request; even then the background is designed and keeps moving.
- If the brief cannot be built to these rules with the available tools, say what is
  missing and ask before delivering something that breaks them.

## Text

- Preserve the user's exact text: Unicode, whitespace, punctuation, right-to-left
  shaping and complete words. Never reverse strings. Never split Arabic-script words
  into animated letters.
- Detect the language from the script unless the user names it. Never guess Kurmanji
  or Badini from shared letters.

## Fonts

- Kurdish in Arabic script uses only the existing Kurdish fonts in `assets/fonts/`.
  Choose among them by the video's style (`pnpm fonts:library recommend`). Never
  download or add a Kurdish font. If a glyph is missing, tell the user instead of
  silently swapping fonts.
- Other languages use open-license fonts from `assets/fonts/open/`, chosen to fit the
  style. Ask the user before downloading a new font; record its license.
- One primary font per video. Do not mix fonts at random across scenes.
- Never modify or delete font files. Details: `docs/guides/font-library.md`.

## Timing

- Choose each scene's duration from its text, reading time, visual action and a
  settling hold. Use a fixed duration only when asked.
- With narration, the recording is authoritative: cuts and speech events follow the
  recording's cues and pauses. Exact word sync requires reviewed, audio-hash-bound
  complete-word cues. Never infer word times from reading speed, character counts or
  silence. Keep unresolved times as null. Automatic scores are never "reviewed".
  Details: `docs/guides/voice-synchronization.md`, `docs/guides/local-audio-pipeline.md`.

## Projects and exports

- `project.json` is the authoritative versioned render manifest. `job.json` is
  recovery state; a request JSON is creation input. Never render from job or request
  data directly.
- Create separately; revise separately. Exports go to `mp2/`, receipts to
  `workspace/history/`. Never overwrite exports or automatically remove media,
  projects or completed renders.
- Writes to one project are sequential. Use `video:create --resume JOB` to recover.
- Defaults for new jobs never restyle saved projects.

## Assets

- Search the library first: `pnpm assets:library search|assess|check|style|similar`.
- Treat quality scores as passed-check percentages, not aesthetic certainty.
  Inspect mobile previews for subject relevance, edge halos and composition.
- New 3D object assets default to reusable neutral white or gray masters with
  separate aligned masks for recolorable regions. Apply each video's palette as a
  variant; never regenerate an object only to change its color.
- Keep `styleDNA` and `assetLocks` in `project.json`. Pin chosen assets under
  `input/asset-locks`; never edit pinned bytes.
- Create variants with `parentAssetId` and verified permission to modify. Originals
  and earlier metadata stay immutable. Never auto-clean library or project assets.
- Image tools create isolated objects and moving parts only; code owns the scene,
  background, text, light and motion.
- Details: `docs/guides/asset-intelligence.md`, `docs/guides/asset-licensing.md`.

## Sound

- For every video, search `assets/sfx/index.json` and audition local effects first.
- Only sounds with a verified license (for example CC0) are placed automatically.
  Never infer rights from a filename or assume uploads are CC0.
- If a needed sound is missing, research a legitimately reusable effect, then use
  `sfx:acquire` with license evidence and `sfx:index`. Stop for login, payment or
  unresolved licensing.
- Speech stays clear: narration has priority; avoid excessive effects.
- Details: `docs/guides/sound-library.md`.

## References

- Use references for rhythm, easing, composition and material language. Apply the
  user's own brand (`config/brand.json`): logo, colors, fonts, voice.
- Never copy a reference's logo, characters, branded artwork or exact layout as a
  final asset. Keep reference posters out of final scenes; source separate hero and
  part assets and overlay real text.
- For layered recreations, match silhouette, placement, perspective and occlusion
  first, then refine. Fix physical inconsistencies (scale, contact, light, shadow).
  Compare the assembled result side by side with the reference.
- Motion recipes keep their source hash, reviewed evidence and approximate parameters.
- Named style cards and presets: `docs/guides/style-cards.md`,
  `docs/guides/pendulum-reveal.md`, `docs/guides/reference-motion.md`.

## Downloads and tools

- Speech transcription uses ElevenLabs only (the user's choice, 2026-11-07), and only
  when `ELEVENLABS_API_KEY` is set. It uploads the audio: tell the user before the first
  upload for a project. Transcripts are cached by audio hash; never resend the same
  recording. Kurdish is recognised as `kur` with moderate accuracy, so anchor captions
  to the user's script when one exists and ask the user to proofread otherwise.
- Voice-over (text to speech) only with ElevenLabs, only when the key is set and the
  user asks for it. Images for new assets only with an image tool the host agent
  already has; otherwise write the prompts for the user.

- Check installed tools first. Install only what the brief needs, through the host's
  permission flow. Ask before large downloads (models, packages, media).
- Verify licenses before using downloaded material.
