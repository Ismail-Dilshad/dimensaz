# Script-led explainers

## Audit (2026-11-01)

The supplied MP4 is a vibe reference, not a palette or asset lock.

- Scripting: `reference-storyboard.ts` splits punctuation and selects the first four
  tokens for headlines. It does not understand the audience, rhetorical beat or
  repeated message. Source preservation and complete-word range checks already work.
- Icons: `asset-selector.ts` supplies broad role fallbacks. Reference assets are
  pinned and reviewed well, but no cross-scene meaning/reuse ledger exists. A phone
  can be technically valid while its empty screen explains nothing.
- Theme: `reference-policy.ts` and the production skill route every new job to seven
  fixed looks. `applyReferenceStyle` restores that palette/background. The Director
  supports overrides but has no recent-theme comparison. Reusing a reference repeats
  specifics as well as its feel.
- Layout: reference rectangles are flexible but authored individually. No uniform
  role library or automatic icon/text collision gate exists. Preview QA mostly reports
  text/font information; a successful capture does not establish balance.
- Motion: reference backgrounds drift; heroes can float; entrance timing scales with
  scene length. Kinetic text often animates words or arbitrary groups of three, rather
  than semantic phrases. Optional ghost text and multiple simultaneous motions can
  distract. These features must remain available to saved reference projects.
- Audio: hash-bound reviewed cues and explicitly authorized automatic CTC cues are
  strong existing controls. Never replace them with reading-speed estimates. The
  mixer already supports licensed events, music and narration ducking. Audition
  availability must be reported honestly.
- Rendering: deterministic Chromium frames, FFmpeg validation, versioned manifests,
  preview fingerprints and non-overwriting exports already work. Existing samples
  target words/keyframes, not a uniform half-second encoded-frame audit. There is no
  reusable captions/silent-loop export or editorial score gate.

## New workflow contract

Use the registered `script-explainer` preset for a clean explainer without an explicit
reference-style request. Legacy request defaults remain decodable. The agent supplies
an honest semantic brief (topic, industry, audience, emotion, tone, domain) and exact
contiguous scene slices. This is agent analysis, not a claim that keyword matching
understands arbitrary scripts. `video:theme` chooses a deterministic theme from that
brief and recent manifests, applies explicit overrides last, and explains its choice.
The final theme snapshot and scene plans live in project.json. No runtime AI call.

Native vector symbols are registered code geometry, not downloaded assets. Search
the asset library first; external imagery still uses asset review and assetLocks.
Theme history records script hash, theme and icons per project under
workspace/history/explainer-themes. Exact and near repeats are surfaced, including
user-forced repeats. Do not substitute an irrelevant icon simply to pass diversity.

Each scene specifies a role template, one main symbol, at most three meaningful
supports, a reason for each, exact phrase ranges, cue-derived reveal starts, highlights,
and a transition reason. Phrase ranges cover the complete scene text, including
whitespace. Repeated user wording is preserved and flagged; callbacks require an
explanation. Templates share safe zones and reflow for vertical, square and landscape.
Stat templates require a supplied number; comparisons and steps explain their
relationships. No letter DOM animation, empty devices or automatic floating.

Use one cubic easing and a saved 0.4–0.6s duration. Icon entrances are staggered;
subsequent holds are static. Text reveals are quiet, whole-phrase entrances. Slide
handoffs clear outgoing symbols before incoming ones; the shared visual anchor is
stationary. This is a matched slide, not a physical object morph. Text remains visible
through its final narration beat. Reduced motion removes travel. Never shorten the
recording to meet a reading-speed score.

`video:duplicates` and `video:frame-qa` operate on saved manifests. Preflight samples
every 0.5s plus transition/reveal boundaries and checks DOM geometry, source ranges,
font coverage, contrast and declared symbol reuse. Encoded QA extracts every 0.5s
and reports pixel signatures for repeated samples. Static holds are expected repeats.
Pixel hashes do not establish semantic uniqueness; DOM direction/glyph coverage do
not prove correct Arabic shaping. Inspect actual encoded letters and compositions.

## Review and delivery

1. Save a storyboard (Section | Copy | Icons | Position | Motion | Duration) and one
   still per scene before full rendering. Check first-2s hook and final CTA.
2. Inspect every still and contact sheet. Fix hard geometry/contrast/source failures.
   Reading-density warnings are editorial checks, never invented voice timestamps.
3. Record clarity, repetition, smoothness, readability and visual balance scores,
   each with observed evidence. Minimum 4/5 in every category; fix lower scores in
   a separate revision. Scores are editorial judgments, not machine certainty.
4. Use the existing video:create preview approval and export lifecycle. After encode,
   extract half-second frames, inspect transitions at full resolution, and complete
   the critic report against the export hash. Do not mark listening review complete
   when no listening happened. If timing was automatically authorized, say so.
5. Export SRT with original text and phrase cue times, and a short silent preview
   with a half-second fade at each end for looping. SRT display trimming does not
   change project/script bytes. Alternative aspect ratios use the same templates;
   create a new project/revision and review fresh previews.

See the helper CLI help for schemas/examples. Explicit aesthetic choices override
automatic variation; unsupported requests need a concrete explanation, not a silent
fallback. The incomplete placeholder in the user's request adds no requirement.
