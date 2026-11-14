# Third-party material

Tempoloom is licensed under the Apache License 2.0 (`LICENSE`, `NOTICE`). That covers the
code and the assets the project owns. The material below keeps its own terms. Every
bundled third-party file has a recorded open license; files without one were removed in
5.4.0.

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
| `NotoSansArabic-Variable.ttf` | Noto Sans Arabic | The Noto Project Authors |
| `NotoKufiArabic-Variable.ttf` | Noto Kufi Arabic | The Noto Project Authors |
| `Amiri-Regular.ttf` | Amiri | The Amiri Project Authors |

Kurdish (Arabic script) uses Vazirmatn, Noto Sans Arabic, Noto Kufi Arabic, Noto Naskh
Arabic and Amiri: each contains every Kurdish letter.

## Brand kit (`assets/brand/`)

Project-owned. The wordmark outlines are derived from Fredoka (OFL-1.1); the outlines
are artwork, and the font itself is listed above.

## Sound effects (`assets/sfx/`)

| Count | License | Notes |
| --- | --- | --- |
| 8 | CC0-1.0 | Kenney audio packs. |
| 3 | CC0-1.0 | Original procedural sounds made for this project. |

More sounds come from `pnpm tempoloom source search --kind sound` with their license recorded.

Per-file records: `assets/sfx/index.json` and the `.json` sidecar next to each sound.

## Generated assets (`assets/library/`, `examples/scenes/`)

AI-generated 3D object images and finished example scenes made by the project owner
(OpenAI output terms assign the output to the user). Part of the project's own assets.
See each `metadata.json`.

## Reference styles (`references/`)

Written style references (`style.md`, `style.json`, the project's own text) and the
project owner's motion sheets. Third-party frames are not stored. No reference videos
are stored.

## npm dependencies

| Package | License | Notes |
| --- | --- | --- |
| playwright | Apache-2.0 | Downloads Chromium separately (BSD-style and other licenses). |
| ffmpeg-static | GPL-3.0-or-later | Downloads an FFmpeg build that is GPL licensed. Used as a separate executable. |
| ffprobe-static | MIT | Ships FFprobe builds; FFmpeg binaries carry their own license. |
| zod | MIT | |
| lottie-web | MIT | Renders Lottie animations in Chromium |
| @napi-rs/keyring (optional) | MIT | Keeps the keys saved on the Models and keys page in the system keychain |
| three | MIT | Renders glTF 3D models in Chromium (`source render-3d`) |
| @jackwener/opencli | Apache-2.0 | Reads logged-in sites for `reach` and drives the browser for `browse` |
| fflate | MIT | Unzips the OpenCLI browser extension |
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
| yt-dlp (reference videos, study only) | Unlicense |

## Python (`audio_pipeline/requirements.txt`)

Installed on demand into `.venv`. See each package's license; speech models are
downloaded only after confirmation and recorded in `config/speech-models.json`
(the recommended Central Kurdish model is Apache-2.0).

## Downloaded assets (`pnpm tempoloom source`)

Assets downloaded from Poly Haven, Openverse, Iconify, Pexels, Pixabay and Freesound are
not part of the repository. Each keeps its own license in `source.json` next to the
files in `workspace/downloads/`; `pnpm tempoloom source credits` lists the attribution
each one needs.

## Reach (`pnpm tempoloom reach`, `pnpm tempoloom browse`)

Design and logic ported from [Agent Reach](https://github.com/Panniantong/agent-reach)
(MIT License, Copyright (c) 2025 Agent Eyes). Tools used:

| Tool | License | How it is used |
| --- | --- | --- |
| OpenCLI 2.0.2 (npm) | Apache-2.0 | Read commands for logged-in sites; browser commands |
| OpenCLI browser extension 1.0.26 | Apache-2.0 | Downloaded once from OpenCLI's GitHub release, hash-checked, loaded into the Tempoloom browser |
| yt-dlp | Unlicense | Video info, search, subtitles, study-only downloads |
| CloakBrowser 0.6.3 (optional) | MIT (Python package); its browser download has its own terms | Optional browser engine, only when chosen |
| Jina Reader, Exa search | Hosted services | Public page text and web search; no key |
