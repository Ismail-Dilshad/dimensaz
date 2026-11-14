# Script writing

A video can start from a topic, a link or a product page instead of a script. Tempoloom gathers
the facts and checks the script; the agent writes it. Nothing is invented: every figure, price
and quotation in a script comes from the page.

```bash
pnpm tempoloom write https://example.com/product --seconds 30        # or a topic: "how shops get customers on TikTok"
# the agent writes workspace/scripts/<name>/script.txt from brief.md
pnpm tempoloom write --check workspace/scripts/<name>/script.txt
pnpm tempoloom make workspace/scripts/<name>/script.txt
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

## The script doctor

`pnpm tempoloom write --doctor SCRIPT.txt` scores every line from 0 to 100 and says why:

- **Its job.** The first line must hook (a greeting is weak; a question, a number, "you" or a sharp
  contrast is strong, under 12 words). The last line must ask the viewer to do something.
- **Clarity.** Filler words, several clauses in one line, passive voice, long words, brackets,
  two lines that start the same way.
- **Length.** How long the line takes to say at the language's speed (Sorani is slower), and
  the whole script against the length you asked for.
- **Facts.** Every figure, price, date and quotation needs a source (the brief's facts, or one
  given with `--source`), and claims such as "the best", "the first", "proven" or "guaranteed"
  are flagged until they have one.

A line under 60 is weak, under 80 could be stronger. On the Studio page the same check runs as
you type a script of your own (New video, "This is my finished script"), and each video's page
shows its script line by line.

Better lines are suggestions, never silent rewrites:

```bash
pnpm tempoloom write --suggest SCRIPT.txt --line 1 --text "Your coffee, ready before you are." --why "A hook, not a greeting"
pnpm tempoloom write --source SCRIPT.txt --line 3 --claim '$4.50' --url https://example.com/menu
pnpm tempoloom write --keep SCRIPT.txt --id ID      # or --decline; the user does this on the page
```

In the studio, a job made from your own script keeps it in `script.txt` in the job's folder. The
Director suggests better lines and sources at the brief step; you keep or decline each one on the
video's page until the storyboard starts, and every later step reads the file. A script the studio
writes cannot be finished while a line is weak or a figure has no source, unless the brief asks
for a line as it is (`write --accept SCRIPT.txt --why "..."`).

## Trend watch

**Trend watch** (under Studio, and `pnpm tempoloom trends`) watches up to 12 topics. A check reads
the newest top videos for each topic through Reach (YouTube and TikTok by default; read-only,
nothing is ever posted) and sorts them into formats: lists and countdowns, how-tos, mistakes and
myths, before and after, comparisons, "I tried it", stories, reviews, question hooks, secrets and
big numbers. A format that several results share is suggested with the links it was seen in,
marked "rising" when it grew since the last check.

**Use this format** makes it a lesson on trial: the scriptwriter uses it where it fits, and your
ratings decide whether it stays. **Ignore** stops suggesting it for that topic. Channels that are
not set up are listed by name; `pnpm tempoloom reach channels` shows what to add.
