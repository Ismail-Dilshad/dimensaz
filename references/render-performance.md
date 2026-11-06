# Renderer performance and 60 FPS upgrade

Implementation date: 2026-10-26. Code and typecheck passed. The browser/audio-enabled
suite passed 127 tests; the additional encoder fallback suite passed 2 tests.
The user approved telemetry for this work and the complete benchmark finished.

## Audit

Previous default: 1080x1920 at 30 FPS; Config and request schema capped FPS at 60.
Animation already used deterministic render(frameIndex / fps), not wall-clock time.
One Playwright page captured each PNG sequentially. PNGs were streamed to FFmpeg
with backpressure rather than accumulated on disk. libx264 medium/CRF18 encoded
H.264 yuv420p; audio was mixed afterward while copying video without re-encoding.
Each render launched a browser. Font/image decoding and file bytes were cached
within its context. No GPU encoder selection or capture performance telemetry existed.
The compositor already used analytic easing/spring samples and fractional CSS transforms.

The 2-second benchmark shows screenshot capture dominates: 12.82 seconds of the
13.43-second optimized 60 FPS capture/encode pipeline. Hardware encoding alone
cannot remove that cost. Browser startup was approximately 0.4 seconds in the baseline.

## Presets and compatibility

| Preset | Resolution | FPS | Software encoder |
| --- | --- | --- | --- |
| draft | 540x960 | 30 | ultrafast, CRF23 |
| preview | 720x1280 | 30 | fast, CRF20 |
| final | 1080x1920 | 60 | medium, CRF18 |

New requests default to final; existing project manifests retain their saved dimensions,
FPS, codec and timing. Existing lower rates such as 12 remain legal for compatibility.
24/30/60/120 and integer custom rates through 120 are accepted. Native 120 FPS is
optional and expected to be substantially more expensive; its new integration test
passed at 160x284 with 24 decoded frames over 0.2 seconds. High-resolution 120 FPS
performance is not certified. Resolution and FPS overrides are independent of animation seconds.

New request fields: renderPreset (draft/preview/final), captureConcurrency (1-4).
Optional fps/resolution override the profile. output.codec accepts libx264,
h264_nvenc or auto. Explicit output.crf overrides profile quality.

Prepare a separate profile revision and preview without overwriting an old project:

```powershell
pnpm video:profile --project PROJECT_ID --preset final
pnpm video:profile --project PROJECT_ID --preset preview
pnpm video:profile --project PROJECT_ID --preset final --fps 24 --width 1080 --height 1920 --workers 2 --codec libx264
```

The command returns the new revision and preview. Inspect it, then attach it using
video:create --resume JOB --revision NEW_PROJECT_ID and the existing preview-approval
workflow. Standalone legacy video:render also remains available.

## Capture implementation

- One Chromium process, up to four independent page contexts. New profile default: two.
- CPU and available-RAM budgets further cap workers; reserve 2 GiB system RAM and
  budget 1.5 GiB per page, with no more than one worker per three logical processors.
- One in-flight capture per page, bounded batches; buffers flushed in ascending frame
  order regardless of capture completion order. No unbounded producer queue.
- Every frame is evaluated at its exact index/FPS. Frame count uses ceil(duration*FPS)
  with a tiny floating-point tolerance to prevent an extra frame for values like .1+.2.
- Existing lossless PNG streaming retained for Kurdish glyph fidelity. JPEG was not
  adopted because it can introduce text-edge artifacts; raw RGBA would require an
  extra decoder or alternate capture API and significantly larger pipe traffic.
- Inactive scene visibility is no longer assigned redundantly on every frame.
- Existing deterministic spring/easing/subpixel transforms retained; native 60 FPS
  doubles temporal sampling. No blanket motion blur is applied to Kurdish text.
- Browser networking remains disabled and resources are served from local files.

## Encoding and recovery

Explicit NVENC selection first runs a real small encode probe, not just an encoder-list
check. Unavailable NVENC falls back to libx264. Render-time NVENC failure retries
software encoding to a separately named file, retaining the failed output.
Auto currently selects libx264 because local encoding tests did not justify NVENC.
NVENC uses p5, VBR CQ18 by default; this is not claimed quality-equivalent to x264 CRF18.

Immutable silent-video cache is keyed by the complete project/input/code fingerprint.
A cached stream must pass validation before reuse; it can save capture on unchanged
retries. Audio is mixed anew. Nested animation sources now participate in fingerprints.
There is no deletion or automatic cleanup. Cache hits currently still open contexts,
so the optimization saves capture/encoding, not all setup overhead.

Per-scene segment caching was investigated but not enabled: global-time backgrounds,
progress, footage seeking and speech-event offsets cross scene boundaries. A safe
segment key requires their full dependency/time-range representation; naive scene-only
reuse would risk stale animation. No misleading partial segment reuse is claimed.

## Monitoring and QA

Each frame stream writes .performance.json containing exact expected/delivered frame
counts, capture failures, capture time, pipe wait, encoder finalization time, elapsed
seconds, generation FPS, Node RSS, worker count, encoder/fallback and output size.
Estimated size is unavailable while FFmpeg buffers its small initial output; final
size is exact. Capture and encoding overlap, so their times must not be summed as
independent CPU work. Encoding-only timings are measured separately in the baseline.
Consecutive identical PNG hashes are recorded as diagnostics; a static hold is valid.

Render directories include performance.json and resources.json. Resource monitoring
samples the process tree via the project's Python/psutil environment at one-second
intervals. RSS can double-count shared pages; GPU utilization and VRAM are device-wide.
CPU samples miss short-lived processes. Missing instrumentation is reported explicitly.

Validation checks H.264/yuv420p, dimensions, FPS, duration, decoded frame count,
uniform presentation timestamp intervals, audio presence/start offset and A/V duration,
then decodes the entire stream. Identical visual frames are not automatically errors.
Representative encoded frames require visual inspection for typography and corruption;
there is no unsupported claim that a pixel heuristic proves all frames are visually correct.

## Optional footage interpolation

```powershell
pnpm video:interpolate --input original.mp4 --output separate-interpolated.mp4 --fps 60
```

Explicit opt-in only, with a separate non-existing output. Uses FFmpeg motion-compensated
minterpolate, preserves original input, trims/pads duration and retains audio. Never used
for native animation capture. Inspect motion boundaries, cuts and embedded text for
warping/ghosting. A 2-second 1080p footage smoke test passed: 120 frames at 60 FPS, audio retained,
matching 0-second A/V starts and correct duration. This does not guarantee artifact-free
interpolation on other footage.

## Measured local benchmark

Same first two seconds of the existing Sorani project, 1080x1920. Single samples,
not statistically stable performance guarantees. The optimized clips include the first
two seconds of the original voiceover; the original audio is unchanged.

| Pipeline | FPS | Workers | Capture + encode seconds | Final audio clip bytes | Decoded frames |
| --- | --- | --- | --- | --- | --- |
| Original | 30 | 1 | 7.695 | baseline was silent: 190388 | 60 expected, legacy validation |
| Original | 60 | 1 | 15.504 | baseline was silent: 214890 | 120 expected, legacy validation |
| Instrumented | 30 | 1 | 7.849 | 243219 | 60 |
| Parallel | 30 | 2 | 6.798 | 243219 | 60 |
| Parallel | 60 | 2 | 13.432 | 268129 | 120 |

Parallel 30 FPS: about 13.4% less capture/encode time than instrumented serial;
60 FPS: about 13.4% less than original serial. 60 FPS is smoother in temporal sampling,
not cheaper: it still requires twice as many frames. No live playback smoothness study
was performed. Encoded 60 FPS representative image inspected: correct Kurdish shaping,
Rabar typography, no clipping, no black/corrupt image.

Instrumented serial 30 FPS: sampled peak tree RSS 1.04 GiB, sampled CPU 11.66 s.
Parallel 30 FPS: sampled peak tree RSS 1.19 GiB, sampled CPU 13.13 s.
Parallel 60 FPS: sampled peak tree RSS 1.61 GiB, sampled CPU 24.50 s.
All three: zero capture failures, zero identical consecutive captured frames;
A/V starts both 0 seconds, validated duration 2 seconds. Device GPU samples were 0%
and device VRAM approximately 404 MiB; these do not prove all GPU activity was absent.

Separate encoding-only transcode of baseline 60 FPS file:
- libx264 medium CRF18: 0.872 seconds, 216442 bytes.
- h264_nvenc p5 CQ18: 0.905 seconds, 581027 bytes.
NVENC is available and ran successfully, but no speed/size advantage was observed.
Its first full parallel-capture benchmark was interrupted; the subsequent completed
comparison is recorded below.

Receipts:
- workspace/benchmarks/baseline-cd085da2-ec0c-4ef0-8516-56c673ad852b/report.json
- workspace/benchmarks/optimized-c60a3d99-5e69-44fb-8043-449c257f06a7/report.json

Repeat after authorization:
```powershell
pnpm video:performance --project 2026-10-26_kak-ismael-tiktok-sponsorship_230_v2
```

## Completed validation after approval

The user approved benchmarking/test telemetry and the blocked work resumed normally.
- pnpm typecheck: passed.
- RUN_BROWSER_TESTS=1 RUN_AUDIO_TESTS=1 pnpm test: 127 passed across 20 files.
- Additional encoder-fallback.test.ts: 2 passed; simulated missing NVENC runtime returns libx264.
- 120 FPS shared-browser test: 24 decoded frames, uniform timestamps, zero capture failures;
  independent pages produce identical images at the same animation timestamp.
- Real cache smoke: first render captured 60 frames; second reports cacheHit:true and
  produces another unique export with the same validated frame count and size. Cache-hit
  render/mix/validation/export took approximately 1.50 seconds for the 1-second 360x640 clip.
- Interpolation smoke: 1080x1920, 60 FPS, 2 seconds, 120 frames, 262371 bytes,
  AAC audio present, uniform timestamps and full decode passed.
- Final production 60 FPS export completed and passed validation; details below.

Latest complete benchmark receipt:
workspace/benchmarks/optimized-5120aded-8414-4066-a116-c74642ed6e75/report.json

| Mode | Capture + encode seconds | Total including setup/mux/validation/inspection | Final bytes | Peak sampled tree RSS |
| --- | --- | --- | --- | --- |
| 30 FPS, one page, x264 | 7.499 | 8.793 | 243219 | 1.43 GiB |
| 30 FPS, two pages, x264 | 6.621 | 8.097 | 243219 | 1.21 GiB |
| 60 FPS, two pages, x264 | 14.369 | 16.416 | 268129 | 1.63 GiB |
| 60 FPS, two pages, NVENC | 14.366 | 16.508 | 600537 | 1.21 GiB |

All four passed: exact expected decoded frame count, uniform frame timestamps,
2-second duration, audio retained, A/V start zero, zero capture failures and zero
identical consecutive PNG captures. The latest 30 FPS parallel capture/encode was
11.7% faster than serial. The two observed optimized 60 FPS runs were 13.43 and
14.37 seconds versus the original 15.50 seconds (7.3-13.4% lower elapsed time).
Small single-machine samples vary with other activity; no universal gain is promised.

NVENC did not improve full-pipeline time meaningfully and more than doubled output
size at the selected quality settings. libx264 remains the preferred default.
Latest device-wide peak GPU samples were 27/24/39/36 percent and VRAM approximately
459/718/800/902 MiB in table order. These include unrelated desktop/GPU activity.
Sampled CPU seconds were 15.00/12.19/26.89/26.36, subject to exited-process sampling limits.

Known limits: no per-scene cache reuse; no model-specific acoustic timing accuracy
claim; no full 1080p/120 FPS benchmark; runtime NVENC recovery is implemented, but a
mid-render hardware failure was not induced. No excessive text motion blur was added.

Existing MP4 exports were not overwritten. The production script was not edited.
Rabar_021.ttf SHA256 remains 5875E28B47A50D01093760C55B3BEB90AA7F3C56FF9F5B60B6130AF04F5449A0.


## Final production export

mp2/2026-10-26_kak-ismael-tiktok-sponsorship_230_v3.mp4

- 1080x1920, native 60 FPS, H.264/yuv420p, 42.9 seconds, audio present.
- 2574 expected/generated/decoded frames; zero capture failures and zero identical
  consecutive captured PNGs. Uniform presentation timestamp checks and full decode passed.
- A/V starts both 0 seconds. Original voice and existing phrase-scene times preserved;
  this is not a new certification of acoustic word timing.
- Final file: 5650292 bytes (about 5.65 MB).
- Capture/encode elapsed: 258.974 s; capture batches: 257.356 s; pipe waits: 0.649 s;
  encoder finalization: 0.358 s; audio mix: 1.340 s.
- Total including setup, validation, representative frame extraction and export:
  285.662 s (about 4 min 46 s). Average delivered frames: 9.94 per wall-clock second.
- Sampled peak process-tree RSS: 1793003520 bytes (1.67 GiB). Peak Node RSS: 241426432.
- Device-wide GPU peak sample: 38%; device VRAM peak: 800063488 bytes (763 MiB).
- Fresh 60 FPS contact sheets inspected and identical regenerated sheets confirmed
  by SHA256. Full-resolution representative encoded frame inspected: RTL shaping,
  text/font, composition and object rendering intact.

Performance and resource receipts:
workspace/projects/2026-10-26_kak-ismael-tiktok-sponsorship_230_v3/renders/fc051d2a-cce0-48a7-9dd4-21fee1b28d3f/

The previous _v2 30 FPS export remains present and unchanged by this upgrade.

Full-file FFmpeg blackdetect (minimum interval 0.016 s, pixel threshold 0.02): exit 0, no black intervals detected. This is a diagnostic for this light-background export, not a universal visual-quality guarantee.

Export organization update (2026-10-26): production videos now live in `mp2/30fps/vertical/promotions/` and `mp2/60fps/vertical/promotions/`, named `kak-ismael-tiktok-sponsorship_30fps_v2.mp4` and `kak-ismael-tiktok-sponsorship_60fps_v3.mp4`. Both move hashes matched. Disposable benchmark MP4s have been removed; timing reports and inspection images are retained.
