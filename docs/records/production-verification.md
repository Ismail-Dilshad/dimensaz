# Unified production verification — 2026-10-26

## Results

- Strict TypeScript: passed.
- TypeScript suite with browser and actual Python bridge enabled: 107 passed across 15 files, no skips.
- Python acoustic tests: 8 passed.
- Dependency doctor: FFmpeg, FFprobe and Chromium working; no new dependencies/models installed.
- Skill YAML/frontmatter, length and relative reference links validated.
- Independent read-only workflow review identified invalid embedded-alignment recovery, missing returned review paths, and repeat revision attachment issues. All three corrected; regression tests exercise correction and repeat attachment.
- Rabar and original-skill-v2 SHA-256 hashes unchanged from the prior verification.

## End-to-end unified command

The same video:create interface created, previewed, resumed, rendered and validated:

| Export under mp2/ | Dimensions/FPS | Duration | Audio |
| --- | --- | --- | --- |
| 2026-10-25_ai-production-sample_071_export002.mp4 | 360x640 / 12 | 2.417 s | none |
| 2026-10-25_synthetic-timing-pipeline-fixture-not-speech_085_export002.mp4 | 360x640 / 12 | 3.000 s | AAC tone |

Every returned preview sheet and both final encoded inspection frames were visually inspected.
Exports passed stream validation and complete FFmpeg decode. Previous exports remain present.
Resuming the completed timing fixture returned the same validated output with cached:true;
it did not create another export. The fixture uses predetermined timestamps on a 440 Hz tone,
not Kurdish speech. This verifies timing plumbing, hash binding, cue-driven rendering and
muxing; it is NOT evidence of real speech alignment accuracy.

## Measured preview benchmark

Single five-frame 360x640 project on this host:

| Scale | Pixels/frame | Elapsed |
| --- | --- | --- |
| 1.0 | 230,400 | 822.43 ms |
| 0.5 | 57,600 | 728.00 ms |

This is one local observation, including browser startup, not a general speedup guarantee.
Use video:benchmark --project ID for repeat measurements on representative workloads.

## Scope and limitations

- Unified command is an agent-operated staged interface: creation returns evidence; the agent
  inspects it and resumes with --approve-preview. It is not an unattended subjective quality judge.
- Accurate real Sorani synchronization still requires reviewed acoustic/provider/manual timing.
- Existing 2.5D object motion and 2D parallax are reused, not marketed as a true 3D engine.
- SFX inventory under assets/ was empty. Unknown licensing never authorizes automatic use.
- Imports/plans/completed outputs and successful analysis are reusable. Interrupted frame streams
  restart; per-scene/frame incremental rendering is not implemented. Same-job writes are sequential.
- Local model weights changing in place require refreshed analysis; no large download is automatic.
- No global skill installation or remote synchronization occurred. Git staging failed creating
  .git/index.lock (permission denied). All changes and skill files remain local in this workspace.

See production-system.md for architecture, manifests, commands and recovery instructions.
