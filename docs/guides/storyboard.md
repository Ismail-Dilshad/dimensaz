# Automatic storyboard

Give Dimensaz a script; it gives back a storyboard to approve and a video request that is
ready to render. Every sentence becomes one scene with a visual designed from zero for it
([scene visuals](scene-pieces.md)), in a style generated new for this video
([styles](piece-styles.md)).

```bash
pnpm dimensaz storyboard script.txt
pnpm dimensaz storyboard script.txt --like night-reel   # in the spirit of a learned look (looks.md)
pnpm dimensaz storyboard --text "Meet Flowly. Assign tasks in one click. Start free today." --look "dark and glowing"
```

It writes two files into `workspace/storyboards/<title>/` (or `--out DIR`; nothing is
overwritten, a second run goes to `<title>-2`):

- `storyboard.md`: the style and why, then a table of every scene (sentence, what it means,
  the composition, the transition, why), and **Check before rendering**, which lists anything
  that was not taken from the sentence itself (an icon that is only a general mark).
- `request.json`: a `video:create` request with the script one sentence per line, the style
  (`pieceGenome`), `sceneVisuals` (one visual per line, matched by its words) and a thumbnail.

After the user approves (or after you apply their changes):

```bash
pnpm dimensaz pieces check workspace/storyboards/<title>/request.json
pnpm video:create --manifest workspace/storyboards/<title>/request.json
```

## What it does

- **Reads each sentence:** its meaning (problem, reveal, figure, list, change, place,
  quotation, call to action...), its key phrase, list, numbers ("40% faster" counts to 40%,
  "$9" shows $9) and any before→after turn. Arabic, Persian and Kurdish keywords and digits are
  read too.
- **Designs a visual from zero** for it from layers, with only the sentence's own words and
  numbers, and icons that match them. Nothing is a ready-made piece or a sample: no invented
  names, apps, prices or chart data.
- **Varies everything:** compositions, arrangement, shapes, colours and motion change with
  every video, and scenes next to each other never share a composition.
- **Learns:** approving or rejecting the video (`pnpm dimensaz brain verdict JOB approved`)
  scores its style traits and its compositions, and later storyboards favour what worked.
- **Sound:** every visual plays its own timed effects in the style's sound kit (`--sound` to
  pick a kit).
- **Right-to-left languages:** visuals are laid out right to left in Kurdish, Arabic and
  Persian scenes.

The storyboard is a first draft: change any visual's layers in `request.json` before rendering.
