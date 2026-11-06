# Kinetic typography

Use textTreatment: kinetic for new text-led work. This renders typography directly on the background without SaaS cards, borders, shadows or decorative containers. Set background: solid and white: #FFFFFF for plain white. Disable visuals and progress unless requested. Keep old classic scenes unchanged.

Choose word-slide-up for cumulative whole-word entrances; center-word-swap for one complete shaped word at the center at a time; phrase-rise for composed multiword emphasis; smooth-replacement for a soft vertical replacement. Vary these intentionally across hooks, explanations and CTA. Centered words use a larger fitted size. scene.highlights contains exact source character ranges; scene.emphasisScale (1 to 1.6, default 1.22) enlarges those whole words and primary sets their color. Never split Arabic letters.

Use project.json as the authoritative plan. Preserve concatenated scene text including whitespace. Select meaningful key words manually rather than trusting longest-token heuristics alone. Short clauses improve kinetic pacing; keep complete wording and measured duration.

Word animation cadence is a visual scheduling effect, not evidence of spoken-word alignment. Without a reliable aligner, sentence or clause boundaries may use measured pauses but must remain marked as estimated. Retain the unchanged voice speed and disclose this limitation. Never invent verified word cues.

Inspect all entrance, hold and exit previews and additional early/mid word frames. Verify text fits safe margins, keyword sizing, RTL order, exact script and deterministic seeking. Render and fully decode with FFmpeg; validate with FFprobe. Legacy projects missing textTreatment load as classic, so prior layouts remain reproducible.
