# Workflow: every request, every time

Every video request follows these seven stages in order, whether the user gives a
script, only a prompt, a reference or their own footage, and whether it is a new
video or an edit. The mode playbooks (`agent/modes/`) supply the details of each stage.
Skip a stage only where this file says so. Report the state shown for each stage with
`python scripts/set_state.py <state> "<detail>"`.

```text
1 Intake ─► 2 Brief ─► 3 Plan ─► [approve] ─► 4 Prepare ─► 5 Build ─► 6 Review ─► [approve] ─► 7 Deliver
                                                            ▲                │
                                                            └── revise ◄─────┘
```

## 1. Intake (state: `listening`)

Read everything the user gave: script, prompt, files, links, earlier messages. Then:

- **Classify the request** with the table below and say in one line what you understood.
- **Load context:** `config/brand.json`, `agent/knowledge/memory.md`
  (`pnpm dimensaz knowledge search "<topic>"`), recent exports in `mp2/`.
- **Check inputs exist.** Name any file the user mentioned that is missing.

| The user gives | Request type | Playbook |
| --- | --- | --- |
| Only a prompt or topic ("a 30 s promo for my app") | New video, script to write | `modes/script-to-motion.md` |
| A script | New video from script | `modes/script-to-motion.md` |
| A script or prompt plus a reference or named style | New video in a style | `modes/reference-match.md` |
| Their own footage | Footage edit | `modes/footage-edit.md` |
| "Change …" about a video already made | Revision | the original job's playbook; go to stage 6 |
| An interrupted job | Resume | `pnpm video:create --resume JOB`; continue where it stopped |

## 2. Brief (state: `listening`, then `needs-approval` while waiting)

Ask only what is missing and would change the result, at most five questions at once,
from `agent/questions/briefing.yaml`: length, format (9:16 by default), language,
style or reference, voice-over, music, call to action. If the user says "you decide",
choose, and state each choice in one line.

- **Prompt only:** write the script yourself: about 70–80 words per 30 seconds, one
  idea per sentence, a hook in the first line and a call to action last. Show it and
  get approval before planning. Never change a script the user wrote.
- **Footage:** inspect first (`media transcribe`, `media quality`, `media motion`,
  `media scenes`), then ask.

## 3. Plan (state: `planning`) — approval gate

Show the plan and wait for approval. Nothing is rendered before it.

- **New video:** three distinct concepts (or the named style), then, after the choice, a
  storyboard table, one row per scene of 2–5 seconds:

  | Time | Narration | Visual action (what the viewer sees happen) | Motion and transition |
  | --- | --- | --- | --- |

  Every row needs a visual action that shows the sentence, a visual event at least every
  1–2 s, and a designed transition (`agent/policies.md`, Motion and design). Note any
  stand-in visuals for missing files.
- **Footage edit:** a numbered edit plan: what is cut (with `media tighten` cut list),
  reframing, captions, overlays, brand layer, music, and the result length.
- **Revision:** list exactly what changes and what stays.

## 4. Prepare (state: `creating`)

Gather everything the plan needs before building:

- Style: the chosen `references/styles/<style>/style.md` and its frames, or a new brief
  from `pnpm dimensaz media style FILES`.
- Assets: asset library first (`pnpm assets:library`), then stand-ins drawn in code,
  cut-outs (`media cutout`), Lottie (`media lottie`); never text in place of a visual.
- Audio: the user's voice-over (cleaned with `media separate` if noisy), ElevenLabs
  voice-over only if asked; word timing (`media transcribe`, Sorani pipeline); music
  beats (`media beats`).
- Fonts by the language rules; brand colours exactly.

## 5. Build (state: `rendering`)

- **New video:** prepare the request and run `pnpm video:create --manifest REQUEST`,
  resolving its gates in order. Render the preview first.
- **Footage edit:** write the edit list and run `pnpm dimensaz edit --edl EDIT.json`
  (draft preset first for long edits).

## 6. Review (state: `thinking`, then `needs-approval`) — approval gate

Check before showing anything:

- `pnpm dimensaz media pacing FILE` must pass (nothing still over 1.5 s, no plain
  text-on-background stretch).
- Look at frames across the whole timeline: text shaping and direction, safe areas,
  brand colours, contrast, balance, transitions, the final hold; for edits also cut
  points, audio sync and loudness.
- Fix every failure yourself, re-render, check again.

Then show the preview (or contact sheet) with one line per scene saying what happens,
and wait for approval. On feedback: apply it as a revision (back to stage 4 or 5) and
record the lesson for memory (stage 7).

## 7. Deliver (state: `done`)

- Final render after approval (`--approve-preview`, or the final edit export).
- Run the pacing check on the final file and confirm length, resolution and audio.
- Deliver: the MP4 path, SRT when there are captions, one line per scene, and honest
  limits (stand-ins, unverified timing, missing files).
- Learn: propose a lesson for anything the user corrected
  (`pnpm dimensaz knowledge propose`).
- Keep the project, assets and earlier exports; remove only scratch files you created.

## Fast lane

When the user says to skip approvals ("just make it", "no need to ask"), take the most
reasonable choice at gates 3 and 6, state those choices at the top of the delivery, and
still run every check in stage 6. Never skip the checks.
