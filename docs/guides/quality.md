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

The result is in the preview (`quality` in `preview.json` and in the `video:create` output),
with every issue named. If the video's bred style causes a hard contrast or empty-frame
failure, Dimensaz designs another style (up to twice), checks again, and marks the failing
style's colour and depth traits in the brain so they are chosen less often. Other failures
are reported for you to fix or explain.

After the final render, the sound is checked: overall loudness (LUFS), true peak, and how many
effects play per second.

## The harness

```bash
pnpm dimensaz quality                 # examples/quality scripts × 4 new styles each
pnpm dimensaz quality --styles 6 --learn
pnpm dimensaz quality my-script.txt   # your own scripts
pnpm dimensaz quality --project ID    # one project's frames
```

The harness renders the sample scripts (a SaaS promo, a finance brief, a kids app and a
Kurdish script) in several newly bred styles, scores them like the preview, measures the
effects' loudness and density, and writes `workspace/quality/<time>/report.md` and
`report.json`: the score, the pass rate, issues per video, and the style traits that appear
most often in failing styles. It compares with the last run of the same scripts and number of
styles and flags a regression (score down more than 3, or pass rate down more than 10%).
`--learn` marks failing traits in the brain. Run it after changing pieces, styles or sounds.
