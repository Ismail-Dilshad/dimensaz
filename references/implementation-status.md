Current unified-production evidence: [production-verification.md](production-verification.md). The following records the earlier multilingual hardening pass.

# Implementation status — 2026-10-25

This records the current local hardening pass, not a claim that every possible
input, machine, or speech model has been certified for production.

## Verified on the current source

- `pnpm typecheck` passes under strict TypeScript.
- `pnpm test` with RUN_BROWSER_TESTS=1 and RUN_AUDIO_TESTS=1: **100 passed**, 14 test files, none skipped.
- `pnpm test:audio`: **8 passed**.
- `pnpm video:doctor`: Node 26.3.1, local FFmpeg/FFprobe, and Chromium launch successfully.
- Actual .venv bridge/native-import integration test passes.
- Representative Sorani, English, Arabic, Persian, Badini Arabic-script, and Latin Kurdish browser fixtures render with exact source text, glyph coverage, safe bounds, and deterministic seeking.
- Mixed-script regressions verify English phrases keep LTR word order inside RTL scenes and Arabic phrases keep RTL order inside English scenes.
- All latest preview contact sheets and representative full-resolution images were inspected. The three latest encoded inspection frames were also inspected.
- Validation performs full-stream FFmpeg decoding, not metadata checks alone.

## Latest real exports

| File under mp2/ | Geometry | Duration | Audio | Bytes |
| --- | --- | --- | --- | --- |
| 2026-10-25_multilingual-production-smoke_058_export002.mp4 | 1080x1920, 30 FPS | 12.000 s | Silent | 1,032,891 |
| 2026-10-25_sorani-smoke_070.mp4 | 360x640, 12 FPS | 3.917 s | Silent | 53,798 |
| 2026-10-25_sorani-smoke_070_v2.mp4 | 360x640, 12 FPS | 4.084 s | AAC, synthetic test signal | 207,334 |

All use H.264/yuv420p and passed full decode and geometry/FPS/duration/audio
validation. The two small smoke projects also produced distinct `_export002`
files which passed validation. Footage is explicitly generated FFmpeg testsrc2
with a 440 Hz tone; it is not real speech. The footage revision was replanned to
cover the complete four-second source. Existing exports were never overwritten.
The multilingual sample is a typography/encoding fixture, not a linguistic
translation review or an example of narration synchronization.

## Corrections made

- Explicit language metadata in config, briefs, CLI, and rendered text; ckb remains default.
- Local Latin font fallback resolves missing Ş/ş without modifying or redistributing Rabar/system fonts. Fallbacks load before layout measurements.
- Whole-word directional runs fix embedded LTR/RTL phrase order while preserving all original text and whitespace.
- Invalid animation/transition names fail schema validation. Font fitting no longer steps below configured minimum size.
- Interrupted brief preparation cannot masquerade as success. Failed attempts remain separate and retryable; missing Python dependencies still allow a blocked design preview.
- Unaligned voice plans, including explicitly estimated drafts and direct CLI planning, use phrase holds.
- Exact sync requires compatible kinetic animations, finite probed duration, complete reviewed cues, and an unchanged audio hash.
- Preview approval hashes media/font/selected-asset contents and rendering sources. Missing/stale previews cannot be implicitly approved during regeneration. Changes during a render prevent export.
- Browser startup failures are recorded as failed renders. Re-exports check current alignment, duration, and expected audio.
- Short-scene preview times remain inside scene bounds; word-cue previews cover cue starts. Contact sheets paginate to bound bitmap size.
- Encoded inspection frames come from inside a scene instead of a possibly blank whole-video midpoint transition.
- Python doctor reports missing optional modules instead of crashing. Non-Sorani automatic model requests retain null word timings and report the unsupported model route.
- Child-process text pipes use streaming UTF-8 decoding to avoid breaking characters at Buffer boundaries.
- Smoke checks require explicit existing project IDs after preview inspection. Synthetic footage is replanned before rendering.
- README, language/audio workflow references, CLI help, and .env.example now describe supported behavior and actual environment variables.

## Preserved assets

- Rabar SHA-256: `5875E28B47A50D01093760C55B3BEB90AA7F3C56FF9F5B60B6130AF04F5449A0`
- Original v2 skill SHA-256: `2FC6873B66715966F71CBE6BD523BE8BF4CA202682ADE8CC58A00C296B5D4D8C`

Both match their pre-change hashes. Original projects, media, previews, and completed
renders remain. Root SKILL.md and AGENTS.md were not rewritten.

## Remaining boundaries and blockers

- Automatic speech alignment outside Sorani is not configured. All supported languages can use reviewed provider/manual timestamps. No real-voice accuracy benchmark was performed in this pass, including for Sorani.
- Downloading an open Latin font failed because the shell could not resolve the upstream host. This machine uses its installed Arial as an explicit local fallback. OS font files are not bundled; moved projects need compatible paths and fresh preview inspection.
- Local scene direction/emphasis remains heuristic; editorial judgment is required. No automatic translation, dialect inference, true 3D engine, TTS, or external AI service was added.
- The compositor still uses the first video and image. Unsupported video codecs need conversion. No long-duration/load/4K performance certification is claimed.
- Edits and session operations for the same project must remain sequential. Frame rendering is not resumable. Legacy layouts/configurations remain available.
- Repository files remain local and uncommitted; `git remote -v` reports no configured remote. Remote backup/deployment was not performed.
