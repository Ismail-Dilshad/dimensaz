# Media tools

Optional tools for analysing footage, references and music, cleaning audio, stabilizing
video, cutting images out of their background and rendering Lottie animations. They live in `media_tools/` and run from the project
`.venv`. Every command prints JSON, accepts `--output FILE` to save it, and never
changes its inputs.

## Install

```bash
pnpm media:setup     # about 350 MB of packages into .venv (Demucs reuses the installed torch)
pnpm media:download # optional: fetch all models now (about 305 MB, once)
pnpm media:doctor    # what is installed, whether torch sees the GPU, downloaded models
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
| `pnpm reelwright media separate FILE [--stems vocals\|all]` | Demucs | A new `NAME-stems/` folder: `vocals.wav` and `music.wav` (or drums, bass, other, vocals) |
| `pnpm reelwright media quality FILE` | OpenCV | Sharpness, exposure, contrast, clipping and noise, with flagged frames |
| `pnpm reelwright media motion FILE` | OpenCV | Camera pans, zoom and shake, overall and per second |
| `pnpm reelwright media stabilize FILE [--out FILE]` | OpenCV + FFmpeg | A stabilized copy with the original audio, and the shake before and after |
| `pnpm reelwright media lottie FILE.json [--format mov\|webm\|png\|mp4]` | lottie-web in Chromium | The animation as transparent ProRes 4444 `.mov`, VP9 `.webm`, PNG frames, or `.mp4` on a colour |
| `pnpm reelwright media lottie-info FILE.json` | | Size, length, frame rate, layers, images and expressions |

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
| `birefnet-general-lite` (default) | about 225 MB | Objects and products; a few seconds per image on a CPU |
| `birefnet-general` | about 975 MB | Highest quality on objects and fine edges |
| `birefnet-portrait` | about 975 MB | People |
| `u2netp` | about 5 MB | Quick drafts |

Cut-outs run on the CPU with ONNX Runtime, the same package faster-whisper uses (the
GPU build of ONNX Runtime cannot be installed next to it). `--alpha-matting` softens hair and fur edges. Check
every edge on a contrasting background before using a cut-out in a scene.

### Separate

`htdemucs` (default, about 80 MB) splits voice from everything else; `--stems all` gives
drums, bass, other and vocals. `htdemucs_ft` (about 320 MB) is slower and a little
cleaner; `htdemucs_6s` adds guitar and piano. It runs on the GPU when torch has CUDA
(`media:doctor` shows `torchCuda`). Video files are read through FFmpeg. Always listen
to the vocals stem before using it as the final voice: heavy noise can leave artifacts.

### Quality

Samples one frame a second (`--samples-per-second`) at a fixed 720 px width.
Sharpness is the variance of the Laplacian: compare takes of the same scene rather than
different scenes. Flags: `blurry`, `dark`, `bright`, `clipped-highlights`,
`crushed-shadows`, `noisy`, `black`. Images get a single measurement.

### Motion and stabilize

`motion` tracks features between frames and reports shake (jitter around the smoothed
camera path, in pixels at 640 px width); above 1.5 it suggests stabilizing.
`stabilize` smooths the path over `--smoothing` seconds (1.0), zooms in by `--zoom`
(1.06) to hide moving edges, keeps the audio and reports the shake before and after.
Intentional pans survive; only the jitter is removed.

### Lottie

Each frame is drawn by lottie-web (SVG renderer) in an offline Chromium page and
encoded with FFmpeg. Only the JSON and files in its own folder can load. `.mov`
(ProRes 4444) works in every editor; `.webm` is smaller and plays in browsers. Use
`--width` or `--scale` for size, `--loops` to repeat, `--fps` to change the frame rate.
Place the result on footage with the editor's `overlay` operation. Check the license
of any Lottie file you did not make.

## Licenses

auto-editor (Unlicense), PySceneDetect (BSD-3-Clause), librosa (ISC), MediaPipe
(Apache-2.0, face model Apache-2.0), rembg (MIT), BiRefNet weights (MIT),
ONNX Runtime (MIT), Demucs and its weights (MIT), OpenCV (Apache-2.0),
lottie-web (MIT).
