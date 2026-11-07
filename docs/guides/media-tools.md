# Media tools

Optional Python tools for analysing footage, references and music, and for cutting
images out of their background. They live in `media_tools/` and run from the project
`.venv`. Every command prints JSON, accepts `--output FILE` to save it, and never
changes its inputs.

## Install

```bash
pnpm media:setup     # about 300 MB of packages into .venv
pnpm media:doctor    # what is installed, GPU providers, downloaded models
```

Models are separate and are downloaded only with `--allow-download`, after asking the
user: the face detector is about 0.2 MB; cut-out models are listed below. They are
stored in `workspace/cache/media-models/` (`VIDEO_MEDIA_MODEL_DIR` overrides it).

## Commands

| Command | Tool | Result |
| --- | --- | --- |
| `pnpm reelwright media silence FILE [--edl-out EDIT.json]` | auto-editor | Silent ranges to cut, the ranges kept, and a `cut` operation for the editor |
| `pnpm reelwright media scenes FILE` | PySceneDetect | Shots, cut times and the editing rhythm (average shot length, cuts per minute) |
| `pnpm reelwright media beats FILE` | librosa | Tempo, beat times, estimated bar starts and onsets |
| `pnpm reelwright media reframe FILE --aspect 9:16 [--edl-out EDIT.json]` | MediaPipe | Face track, the median focus point and a `reframe` operation |
| `pnpm reelwright media cutout IMAGE... [--out-dir DIR]` | rembg (BiRefNet) | New transparent PNGs, subject coverage and bounding box |

### Silence

`--threshold` (default 0.04) is the loudness below which audio counts as silent;
`--margin` (0.2 s) keeps a little audio around speech; `--min-cut` (0.3 s) ignores
short gaps so natural breaths stay. Review cuts near soft words, then apply the EDL
with `pnpm reelwright edit --edl EDIT.json` (add captions or other operations first).

### Scenes

The adaptive detector handles camera motion and fades; `--content` uses the plain
content detector. `--min-shot` (0.4 s) merges flashes shorter than that. Use the
rhythm figures to match a reference's pacing.

### Beats

Video files are read through FFmpeg. Bar starts assume four beats per bar from the
first beat (`--per-bar` to change); librosa does not detect true downbeats, so check
important cuts by ear.

### Reframe

Samples four frames a second, takes the largest face, and uses the median position.
If `focus.static` is false the speaker moves too much for one crop: split the video
with `media scenes` and reframe each shot.

### Cut-out

| Model | Download | Use |
| --- | --- | --- |
| `birefnet-general-lite` (default) | about 225 MB | Objects and products; fits a 4 GB GPU |
| `birefnet-general` | about 975 MB | Highest quality on objects and fine edges |
| `birefnet-portrait` | about 975 MB | People |
| `u2netp` | about 5 MB | Quick drafts |

Cut-outs run on the GPU when `onnxruntime-gpu` can load CUDA (`media:doctor` lists the
providers); otherwise on the CPU. `--alpha-matting` softens hair and fur edges. Check
every edge on a contrasting background before using a cut-out in a scene.

## Licenses

auto-editor (Unlicense), PySceneDetect (BSD-3-Clause), librosa (ISC), MediaPipe
(Apache-2.0, face model Apache-2.0), rembg (MIT), BiRefNet weights (MIT),
ONNX Runtime (MIT).
