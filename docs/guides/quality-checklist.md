# Quality gates

- Confirm scene text concatenation equals the source JavaScript string exactly, including Unicode and whitespace.
- Confirm actual primary/fallback font loading and cmap coverage for the supplied script.
- Inspect Sorani/Badini joins, Arabic marks, Persian ZWNJ, Latin Kurdish accents, punctuation, numbers, and mixed-direction phrases.
- Inspect every returned contact sheet, including entrance, hold, exit, and word-cue frames.
- Confirm readable text stays within safe margins without clipping.
- Confirm source footage is present, not stretched, and covered by the timeline.
- Confirm illustration provenance; no invented logos or claims.
- Inspect fresh previews before --approve-preview; changed inputs or rendering code invalidate approval.
- Exact speech requires complete reviewed word cues bound to the actual voice hash; estimated drafts use phrase holds.
- Validate H.264, yuv420p, dimensions, FPS, duration, and required audio streams.
- Decode the full MP4 and inspect the returned encoded-frame.png.
- Confirm unique export names inside mp2/ and preserve earlier projects/media/outputs.
- State verification scope honestly: text-language coverage does not establish ASR accuracy or dialect translation.
