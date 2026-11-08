# Automatic storyboard

Give Dimensaz a script; it gives back a storyboard to approve and a video request that is
ready to render. Every sentence becomes one scene with an animated
[scene piece](scene-pieces.md) that shows what the sentence says.

```bash
pnpm dimensaz storyboard script.txt --product Flowly
pnpm dimensaz storyboard --text "Meet Flowly. Assign tasks in one click. Start free today." --product Flowly
```

It writes two files into `workspace/storyboards/<title>/` (or `--out DIR`; nothing is
overwritten):

- `storyboard.md`: a table of every scene (sentence, what it means, the piece, the
  transition, why), the brain recipe and lessons used, and **Check before rendering**: every
  detail the agent had to guess (sample names, example task titles, illustrative dashboard
  numbers, app names, the offer in the call to action).
- `request.json`: a `video:create` request with the script one sentence per line,
  `sceneVisuals` (one piece per line, matched by its words) and a thumbnail.

After the user approves (or after you apply their changes):

```bash
pnpm dimensaz pieces check workspace/storyboards/<title>/request.json
pnpm video:create --manifest workspace/storyboards/<title>/request.json
```

## How it picks

| The sentence is about | Piece |
| --- | --- |
| A problem or hook (drowning, wasting, chaos, too many) | Notifications piling up, one per item of its list |
| Reminders or alerts | Notifications |
| The product ("Meet X", "Introducing") | The product in a browser or phone with a live dashboard and a cursor click |
| Assigning, organising, planning work | Task cards flying to people |
| Work finished | Task cards ticking off |
| Seeing, tracking, live, insight | A dashboard with counting numbers and a drawing chart |
| Growth with a figure ("revenue grew 3x") | A bar chart rising to it |
| A single figure | A big counter (prefix, suffix and decimals from the sentence) |
| Speed or time saved | A counter, or before/after bars |
| Customers, replies, support | A chat with typing dots |
| A team or people | Avatars |
| Steps or a list | A checklist |
| The call to action (last sentence: try, start, download, join) | The product opening, with a click on the offer |

- **Genre** (SaaS promo, app launch, explainer, product ad, tutorial) comes from the words of
  the script, or from the brain's best-matching recipe when the words do not say. It sets
  the device (browser for SaaS, phone for apps) and the transition set. Force them with
  `--genre` and `--device`.
- **Numbers and lists come from the sentence.** "40% faster" counts to 40%; "messages,
  tasks and deadlines" become three notifications. Anything the sentence does not give is
  an example and is listed under "Check before rendering". Give real names with
  `--people "Sara,Omar"` and a domain with `--url`.
- **Variety:** the same piece never appears twice in a row (the second is wrapped in a
  device frame or changed), and transitions rotate through the genre's set.
- **Kurdish, Arabic, Persian:** example words (apps, task titles, chat, the call to action)
  are written in the script's language, the meanings are read from Kurdish, Arabic and
  Persian keywords too, Eastern Arabic and Persian digits and ٪ are read as numbers, and every
  piece is laid out right to left.

The storyboard is a first draft: change any piece in `request.json` (examples:
`pnpm dimensaz pieces KIND`) before rendering.
