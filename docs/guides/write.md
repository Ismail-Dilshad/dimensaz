# Script writing

A video can start from a topic, a link or a product page instead of a script. Dimensaz gathers
the facts and checks the script; the agent writes it. Nothing is invented: every figure, price
and quotation in a script comes from the page.

```bash
pnpm dimensaz write https://example.com/product --seconds 30        # or a topic: "how shops get customers on TikTok"
# the agent writes workspace/scripts/<name>/script.txt from brief.md
pnpm dimensaz write --check workspace/scripts/<name>/script.txt
pnpm dimensaz make workspace/scripts/<name>/script.txt
```

## The brief

`write` reads the page in a headless browser (pages built by scripts included; public links
only) and keeps its own content, not menus, cookie notices or footers. It writes
`workspace/scripts/<name>/brief.md` and `brief.json` with:

- **Facts**, each with the sentence it came from: the name, what it is, features (list items),
  figures, prices and quotations (with who said them).
- **The plan** for the target length (`--seconds`, 10–120, default 30): lines and words, sized
  with the same timing the video uses (a scene lasts its words at 2.5 a second plus 0.9 s
  without a voice-over; a voice-over speaks about 2.6 words a second in English, 2.1 in Sorani),
  and the beats: hook, problem, solution, proof (when the facts have a figure, price or
  quotation), call to action.
- **The rules**: one sentence a line, line length, only the facts, material for the designer (a
  list of three, a change, a figure on its own line), the language.

A topic has no facts, so its script names no figures, prices, results or quotations.

## The check

`write --check SCRIPT.txt` uses `brief.json` beside the script (or `--brief`). Hard problems
stop it (exit code 2):

| Check | Fails when |
| --- | --- |
| Length | Over 30% longer than the target, with or without a voice-over (shorter by 30% is a note) |
| Hook | The first line greets ("Hi", "Welcome", "In this video") |
| Call to action | The last line is not one |
| Figures | A figure is not in the facts (counts up to three are fine) |
| Quotations | Not word for word in the facts |
| Claims | "The best", "#1", "guaranteed" that the facts do not say |

Notes: a long hook, a line too long for a headline, and too many lines that would get a plain
statement visual. `lines` lists what the designer will make of each line (role and composition),
so the script can be tuned for richer visuals before anything renders.
