# Third-party material

Reelwright's own license (pending, see `LICENSE.todo.md`) covers only the code and
assets the project owns. The material below keeps its own terms. Status values come
from the repository's own records; "unknown" means no license is recorded.

## Fonts

### Open-license fonts (`assets/fonts/open/`)

All are under the SIL Open Font License 1.1. Full texts are in
`assets/fonts/open/licenses/`. Source: the [google/fonts](https://github.com/google/fonts) repository.

| File | Family | Copyright |
| --- | --- | --- |
| `Inter-Variable.ttf` | Inter | The Inter Project Authors |
| `Fredoka-Variable.ttf` | Fredoka | The Fredoka Project Authors |
| `SpaceGrotesk-Variable.ttf` | Space Grotesk | The Space Grotesk Project Authors |
| `DMSerifDisplay-Regular.ttf` | DM Serif Display | Colophon Foundry, Adobe and Google |
| `NotoNaskhArabic-Variable.ttf` | Noto Naskh Arabic | The Noto Project Authors |
| `Vazirmatn-Variable.ttf` | Vazirmatn | The Vazirmatn Project Authors |

### Kurdish fonts (`assets/fonts/*.ttf`, `assets/fonts/*.otf`)

**License: unknown.** These files were supplied by the project owner. Redistribution
rights have not been confirmed. Confirm before a public release, or remove the files
from the published package and document how users supply them.

## Brand kit (`assets/brand/`)

Project-owned. The wordmark outlines are derived from Fredoka (OFL-1.1); the outlines
are artwork, and the font itself is listed above.

## Sound effects (`assets/sfx/`)

| Count | License | Notes |
| --- | --- | --- |
| 11 | CC0-1.0 | Kenney audio packs. The only sounds the agent places automatically. |
| 31 | **unknown** | No license recorded. Several filenames name third parties (Dragon Studio, Freesound community, Universfield). Treat as not redistributable until verified. |

Per-file records: `assets/sfx/index.json` and the `.json` sidecar next to each sound.

## Generated assets (`assets/library/`, `examples/scenes/`)

AI-generated 3D object images and finished example scenes. Records say "OpenAI output
terms" or "generated output; reference rights unverified". See each `metadata.json`.

## Reference images and videos (`references/`)

Third-party design references and motion examples collected for study. **Rights not
recorded.** A full YouTube tutorial download is deliberately kept out of git and linked
to its source instead. References are
not used as final video artwork. Review before publishing the repository.

## npm dependencies

| Package | License | Notes |
| --- | --- | --- |
| playwright | Apache-2.0 | Downloads Chromium separately (BSD-style and other licenses). |
| ffmpeg-static | GPL-3.0-or-later | Downloads an FFmpeg build that is GPL licensed. Used as a separate executable. |
| ffprobe-static | MIT | Ships FFprobe builds; FFmpeg binaries carry their own license. |
| zod | MIT | |
| lottie-web | MIT | Renders Lottie animations in Chromium |
| esbuild | MIT | |
| typescript, tsx, vitest, @types/node | Apache-2.0 / MIT | Development only. |

## Media tools (`media_tools/requirements.txt`)

Optional, installed into `.venv` by `pnpm media:setup`. Models are downloaded only on
request into `workspace/cache/media-models/` and are not part of the repository.

| Package or model | License |
| --- | --- |
| auto-editor (fetches its own binary from the project's GitHub releases) | Unlicense |
| PySceneDetect | BSD-3-Clause |
| librosa | ISC |
| MediaPipe and the BlazeFace short-range face model | Apache-2.0 |
| rembg | MIT |
| BiRefNet and U²-Net cut-out weights (rembg releases) | MIT / Apache-2.0 |
| ONNX Runtime (CPU build, shared with faster-whisper) | MIT |
| Demucs and its pretrained weights (downloaded on request) | MIT |
| OpenCV (opencv-contrib-python) | Apache-2.0 |

## Python (`audio_pipeline/requirements.txt`)

Installed on demand into `.venv`. See each package's license; speech models are
downloaded only after confirmation and recorded in `config/speech-models.json`
(the recommended Central Kurdish model is Apache-2.0).
