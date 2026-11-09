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
   supporting label, never the whole scene. Every scene gets a visual designed from zero
   for its video from layers (`pnpm dimensaz pieces`), with only the sentence's own words
   and numbers: no ready-made pieces, sample names, apps or made-up data. Give every scene
   one unless it has footage, a reference-style hero or another real visual (`video:create`
   designs them itself when a motion request has none). Never copy a look: every video's
   style is generated from zero for it, different from every earlier video, with sounds
   tuned to it. Record the verdict (`brain verdict`) so the style traits and compositions
   learn. In right-to-left languages the visuals mirror themselves; set `"direction": "ltr"` only for a left-to-right app or page shown
   inside the video. `pnpm dimensaz storyboard`
   drafts this automatically; the user approves the storyboard before rendering.
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

## Learning from feedback

- The user's feedback is recorded automatically, never only remembered for the moment:
  `pnpm dimensaz feedback add` for every rejection, correction or specific praise, with
  a rule written for all future videos. Tell the user the saved rule in one line.
- Before every video, load `pnpm dimensaz feedback lessons --for "<request>"` and follow
  every rule; a rule seen twice or from a rejected video applies to every video.
- A newer rule on the same point replaces the older wording. When the user says a rule
  no longer applies, remove it with `pnpm dimensaz feedback forget ID`.

## Knowledge and getting better

- The brain (`pnpm dimensaz brain`) holds what Dimensaz knows about motion design and
  video editing ([guide](../docs/guides/brain.md)). Recall it before every video and
  edit; apply every `always` item.
- Facts measured from jobs and the user's feedback apply at once. Techniques found on the
  web are saved as `trial`: try them only when they fit, record them with `brain apply`,
  and they become proven after two approved jobs. The user can approve or reject any item.
- Never save copied artwork, footage or someone's private data as knowledge; save how a
  technique works, with the source link.

## Text

- Preserve the user's exact text: Unicode, whitespace, punctuation, right-to-left
  shaping and complete words. Never reverse strings. Never split Arabic-script words
  into animated letters.
- Detect the language from the script unless the user names it. Never guess Kurmanji
  or Badini from shared letters.

## Fonts

- Kurdish in Arabic script uses only the open-licensed fonts in `assets/fonts/open/`
  that cover every Kurdish letter (`pnpm fonts:library recommend --file SCRIPT`).
  Choose among them by the video's style. Never add a font without an open license.
  If a glyph is missing, tell the user instead of silently swapping fonts.
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
- Free assets from the internet come through `pnpm dimensaz source` only
  ([guide](../docs/guides/free-sources.md)): search, look at the previews, then get.
  Use only items marked final; study items (CC BY-SA, GPL, every reference video) never
  appear in a final video; blocked licenses are never downloaded. Give the user the
  `source credits` lines whenever an item needs attribution.
- Reference videos: show the title, length and size from `reach download URL` (or
  `source reference URL`) and download with `--confirm` only after the user agrees.

## Social platforms and the browser

- Use `pnpm dimensaz reach` for YouTube, Instagram, TikTok, X, Facebook, Pinterest,
  Dribbble, Behance, Reddit, LinkedIn and other sites, and `pnpm dimensaz browse` for any
  other page ([guide](../docs/guides/reach.md)). Both are read-only.
- Never post, comment, like, follow, message, buy, sign up or submit a form. In
  `browse`, clicking and typing are for reading only (search boxes, closing popups,
  opening menus); ask the user before anything that sends or changes data.
- Never log in for the user and never ask for a password: run `reach login CHANNEL` and
  let the user log in in the window. Copying a site's login from the user's Chrome copies
  that site only.
- On `PLATFORM_BLOCKED` or `RATE_LIMITED`, stop using that site, tell the user, and
  continue with other sources. Do not switch accounts or retry in a loop.
- Record every finding with its link and the date. Social posts and reference videos
  are for study; never copy another brand's artwork, footage or words.
- Details: `docs/guides/asset-intelligence.md`, `docs/guides/asset-licensing.md`.

## Sound

- For every video, search `assets/sfx/index.json` and audition local effects first.
- Only sounds with a verified license (for example CC0) are placed automatically.
  Never infer rights from a filename or assume uploads are CC0.
- If a needed sound is missing, research a legitimately reusable effect, then use
  `sfx:acquire` with license evidence and `sfx:index`. Stop for login, payment or
  unresolved licensing.
- Speech stays clear: narration has priority; avoid excessive effects.
- Quality checks are part of delivery: the preview's `quality` result (text size, contrast,
  overlaps, cut-off text, empty frames) must have no hard issues, and the final sound check no
  clipping. After changing pieces, styles or sounds, run `pnpm dimensaz quality` and compare.
- Scene pieces sound themselves (`pieceSounds`, on by default): a whoosh on each transition,
  cursor clicks, pops as notifications, messages, tiles and avatars land, ticks while numbers
  count, a click per checked item and a chime when work is done. Cues are spaced at least
  70 ms apart, at most 14 per scene, levelled by loudness, and 6 dB quieter under a voice.
  Turn them off with `"pieceSounds": "off"`.
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
  user asks for it (`pnpm dimensaz media voiceover`): say it uses their ElevenLabs
  credits, let them pick the voice (`media voices`), and play the result before
  building on it. Never clone or imitate a real person's voice without their consent.
- Music in footage edits goes under the voice with the `music` operation (ducking on),
  then `loudness`; speech must always stay clear. Images for new assets only with an image tool the host agent
  already has; otherwise write the prompts for the user.

- Check installed tools first. Install only what the brief needs, through the host's
  permission flow. Ask before large downloads (models, packages, media).
- Verify licenses before using downloaded material.
