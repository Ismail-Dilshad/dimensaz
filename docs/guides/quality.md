# Quality checks

Every video is checked automatically, so a combination that comes out unreadable or empty is
caught before anyone looks at it. With a new style for every video this matters: the checks
are what keep each new style safe to publish.

## On every preview

When a video's preview is made, each scene is checked once it has settled (pieces done, the
sentence in) and scored out of 100:

| Check | Fails when |
| --- | --- |
| Text size | Any visible text is smaller than about 1% of the frame height (hard under 0.75%) |
| Contrast | Text against what is actually beneath it (cards, shapes, the frame) is under 4.5:1, or 3:1 for large text |
| Overlap | The sentence runs into the piece |
| Cut off | Text leaves the frame, spills out of its piece, is clipped, or is covered by something else (a device bezel, another card) |
| Empty | Almost nothing is on screen |

The checks run on the same parallel pages as the preview frames (one page per spare CPU core,
up to 4; `DIMENSAZ_PREVIEW_WORKERS` sets the number). The result is in the preview (`quality`
in `preview.json` and in the `video:create` output),
with every issue named. Contrast is measured against what really shows behind the text: a see-through shape (a faint
blob at 10%) only tints the frame beneath it. If the video's generated style causes a hard contrast or empty-frame
failure, Dimensaz designs another style (up to twice), checks again, and marks the failing
style's colour and depth traits in the brain so they are chosen less often. Other failures
are reported for you to fix or explain.

After the final render, the sound is checked: overall loudness (LUFS), true peak, and how many
effects play per second.

## The art director

Before the preview, every visual the designer made is looked at the way a designer would
(`src/renderer/art-director.ts`). It measures what the checks above do not:

| Measure | Weak when |
| --- | --- |
| Unreadable | The visual itself causes a hard quality problem (pale, tiny or cut-off text) |
| Sparse | It draws on under 5% of its space |
| Crowded | It is packed with detail, or fills almost all of its space (a large calm card is fine) |
| Off-balance | Its visual weight (area times how strongly it stands out) sits over 25% off centre |
| Collision | A text runs into an icon or a 3D object |
| Same | It looks almost the same as the scene before |
| Static, busy | Noted only: nothing moves in the second half of a long scene; more than 7 texts |

Only the visual's own pixels count: it is captured with and without its layers, so the
style's background, pattern or panel never does. A weak visual is then fixed the way a designer
would (`src/engine/art-direction.ts`), in this order:

1. **Its layout**: moved to sit centred, scaled down or up, inside its space (text boxes too).
2. **The same composition drawn again**: another arrangement and colouring, so it shows the
   same thing.
3. **Another composition**, only one that shows the sentence at least 75% as well (a list of
   pressures stays a pile of cards; it never becomes a path just to look neater).

A change is kept only when it measures better *and* the quality checks find no new hard problem
in it. Up to three rounds, three scenes at a time. A replaced composition counts a little
against itself in the brain. It runs once per job, for visuals designed automatically (`make`,
`scenePieces: auto`); `"artDirector": "off"` turns it off, and visuals you or the agent wrote,
or a storyboard approved on its own, are never changed. What it did is in the output
(`artDirector`: each change, and anything it noted but left).

## The harness

```bash
pnpm dimensaz quality                 # tests/fixtures/quality scripts × 4 new styles each
pnpm dimensaz quality --styles 6 --learn
pnpm dimensaz quality my-script.txt   # your own scripts
pnpm dimensaz quality --project ID    # one project's frames
```

The harness renders the test scripts in `tests/fixtures/quality` (a SaaS promo, an energy
explainer, a finance brief, a kids app and a Kurdish script) with visuals and styles designed
from zero, several styles each, scores them like the preview, measures the
effects' loudness and density, and writes `workspace/quality/<time>/report.md` and
`report.json`: the score, the pass rate, issues per video, and the style traits that appear
most often in failing styles. It compares with the last run of the same scripts and number of
styles and flags a regression (score down more than 3, or pass rate down more than 10%).
`--learn` marks failing traits in the brain. Run it after changing the designer, styles or sounds.
