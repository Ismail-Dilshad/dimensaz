# Reference motion rendering

This adds a project-local adapter for custom-motion-shorts. It renders through the
existing deterministic Chromium/FFmpeg pipeline; it is not an image/video-model backend.

## Reference locations

Style images and their original image/motion prompts live together under
`references/styles/style-1` through `style-7`.
The original archive lives at
`references/style-library/shared/original-packages/custom-motion-shorts.skill`. The
adapted workflow is the [style card guide](style-cards.md).

## Choosing a style

Run video:reference list. Production presets are reference-style-1 through
reference-style-7. The same names are registered Style Director presets.
The agent follows the [style card guide](style-cards.md) for end-to-end execution.

| Folder | Preset | Look |
|---|---|---|
| style-1 | reference-style-1 | Blue/white discovery metaphors |
| style-2 | reference-style-2 | Blue/white mechanisms and explanation |
| style-3 | reference-style-3 | Black/red direction and goals |
| style-4 | reference-style-4 | Cream/orange action and visibility |
| style-5 | reference-style-5 | Emerald/lime comparison |
| style-6 | reference-style-6 | Black/red problem diagnosis |
| style-7 | reference-style-7 | Lavender glass trust and quality |

The complete lock is stored in config.referenceStyle, not fetched again at render
time. It contains colors, material/lighting guidance, grid geometry/spacing/opacity,
texture and line count/angle/opacity. White-on-orange in the source is changed to
espresso-on-orange for readable contrast; original reference images are unchanged.
Material and lighting strings guide asset acquisition; CSS does not relight a raster.
The motion label guides creative planning; authored entrance, travel and loop fields
control rendering. The label alone does not change the animation sampler.

## Planning and rendering

1. Save exact UTF-8 narration.
2. Run video:reference plan --style style-1 --file SCRIPT.txt --out NEW.json.
3. Complete the returned request.scenes, metaphor placeholders, hero IDs and parts.
4. Save only its request object as a production request JSON.
5. Run video:create --manifest REQUEST.json.
6. Resolve asset-review with --storyboard, alignment-review when needed, and pilot-review
   with an inspected --review report. Inspect all full preview evidence, then resume the SAME job
   with --approve-preview. Inspect the encoded frame and validated unique export.

The planner deliberately leaves hero IDs absent. It does not claim a keyword lookup
is creative direction. Running an incomplete reference request returns a resumable asset-review
board with local candidates, separate-part generation guidance and source handoff instructions. It never silently falls back to a small generic icon.
Draft durations reflect visual reading time and planned holds. Bound narration cues determine the actual spoken scene boundaries.
The full script and every scene's source slice remain exact. An optional headline
range selects complete source words for the shorter on-screen reference headline.

## Scene schema

Normal scene fields (id, exact text, start, duration, direction, role, animation,
layout, highlights) still apply. Use scene.asset for the dominant hero and add:

~~~json
{
  "referenceMotion": {
    "metaphor": "A message leaves a phone and travels toward the viewer",
    "layout": "headline-top",
    "headline": {"from": 0, "to": 7},
    "entrance": "rise",
    "transition": "wipe",
    "camera": "push",
    "rotation": -4,
    "ghost": false,
    "layers": [
      {
        "asset": "ACTUAL_IMPORTED_ASSET_ID",
        "role": "part",
        "x": 0.65, "y": 0.58, "width": 0.22, "height": 0.16,
        "depth": "front", "delay": 0.15,
        "entrance": "pop", "rotation": -8,
        "travelX": 0.1, "travelY": -0.12, "loop": "float"
      }
    ]
  }
}
~~~

The example headline offsets must be replaced with real whole-word offsets from that
scene's text. Omit headline to render the entire exact scene text. Offsets use the
same UTF-16 convention as existing word cues/highlights, not byte offsets.

Layouts: headline-top, headline-bottom, headline-left, headline-right.
Entrances: rise, drop, left, right, pop, fade.
Transitions: fade, wipe, push, cut. Cameras: static, push, pull, pan.
Layer x/y are center coordinates relative to the frame; width/height and travel
distances are fractions of the frame. Delay is a fraction of scene duration.
Composition rectangles instead use top-left x/y and w/h. Layer images use contain
fitting inside those boxes, so transparent padding affects visible size and pivot.
Loops: none, float, pulse, rotate. Maximum 16 additional layers, at most two accents;
part layers belong to the dominant physical mechanism. Check paths throughout motion,
not only their endpoints, for mobile safe-area violations.

All selected layer IDs are pinned, hashed into preview approval, loaded offline and
included in export provenance, including parts absent from scene.asset.
Reduced motion disables animated entrances, looping, camera and scene transitions.
Authored parts sample their final keyframe; generic travel is held at its resolved
position. A final opacity of zero stays hidden. Base rotation and composition remain;
inspect this static state rather than assuming all parts will be visible. Voice word
cues still control visibility.
Legacy manifests without reference fields retain their original composition.

## Asset production

Use existing assets:library search/assess/check/style/similar and import/download.
A complete poster is not an independent-motion asset. Obtain separate phone, bubble,
plane, dart, target, drawer, gauge/liquid, etc., as the mechanism requires.
Use code for suitable geometry; use available image tools for organic/photoreal
cutouts; use verified official sources for reusable imagery. The project does not
automatically connect ChatGPT image tools or Internet search to a standalone CLI.
The agent performs these steps, records provenance, and gives the renderer local IDs.
Source-provider login/payment, missing tools and unresolved rights remain explicit.

Keep Kurdish lettering out of generated raster artwork. Real Rabar 021 typography
is composed independently. No source image is automatically cropped or destructively
edited. Existing source assets, reference files and exports are preserved.

## Limits and checks

The renderer provides independent 2.5D transforms, not mesh rotation, articulated
characters, liquid simulation, physical glass refraction or frame-perfect recreation
of imagined reference motion. These need prepared footage/assets or additional code.
Photoreal likeness depends on the actual hero assets; a code fixture verifies rendering,
not visual equivalence. Do not claim the uploaded posters establish exact easing.
Style 4–7 motion is designed because their motion documents are empty.

Run typecheck, test and RUN_BROWSER_TESTS=1 test. reference-motion.test.ts checks exact
source retention, headline boundaries, all style snapshots, layer limits, deterministic
seeking, layer pinning/tamper detection and seven rendered palettes. Existing alignment
tests remain authoritative; no changes to Python speech inference are needed.


## Reproducible local demonstration

Run `node scripts/run-checks.mjs --import tsx scripts/reference-motion-demo.ts`
from the project root. It creates a new silent six-second Sorani demonstration using
three bundled original SVG assets (phone, bubble, paper plane), with independent layers.
Inspect its contact sheet, then resume the reported job using video:create
--resume JOB --approve-preview. It saves a unique production-purpose demonstration
export under mp2/24fps/vertical/reference-demo so test cleanup does not remove it.
This is vector rendering evidence, not a photoreal reference-matching claim.

## Authored mechanisms and fidelity evidence

Optional referenceMotion.composition has normalized hero and text rectangles
{x,y,w,h}, plus textDepth: front|behind. Part keyframes are ordered {at,x,y,rotation,
scale,opacity,easing}; at is a scene-time fraction, x/y are frame fractions. Easing
belongs to the destination. A part with keyframes ignores generic travel/loop/entrance.
Keyframe x/y are offsets from the part's base center, measured in full-frame units;
rotation adds to the part's base rotation. Scale multiplies the fitted layer; opacity
is the sampled layer opacity. These are independent samples, not incremental deltas.
Omitted x/y/rotation default to zero; scale/opacity to one; easing to smooth. They do
not inherit the preceding key. Write explicit repeated values for a hold. Before the
first key and after the last, the nearest endpoint holds.
origin {x,y} controls the wrapper's transform pivot, including transparent padding.
There is no parent-child rig or automatic attachment constraint. These remain independent
2.5D transforms. Reference camera movement affects the artwork stage, not the typography.
If an object speech anchor resets the artwork clock, all part animation uses that
hero-relative time with the same scene duration; author delays accordingly and inspect
after alignment. No automatic keyframe retiming to each spoken word is implied.
headlineRevealSeconds changes visual reveal cadence only; reviewed voice cues take precedence.

continuity:carry-hero avoids re-entering the same stationary hero on the next scene.
Both scenes need static cameras, heroLoop:none, identical hero position/rotation and
a preceding cut. Parts must be authored with matching end/start states when they carry.

The current asset-backed demo is scripts/reference-demo.ts. It retains its job receipt
and resumes on rerun. The older reference-motion-demo.ts is a legacy vector example,
not the production fidelity demonstration. The agent must inspect pilot/full previews;
no demo script grants its own visual approval.

Use [visual acceptance rules](reference-motion-quality.md) for actual image inspection,
asset fit, mechanism causality and pilot decisions. The schema enforces fields/hashes,
not the correctness of a reviewer's aesthetic judgment.
