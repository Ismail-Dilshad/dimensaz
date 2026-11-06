# Project development

## Purpose and entry point
Sorani-first multilingual deterministic motion graphics; preserve exact source text.
For production requests read skills/video-production/SKILL.md, then
references/production-system.md. Root SKILL.md is a compatibility entry point.
Use video:create internally; do not require users to edit JSON or run commands.
For code-rendered shorts, apply skills/code-motion-shorts/SKILL.md alongside the
production workflow: image tools create isolated objects/parts; code owns the scene.

## Invariants
- Keep strict TypeScript, Zod validation, and argument-array child_process calls.
- project.json is the authoritative versioned render manifest. job.json is recovery
  state; request JSON is creation input. Never render directly from job/request data.
- Preserve assets/Rabar_021.ttf and references/original-skill-v2.md.
- Preserve Unicode, whitespace, punctuation, RTL shaping and complete words.
  Never reverse strings or split Arabic-script glyphs into animated DOM letters.
- Use deterministic render(t); no real-time animation timers or external AI service
  in the renderer. No UI framework. Reuse registered presets and existing components.
- Choose each scene duration from its script, reading time, visual action and settling hold. Use a fixed duration only when explicitly requested. With narration, use the recording’s bound cues and pauses for cuts.
- Voice timing is authoritative. Exact output requires reviewed hash-bound word
  cues. Never infer word timings from reading speed, character counts or silence.
- Use .venv through engine/audio-analysis.ts. Automatic scores are never reviewed.
  Retain unresolved times as null; consult references/local-audio-pipeline.md.
- Create separately; revise separately. Exports in mp2/, receipts in workspace/history/.
  Never overwrite exports or automatically remove media, projects or completed renders.
- Keep legacy commands/configs working. Defaults for new jobs do not restyle old projects.

## Verification and recovery
Run pnpm typecheck and pnpm test. Enable RUN_BROWSER_TESTS=1 for rendering changes,
RUN_AUDIO_TESTS=1 for the Python bridge, and pnpm test:audio for audio_pipeline changes.
Run video:doctor, inspect previews, render a smoke project and inspect encodedFrame
when FFmpeg/FFprobe/Chromium are available. Record actual blockers and test results.
Use video:create --resume JOB for recovery; inspect fresh previews before approval.
Per-project writes must be sequential. Do not silently install/download large packages
or models; obtain confirmation. Do not destructively restructure the project.

## Documentation
Keep workflow instructions in skills/video-production/SKILL.md and technical details
in references/production-system.md. Avoid copying large instructions across files.
For isolated workflow validation, an agent may create a separate test project; it
must not modify production engine code.

## Asset intelligence and preservation
- Default newly generated 3D object assets (including 3D-style PNG cutouts) to
  reusable neutral white/gray masters with
  preserved shading and separate aligned masks for recolorable regions. Apply each
  video's palette as a separate variant; do not regenerate an object for color alone.
  Keep masters, masks and existing pinned variants unchanged. Follow the neutral
  asset workflow in skills/video-production/SKILL.md and references/production-system.md.
  This default does not apply to other asset types.
- Use assets:library search/assess/check/style/similar before sourcing new assets.
- Treat quality scores as explicit passed-check percentages, never aesthetic certainty.
  Inspect mobile previews for subject relevance, edge halos and composition.
- Keep project styleDNA and assetLocks in project.json. New projects pin selected
  assets under input/asset-locks; never edit pinned bytes or discard these dependencies.
- Create variants with parentAssetId and verified modification permission. Originals
  and previous metadata remain immutable. Do not auto-clean library or project assets.
- Motion recipes must retain source hash, reviewed evidence and approximate parameters.
- Technical details and limitations: references/asset-intelligence.md.

## Fonts
Keep assets/Rabar_021.ttf as the primary default. Use fonts:library recommend and references/font-library.md for intentional Kurdish alternatives or installed English font presets; do not randomly rotate fonts. Font files are renamed by family, variant and weight without modifying internal tables or bytes.


## Sound selection and sourcing
For every video, search assets/sfx/index.json and audition relevant local effects first.
When a needed sound is missing, research and download a legitimately reusable effect
using official provider methods; do not require a separate user request for each sound.
Use sfx:acquire for bounded downloads/imports with verified license evidence, then sfx:index.
Never fabricate rights from a filename or assume uploaded sounds are CC0. Stop for login,
payment or unresolved licensing. Preserve narration priority and avoid excessive effects.
See references/sound-library.md for categories, metadata and exact deduplication rules.

## Reference motion production
For layered recreations, match the original's silhouette, placement, perspective and occlusion before refining the artwork. Where the source has a physical inconsistency, improve it with a specific correction to scale, contact, lighting or shadow. Give dimensional objects convincing thickness and materials, keep moving elements separate, retain Rabar 021 for Sorani text, and compare the assembled result side by side with the original.
For references/styles/custom-motion-shorts or custom-motion requests, read skills/custom-motion-shorts/SKILL.md.
For new briefs without a style, ask which treatment the user wants, including Pendulum Reveal, Blue Editorial or another reference. Use Blue Editorial if the user delegates the choice. For the SaaS pendulum example, follow references/pendulum-reveal.md. All ten named collection cards use the existing reference-layer renderer. Bind the card with styleCard, compose a hero and independently placed companion assets, and inspect their timed relationship against the actual library anchor. Seven numbered presets remain compatible.
Keep reference posters out of final scenes: source separate hero/part assets and overlay
real Rabar 021 text. Keep layer assets pinned and included in preview fingerprints.

## Status reporting
The video:create command reports planning, rendering, review, completion, and errors automatically. For work outside that command, report the current phase manually:
  python scripts/set_state.py <state> "<short detail>"

States: idle, listening, thinking, planning, creating, rendering, done,
excited, confused, error, needs-approval, sleeping.

- listening: reading the script or request
- thinking: reasoning about the edit
- planning: splitting the script into scenes and timing
- creating: generating images, icons or other assets
- rendering: encoding or exporting the video
- done: the export finished; use excited if the result is especially good
- confused: the request is unclear (ask the user one question)
- error: a step failed
- needs-approval: waiting for the user to approve something
- idle: waiting for the next task

Run the command from the project root. To watch the status locally, run python -m http.server --bind 127.0.0.1 from the project root and open http://127.0.0.1:8000/assets/brand/web/state-viewer.html.
