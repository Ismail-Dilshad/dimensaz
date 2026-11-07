# Examples

| Example | What it shows |
| --- | --- |
| `hello-en/` | English script. The language is detected, a playful open font is chosen by the style recommender, and a short kinetic video renders. |
| `hello-ckb/` | Sorani script. Detected as Sorani; the font comes only from the existing Kurdish fonts, chosen by style. |
| `reference-request.json` | A reference-style request. It stops at the asset board for the agent to assign hero and companion assets. |
| `production-request.json`, `sample-*`, `smoke-config.json`, `example-project.json` | Fixtures used by tests and older workflows. |

Run the hello examples (low resolution, 12 fps, about 8 seconds each):

```bash
pnpm example:hello en
pnpm example:hello ckb
pnpm example:hello en --final   # full 1080x1920
```

Each prints the detected language and the chosen font, then exports to
`mp2/<fps>/vertical/examples/`. They use the text-only kinetic path, so no assets are
needed. Edit `script.txt` or the `style` in `brief.json` (for example `playful`,
`editorial`, `tech`, `elegant`, `headlines`) to see the font choice change.

A footage-editing example lives in [src/editor/README.md](../src/editor/README.md).
