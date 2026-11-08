# References

Reusable reference styles and motion references, as written descriptions. Third-party
images are not kept in the repository.

```text
references/
  catalog.json             every style and motion reference, anchors, old-path map
  styles/<style>/          one reusable style
    style.md               written reference: feel, look, measured palette/rhythm/motion,
                           observations, the shared prompt base, and a written note
                           per key frame (the anchors scenes cite)
    style.json             the same as data
    motion-sheet.jpg       the source clips as frames over time (no videos kept)
  motion/<name>/           one motion technique: motion.md, motion.json, sheet.jpg
  motion-library/_library/ index and review notes of the motion-library tool
```

| Style | Use it for |
| --- | --- |
| [Blue Editorial](styles/blue-editorial/style.md) | Bright tabletop explainers, how something works |
| [Classic](styles/classic/style.md) | The original glossy blue store-and-cart look |
| [Red Signal](styles/red-signal/style.md) | Warnings, diagnoses, surprising metrics on black |
| [Emerald Contrast](styles/emerald-contrast/style.md) | Comparisons on deep green with lime accents |
| [Green Beacon](styles/green-beacon/style.md) | Filmed dark-green staging with neon green |
| [Tangerine Counter](styles/tangerine-counter/style.md) | Warm cream retail and sale stories |
| [Apricot Miniatures](styles/apricot-miniatures/style.md) | Miniature scenes, cream and orange |
| [Lavender Glass](styles/lavender-glass/style.md) | Soft translucent glass and violet glints |

## Add a style from your own references

```bash
pnpm dimensaz media style ref1.mp4 ref2.png ref3.jpg --save --name "Coral Studio"
```

This keeps up to six images as frames, turns videos into one motion sheet, measures
palette, rhythm and motion, writes `style.md` and `style.json`, and adds the style to
`catalog.json`. Then open `style.md`, fill in the *by eye* sections from the frames, and
delete any frame that is not essential. Without `--save` the command only writes a
brief to `workspace/styles/` for study.

Rights: references are for study, never artwork for final videos. Frames saved from
someone else's work stay on your computer; before committing a new style, keep only
`style.md`, `style.json` and images you own. See `THIRD_PARTY_LICENSES.md`.
