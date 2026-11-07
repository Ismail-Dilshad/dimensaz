# Production policies

Rules the agent follows while producing videos. They were previously in `AGENTS.md`.
Technical details live in the linked references.

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

- Check installed tools first. Install only what the brief needs, through the host's
  permission flow. Ask before large downloads (models, packages, media).
- Verify licenses before using downloaded material.
