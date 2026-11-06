# Footage and audio

Import into each project's input/; originals are copied and never modified.
FFprobe metadata includes duration, dimensions, FPS and audio streams.
A project uses its first video as full-scene footage and its first image as a
supporting object. Extra imported assets remain available for future revisions.
The current engine is not a multi-clip nonlinear editor.

Fit modes: cover (crop), contain (letterbox), background-fill (blurred backdrop).
The browser seeks to each output timestamp; shorter footage holds its last frame.
A pale scrim protects text contrast. Browser decoding requires a supported source
codec; convert unsupported MOV/other codecs with FFmpeg before rendering.
Frame-accurate source seeking should be verified against the source for critical
edits; no assumption of identical timestamps across variable-FPS footage.

Original video audio is preserved by default. Voice and sound effects play at
their explicit imported at offsets; music loops. Configure per-kind volumes,
fadeIn, fadeOut and normalize. Loudness normalization and limiter precede AAC
encoding. Shorter original audio is padded with silence to the timeline end.
A voiceover longer than the timeline is rejected. Extend scenes intentionally.
No transcription, forced alignment, TTS or generative audio service is bundled.
Import reliable timings yourself; never invent precise speech timestamps.

Text-to-video defaults to silent. Revisions copy media and source settings.
Final export uses H.264/yuv420p/faststart and optional AAC audio.
