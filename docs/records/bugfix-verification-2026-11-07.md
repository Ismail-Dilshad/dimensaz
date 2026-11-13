# Bug fixes verified on 2026-11-07

Scope: the confirmed bugs from the project review. Planned features were left unchanged.

## Changes

- Restored 36 missing tracked reference files from HEAD without replacing any existing files. These include the 33 style dependencies and three motion-reference files reported missing during review. Catalog frame hashes match the restored bytes.
- Added reference dependency and frame-hash checks to `video:doctor`, with regression coverage for missing and changed files.
- Fixed speed edits by explicitly resampling frames after timestamp changes. Regression coverage exercises 0.25x, 0.5x, 2x and 4x playback with audio retained; fractional frame durations allow one frame of rounding.
- Preserved script caption text as exact source slices, including tabs, repeated spaces, line breaks and text unmatched by transcription. Visual wrapping remains the caption renderer's responsibility.
- Validated imported SRT cue ranges with the shared Zod cue schema, rejected invalid timestamp fields, and preserved caption-body whitespace.
- Made reference image imports reserve unique filenames with exclusive writes, including collisions introduced by filename normalization. Regression coverage verifies every imported file's original bytes and recorded hash.
- Replaced the clay browser test's private production-project dependency with an isolated synthetic fixture that also checks word cues.
- Closed stabilization's encoder error stream; the media suite completed without its previous unclosed-file warning.

## Checks

- `pnpm typecheck`: passed.
- `pnpm skills:check`: passed.
- `pnpm video:doctor`: passed, including all eight style families and 16 motion references.
- Focused browser-enabled regression run: 31 tests passed.
- `pnpm test`: 196 passed, 27 integration tests skipped by default, no failures.
- `RUN_BROWSER_TESTS=1 RUN_AUDIO_TESTS=1 pnpm test`: all 223 tests passed across 36 files, no skips or failures.
- `pnpm test:audio`: all 22 tests passed.
- `pnpm test:media`: all 20 tests passed.
- `git diff --check`: passed.

## Render evidence

Ran `pnpm test:e2e`, inspected both preview sheets, and rendered the synthetic-footage revision `2026-11-07_sorani-smoke_1640_v2` after inspection. The verified output was 360x640 at 12 FPS, 49 decoded frames, 4.083333 seconds, with audio and video both starting at zero. Repeated export produced a distinct filename. Inspected the extracted encoded frame under that project's `renders/c6644d78-c942-4500-9396-395076e3d3fe/encoded-frame.png`.

This was a functional smoke fixture, not a production design review or speech-accuracy benchmark. Generated smoke projects, inputs, previews, exports and the encoded-frame PNG were subsequently removed at the user's request on 2026-11-08; automated tests and source fixtures were retained. No external speech requests, model downloads, font changes or unfinished feature implementations were needed.
