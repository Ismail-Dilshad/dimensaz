# Local Sorani voice alignment

The source script is authoritative. No backend rewrites it, translates it, distributes
word timestamps by reading speed, or marks machine output reviewed. Run Python through
src/engine/audio-analysis.ts using the existing project .venv. The renderer stays local and
deterministic; model execution happens before preview/render.

## Current status and root cause (2026-10-26)

The environment is Python 3.14.5 in .venv, created with system-site-packages and without
its own pip. Faster-whisper 1.2.1, CTranslate2 4.8.3, NumPy 2.5.4, SciPy 1.18.1 and
SoundFile 0.14.0 import from the existing environment. Torch, Transformers and
Safetensors are absent. Neither configured Sorani model has installed weights.

Package resolution and model download were attempted. The local execution environment
cannot resolve pypi.org, download.pytorch.org or huggingface.co (Windows DNS error
11001). Pip's initial 'no matching distribution' message was therefore NOT proof of
Python incompatibility. PyTorch's official 2.10 release documents Python 3.14 support;
setup still resolves a compatible Windows binary wheel before installation.
No packages or model weights were installed in this run. Do not describe the system
as real-speech validated or the model choice as an accuracy winner.

Observed hardware: i5-11400H, 12 logical processors, 25,456,971,776 bytes physical RAM
(24 GB marketed), approximately 11-12 GiB available; GTX 1650 Max-Q 4 GiB, capability
7.5, driver 617.42, approximately 3.6 GiB free VRAM. D: has approximately 122 GiB free.
C: is actually the larger disk, but retaining the writable project cache on D: avoids
system-drive growth and leaves ample space. CIM inventory was unavailable; Windows
memory API, registry CPU name and nvidia-smi supplied the observations.

## Candidate selection and research

| Candidate | Evidence and decision |
| --- | --- |
| Akashpb13/Central_kurdish_xlsr | Primary **candidate** for known-script CTC alignment. XLS-R 300M, Arabic-based Central Kurdish vocabulary, Apache-2.0. Official safetensors: 1,261,983,732 bytes. Card has a contradictory Hungarian dataset tag and approximately 40% self-reported ASR WER; neither establishes timing accuracy. |
| rzgar/whisper-large-v3-sorani-kurdish-ckb-v2 | Alternative Sorani-only recognition/timestamp candidate. Official weights approximately 3.09 GB, Apache-2.0. The publisher specifies the Persian decoder token for this fine-tune. CPU INT8 CTranslate2 is the conservative path; conversion and speech quality remain untested locally. |
| BuzzASR/sorani-kurdish | Credible newer monolingual Sorani Whisper candidate with native tokenizer replacement and MIT license. Reported normalized WER varies by corpus. Research-only until its custom tokenizer, timestamp behavior and conversion are tested; it cannot be substituted into the Persian-token adapter. |
| NOESIS Qwen3 Forced Aligner 112LANG | Explicit ckb support, but the detailed card places ckb in Tier D (>25% order errors) and says it was not individually spot-checked. Research-only; sorting words or manufacturing short spans to hide inversions is forbidden here. |
| Kurdish OmniASR 7B Champion | Sorani ASR, 14.54 GB BF16 checkpoint. Exceeds available RAM as currently used and 4 GB VRAM; no verified low-memory Windows word-alignment route. Not selected solely on impressive self-reported ASR scores. |
| MMS-1b-all | Has a ckb adapter, but CC-BY-NC-4.0 is unsuitable for automatic commercial sponsorship use. |
| Stock Whisper / generic Persian / Kurmanji | Not a substitute for a Sorani model. WhisperX orchestration does not itself supply a verified Sorani aligner. |

Sources inspected:
- https://huggingface.co/Akashpb13/Central_kurdish_xlsr
- https://huggingface.co/Akashpb13/Central_kurdish_xlsr/blob/main/vocab.json
- https://huggingface.co/Akashpb13/Central_kurdish_xlsr/commit/d578ccc72e415e7f2738f43e4e2332a8590fd0a3
- https://huggingface.co/rzgar/whisper-large-v3-sorani-kurdish-ckb-v2
- https://huggingface.co/BuzzASR/sorani-kurdish
- https://huggingface.co/AMAImedia/NOESIS-Qwen3-Forced-Aligner-0.6B-112LANG-BF16
- https://huggingface.co/hawzhin/Kurdish-OmniASR-7B-Champion
- https://huggingface.co/facebook/mms-1b-all
- https://github.com/m-bain/whisperX/blob/main/whisperx/alignment.py
- https://pytorch.org/blog/pytorch-2-10-release-blog/
- https://opennmt.net/CTranslate2/quantization.html
- https://huggingface.co/docs/huggingface_hub/guides/download

## Setup, cache and repair

Internal commands (the agent runs these; users do not edit JSON):

```powershell
pnpm audio:doctor
pnpm audio:setup --install-deps --download-models --validate-model
pnpm audio:setup --model rzgar/whisper-large-v3-sorani-kurdish-ckb-v2 --download-models --convert
pnpm audio:setup --download-models --repair --validate-model
pnpm audio:precision-probe
pnpm audio:analyze --project ID --backend auto --refresh
pnpm audio:benchmark --project ID
```

Setup mutations require explicit install/download flags and prior session authorization.
The current user authorized compatible large packages/models. No additional confirmation
is needed for those installations when network access becomes available. Paid/gated
models or unclear rights still require resolution. Setup checks disk headroom, resolves
binary wheels, installs only through .venv, and logs receipts in workspace/history.
No Python interpreter migration or global package uninstall is performed.

VIDEO_MODEL_DIR overrides the default workspace/cache/audio-models. HF_HOME,
HF_HUB_CACHE, HF_XET_CACHE and pip download cache stay on the configured model drive.
Downloads use the official HF API, pin the returned commit, select safetensors/configs,
check sizes and provider LFS SHA-256 or Git blob hashes, and retain per-file SHA-256.
The primary model also pins its researched revision and known weights checksum.
No remote model Python is executed. Gated/private models stop with a diagnostic.

Interrupted downloads reuse their staging directory. A repair creates another snapshot
and keeps the old files. An installed pointer changes only after checksums pass. Existing
valid weights and conversions are reused. Do not delete old snapshots or HF caches.
Legacy unmanaged weights are not silently certified; their provenance and integrity must
be established before registering them. Model loading can be validated separately.
Model-load checks using silence are explicitly not speech accuracy tests.

## Hardware and inference

Auto tries CTC CUDA when PyTorch works and at least 2.5 GiB VRAM is free; then an
installed verified Sorani CT2 CUDA alternative with 3.5 GiB free; then CTC CPU,
CT2 CPU, and manual-assisted analysis. Every failure is retained in backend.attempts.
Partial candidates remain unreviewed; coverage/character agreement are diagnostics,
not comparative timing-accuracy scores. No arbitrary unsupported language fallback runs.

CTC uses FP32, batch size 1, up to six CPU threads, 12-second core chunks with two
seconds of context. GPU OOM retries four-second cores with one-second context, then
auto can try other backends/CPU. Emissions are stitched on the model convolution grid
without duplicate frames; Viterbi sees the complete exact script, including repeated
labels. Word times come from those acoustic frames, not duration/token ratios.
The trellis still has a 100-million-state-cell bound; very long transcripts can require
reviewed segmentation. Chunk-edge quality needs real-audio review.

The GTX 1650 reports CT2 float32, float16, int8, int8_float32 and int8_float16 capability.
That query is NOT a successful CUDA/cuDNN inference test or proof of fast FP16.
CTC stays FP32 pending a measured precision/accuracy comparison. The precision probe
measures small matrix kernels only. CT2 defaults to int8_float32 with one worker and
beam size 5; no unsupported CPU/GPU offloading is claimed.

## Output and manual review

Each schemaVersion 1 analysis retains legacy fields and adds originalWord,
normalizedWord, sentenceId, alignmentMethod and reviewRequired to every word.
Original Unicode, punctuation, whitespace and UTF-16 offsets remain unchanged.
Normalization is acoustic lookup only (NFC, Arabic yeh/kaf aliases, ignored punctuation).
Kurdish distinctions such as r/rr and l/ll are never collapsed. Every automatic word
has reviewed:false and reviewRequired:true. Very weak CTC evidence, invalid/overlapping
spans and unmatched ASR words remain null, with flags; no interpolation is used.

review.html provides waveform seeking, playback around a word, editable boundaries and
explicit per-word review. Changing a boundary clears its review. audio:correct creates
a separate correction; audio:apply creates a separate synchronized project revision.
All exact output still requires every word reviewed, valid ranges, exact tokens and the
matching original audio hash. Automatic confidence is an uncalibrated acoustic score.

`audio:evaluate --file ANALYSIS --reference REVIEWED_SAMPLES` reports boundary errors
only for explicitly reviewed, matching-hash samples. Reference includes reviewer,
reviewed:true, audioSha256, and words [{index,text,start,end}]. It does not approve the
remaining words. Mean/p95 boundary error, coverage and fraction within 80 ms are saved.

## Video integration

video:create now chooses auto analysis and preserves the alignment-review gate.
Successful analysis reuse includes Python/package identity, model integrity state,
installed revision manifests, script/audio hashes and pipeline code. Failed runs retry.
Reviewed cues already control word reveals, active-word highlighting and scene changes.
Optional project.json speechAnchors connect object appearances, 2D camera motion and
imported SFX to global source-word indices, an edge (start/end) and artistic time offset.
SFX anchors also name mediaId. Reapplying reviewed alignment retimes their media.at;
stale times block exact rendering. Object/camera anchors resolve against current scenes,
so separate revisions can regroup the unchanged script. One object/camera anchor per
scene and one anchor per SFX track match the existing compositor's limits.

## Verification and remaining work

See sorani-alignment-verification.md for actual run evidence. No real-speech accuracy,
GPU inference throughput, model loading time, peak inference RAM/VRAM or best-model
ranking is available until dependencies and weights can be downloaded. The actual
42.370625-second voiceover decodes, yields 21 measured pauses and 82 exact tokens.
All its letters fit the inspected CTC vocabulary (519 targets including delimiters),
but zero word boundaries have acoustic model evidence yet. They remain null.

The alternative model stores its 128-mel features inside processor_config.json.
Conversion exports a flat preprocessor_config.json and checks its feature dimension
against the official model config; falling back to the default 80 mel bins is forbidden.
Explicit --device cpu or cuda limits automatic backend selection to that device.

## Tokenizer compatibility repair (2026-10-26)

The downloaded rzgar checkpoint serializes extra_special_tokens as a list. Transformers
4.57 expects a dictionary for this field, producing AttributeError: list has no keys.
The local loader now maps this list to additional_special_tokens in memory and verifies
that the complete vocabulary-to-ID mapping equals the original tokenizer.json.
Conversion and validation share this loader; verified source bytes remain unchanged.
The real installed tokenizer passed with 51,866 vocabulary entries. Conversion retry
was blocked by the existing 10 GiB available-RAM safeguard after library imports.
Original weights are installed and verified, but this does not indicate CT2 readiness.
Resume without another download using:

```powershell
pnpm audio:setup --model rzgar/whisper-large-v3-sorani-kurdish-ckb-v2 --convert --validate-model
```
