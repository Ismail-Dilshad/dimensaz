# Sorani alignment implementation and verification record

Status: pipeline implementation and synthetic video integration tested; real Sorani
model inference, timing accuracy, and the client's final synchronized video remain blocked.
This record describes the 2026-10-26 task and checks completed in its session.

## Root cause and installation outcome

The existing .venv uses Python 3.14.5 with system-site-packages. Torch,
Transformers, Safetensors and both configured model weight sets were missing.
Existing Faster-whisper and CTranslate2 installations do not supply a Sorani model.
Installing packages alone would therefore not repair alignment.

Actual package/model installation attempts failed because the execution environment
could not resolve download.pytorch.org, pypi.org and huggingface.co (DNS error 11001).
No new dependency or model weight was installed. Model weights occupy **0 bytes**
in workspace/cache/audio-models. This is an environmental blocker, not an accuracy
result, a rejection of large models, or proof that Python 3.14 is incompatible.

Setup receipts (relative to project root):
- workspace/history/audio-setup-a4e6798a-58eb-4525-b232-31cf635acd8b.json
- workspace/history/audio-setup-2336598e-12fa-4e88-8af9-93d6249ea58f.json

## Implementation delivered

- Hardware/RAM/disk discovery; supported backend precision discovery; conservative
  FP32 CTC, batch size one, overlapping acoustic chunks, bounded CUDA retry and CPU fallback.
- Official model downloads with pinned revisions, provider integrity checks where
  available, local manifests, persistent configurable VIDEO_MODEL_DIR, disk reserves,
  and non-destructive cache repair. No remote model code is executed.
- Whisper conversion preserves the official nested 128-mel feature configuration;
  explicit CPU mode never attempts GPU inference.
- Primary candidate: Akashpb13/Central_kurdish_xlsr, XLS-R 300M CTC;
  official safetensors size 1,261,983,732 bytes. Alternative candidate:
  rzgar/whisper-large-v3-sorani-kurdish-ckb-v2, approximately 3.09 GB original weights,
  planned CTranslate2 INT8 conversion. These are provisional, not local accuracy winners.
- Source-preserving acoustic alignment, explicit null unresolved spans, sentence IDs,
  original/normalized words, confidence/method/review fields, and manual correction UI.
- Hash-bound review gate, model-aware analysis cache invalidation, benchmark receipts,
  and comparison against explicitly reviewed reference boundaries.
- Optional source-word anchors for object/camera/SFX events; applying revised reviewed
  timings retimes events. Existing text reveals/highlights consume reviewed cues.

Observed hardware: i5-11400H, 12 logical processors, 24 GB RAM (approximately 11-12 GiB
available), GTX 1650 Max-Q 4 GiB with approximately 3.6 GiB free, compute capability 7.5,
NVIDIA driver 617.42. D: had approximately 122 GiB free. Default cache is
D:/kurdish-text-animation-video/workspace/cache/audio-models. GPU FP16 is not assumed
faster or selected by default. The precision microbenchmark could not run without Torch;
CTranslate2 capability enumeration is not evidence of successful inference.

## Actual validation results

| Check | Result |
| --- | --- |
| pnpm typecheck | Passed |
| RUN_BROWSER_TESTS=1 RUN_AUDIO_TESTS=1 pnpm test | 125 tests passed across 19 files |
| pnpm test:audio | 20 tests passed |
| video:doctor | FFmpeg, FFprobe and Chromium available |
| Existing voiceover load | Passed: 42.370625 seconds |
| Script identity | Exact request script preserved |
| Script lexical coverage against inspected CTC vocabulary | 82 words, 519 CTC targets including delimiters, zero unsupported characters |
| Pause analysis | 21 measured pauses; not used to manufacture word times |
| Real aligned words | 0/82; all unresolved and unreviewed |
| Real model loading/inference | Blocked by missing dependencies/weights and network resolution |
| Reviewed acoustic accuracy | Not measured; no real boundaries available to compare |
| GPU precision/performance | Not benchmarked; Torch unavailable |
| Original project previews | Both fresh contact sheets inspected; phrase-hold previews only |

Real benchmark receipt:
workspace/projects/2026-10-26_kak-ismael-tiktok-sponsorship_230/audio-benchmark-18d52cc6-3054-408e-9396-9ed278827040.json

Its four candidate attempts failed: CTC CPU 2.589 s, CTC CUDA 2.371 s,
Whisper CPU 2.444 s and Whisper CUDA 2.440 s. Those numbers are failed-attempt
elapsed times, **not** inference benchmarks. Peak real-inference RAM/VRAM and model
accuracy remain unknown. The implementation records those measurements when a backend runs.

## Encoded synthetic integration proof

An isolated fixture uses generated tones with known intervals, not speech or AI alignment.
Its two reviewed synthetic cues are 0.25-0.65 s and 1.25-1.75 s. The second cue anchors
an object, camera motion and a synthetic click. Creation and a separate revision use the
normal versioned manifest workflow. The old client project was not overwritten.

Export:
mp2/2026-10-26_alignment-integration-synthetic-fixture-not-speech_252_v2.mp4

Result: 360x640, 12 fps, 2.25 seconds, audio present, 55,350 bytes;
full-stream decode validated. Fresh preview contact sheet and encoded frames at the
first word and second event were visually inspected: Kurdish shaping is intact,
the second word and object appear at their scheduled cue. This verifies integration,
not Sorani acoustic accuracy.

Encoded inspection frames:
- workspace/projects/2026-10-26_alignment-integration-synthetic-fixture-not-speech_252_v2/renders/7179ceff-eacf-4033-971a-ca3c0b996c5e/encoded-frame.png
- workspace/projects/2026-10-26_alignment-integration-synthetic-fixture-not-speech_252_v2/renders/7179ceff-eacf-4033-971a-ca3c0b996c5e/encoded-event-frame.png

## Original production job and recovery

The user's voiceover was moved, with integrity verification, to:
workspace/inbox/audio/kak-ismael-tiktok-sponsorship-voiceover.mp3

Job: 2026-10-26_kak-ismael-tiktok-sponsorship_230, currently alignment-review.
Latest unresolved analysis:
workspace/projects/2026-10-26_kak-ismael-tiktok-sponsorship_230/audio-analysis/61c316a1-1eb7-49b1-a53c-129fb120b64a/alignment.json

The client's exact synchronization is intentionally not approved. When normal outbound
DNS/network access is available, resume the authorized setup using the existing .venv:

```powershell
pnpm audio:setup --install-deps --download-models --validate-model
pnpm audio:setup --model rzgar/whisper-large-v3-sorani-kurdish-ckb-v2 --download-models --convert --validate-model
pnpm audio:precision-probe
pnpm video:create --resume 2026-10-26_kak-ismael-tiktok-sponsorship_230
```

Then benchmark the installed candidates, listen to the real voiceover while correcting
uncertain boundaries, evaluate reviewed samples, apply hash-bound reviewed cues, inspect
fresh previews, and render a uniquely named final export. See local-audio-pipeline.md
for command details and evaluation reference format. Model conversion and inference
remain runtime integration risks until those installations succeed.

Protected files retained:
- assets/Rabar_021.ttf SHA256 5875E28B47A50D01093760C55B3BEB90AA7F3C56FF9F5B60B6130AF04F5449A0
- references/original-skill-v2.md SHA256 2FC6873B66715966F71CBE6BD523BE8BF4CA202682ADE8CC58A00C296B5D4D8C

No previous exports, model caches, or production projects were deleted. Automatic
outputs never count as reviewed, and model-card ASR scores are not timing accuracy.
