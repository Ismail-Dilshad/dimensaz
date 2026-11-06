# Speech-first timing

Default new voice briefs to sync: exact. Keep the voice speed unchanged. Obtain original provider timing, a local forced alignment result, or manually reviewed acoustic timings. A transcript, silence detector, word count or proportional reading rate cannot prove word alignment.

Use brief.wordAlignment with audioSha256, method (provider, forced-aligner or manual-review), source, reviewed: true and words [{text,start,end}] in absolute seconds. Every complete script token must match exactly, including punctuation. Review actual voice against cues before marking reviewed. Cues must be ordered, nonoverlapping and inside the probed audio duration. The file hash binds the timing to the imported recording.

Use internal video:align --project ID --file alignment.json to create a separate aligned revision. For original provider character timing, add --provider-characters --reviewed --source DESCRIPTION. Character arrays must join to the exact script. Do not normalize or replace source text to fit guessed timing. The adapter derives word boundaries only from supplied character timestamps.

Scene wordCues use local start/end plus exact source from/to offsets. The renderer follows their start times; centered words hold until the next genuine cue, and slide-ups reveal at cue starts. Final visibility is quantized to the 30 FPS frame grid (up to one frame). Machine timing is not automatically trustworthy: review it, especially Sorani, before claiming synchronization.

Exact mode rejects final render if evidence is missing, the voice hash changes, any word is uncovered or timings are invalid. Previews remain available to inspect design. If alignment is unavailable, explain the concrete blocker; an estimated draft may show full phrase holds with clearly labeled limitations. Never imply that a skill instruction alone supplies acoustic timing.

## Authorized automatic acoustic exports

For an explicit request to complete a video automatically, `voiceTiming: "acoustic"` is an opt-in alternative to `required` (human/provider-reviewed) and `estimated` (reading-time draft). It does not set any reviewed flags. `src/engine/acoustic-alignment.ts` binds a pinned CTC analysis to the original voice SHA-256, exact script, whole-word offsets, full cue coverage and unchanged analysis bytes. It rejects null/overlapping/out-of-range times, unsupported backends/languages, transcript agreement below 0.9, unresolved flags and acoustic scores below 0.15. These are operational checks, not a calibrated accuracy guarantee.

Machine confidence and low-score/very-short flags are preserved. All rendered cues must equal the stored acoustic evidence, and its bytes are included in the render fingerprint. Render/export validation checks that source audio and analysis have not changed. The default `required` gate and reviewed input schema are unchanged. Automatic completion authorization is not a claim of human listening review.

The White Grid Kinetic Typography export uses this explicit mode following the user's request to finish autonomously. Its CTC result covers 82/82 words; the second Sorani Whisper model supplied 66 exact-token timing matches for comparison. No missing timestamps were interpolated. A timing sidecar records lower-confidence words and the lack of a human timing-accuracy benchmark. Existing production exports remain intact.
