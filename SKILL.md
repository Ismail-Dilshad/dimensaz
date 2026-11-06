---
name: reelwright
description: Create, edit, revise, and verify Sorani-first multilingual motion graphics and footage with the local video production toolkit.
---

# Reelwright

Run commands from this project root. Use Node.js 22+, pnpm 11, Chromium,
FFmpeg and FFprobe. See [setup](README.md#setup) and run `pnpm video:doctor`.
Use the host's shell, file and media inspection tools.
When a capability is missing, check installed tools first, then research an
official source and verify compatibility and licensing. Install only the tools
needed for the brief using the host's permission flow. Obtain confirmation
before large downloads, then run the relevant dependency and smoke checks.

1. **Read the brief and inputs.** Distinguish a new video, a revision and a
   resumed job. Search [project memory](memory/README.md) for relevant techniques,
   working tools and preferences. Preserve supplied text and recording. Default to Sorani, Rabar
   021 and vertical 1080×1920 at 60 fps for new shorts. Check glyph coverage for
   other languages. Animate complete shaped words. Follow the
   [language guide](references/language-support.md) and [footage guide](references/video-editing.md).
2. **Design the beats.** Follow the [short-form editing guide](references/short-form-editing.md).
   For each new brief, create a distinct visual concept, composition, asset set and
   motion. Use realistic 3D artwork and functional captions. Compare the storyboard
   with recent exports and use references to study techniques.
   If a style preference is needed, ask once. Use Blue Editorial when the choice
   is delegated. For a named card use the [collection guide](skills/custom-motion-shorts/SKILL.md).
   For explicitly requested swinging badge motion use the [Pendulum Reveal recipe](references/pendulum-reveal.md).
3. **Bind assets and sound.** Follow the [layered asset workflow](skills/code-motion-shorts/SKILL.md)
   for code-rendered scenes. Use the asset library to check relevance, rights and
   available masters. Pin the chosen bytes, record styleDNA and use neutral masters
   with aligned masks for recolorable 3D objects. Audition local effects first and
   keep speech clear. Follow the [sound guide](references/sound-library.md).
4. **Bind narration timing.** Cuts and speech events follow recording evidence.
   Exact word sync requires reviewed, audio-hash-bound complete-word cues. Keep
   unresolved times null. Follow the [voice rules](references/voice-synchronization.md)
   and [local audio pipeline](references/local-audio-pipeline.md).
5. **Create and review.** Prepare the request internally using the
   [production system](references/production-system.md). Run
   `pnpm video:create --manifest REQUEST`, retain the job ID and resolve the
   returned gates in order. Render only from the versioned `project.json`.
   Inspect every scene and preview sheet for shaping, safe bounds, visual balance,
   contact, motion, transitions and final hold. Fix failures in a separate revision
   and inspect the new preview. After inspection run
   `pnpm video:create --resume JOB --approve-preview`.
6. **Verify and deliver.** Inspect encoded frames through the action and cuts,
   verify audio, and record the relevant hash-bound editorial review. For
   script-led explainers use `video:frame-qa` and `video:critic` and revise scores
   below 4/5. Deliver the unique MP4, SRT and silent preview with actual limits.
   Keep saved projects, pinned assets and previous exports intact.
   After verifying and delivering the final export, remove scratch files created
   solely for its tests or temporary checks. Run the test suite through pnpm test
   so its isolated workspace is cleaned on exit. Keep explicitly requested
   deliverables, source footage, references and project recovery files. Merge any
   verified reusable lesson into [project memory](memory/README.md).

Use `pnpm video:create --resume JOB` for recovery. Keep writes to a job sequential.
Preserve `assets/Rabar_021.ttf` and `references/original-skill-v2.md` unchanged.
