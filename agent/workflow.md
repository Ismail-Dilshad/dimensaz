# Workflow: every request, every time

Every video request follows these eight stages in order, whether the user gives a
script, only a prompt, a reference or their own footage, and whether it is a new
video or an edit. The mode playbooks (`agent/modes/`) supply the details of each stage.
Skip a stage only where this file says so. Report the state shown for each stage with
`python scripts/set_state.py <state> "<detail>"`.

```text
1 Intake ─► 2 Brief ─► 3 Research ─► 4 Production design ─► [approve]
        ─► 5 Prepare ─► 6 Build ─► 7 Review ─► [approve] ─► 8 Deliver
                           ▲            │
                           └─ revise ◄──┘
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
| "Change …" about a video already made | Revision | the original job's playbook; go to stage 7 |
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

## 3. Research (state: `thinking`)

Know the product and the genre before designing anything. Use the host's web search
and page reading tools; record every source with its link and the date.

**The product** (skip for footage edits of the user's own content unless it promotes
a product):

- Search for the product or company and open its official site, pricing or features
  page and about page. Collect: what it is, the problem it solves, three key features
  as benefits, proof (numbers, customers), the offer, the tagline.
- Read its brand from the site: `pnpm dimensaz media brand-scan URL --download` saves
  logo candidates and lists the theme colour, the colours its CSS uses and its fonts.
  Confirm by looking at the logo and the site; the user's files win over the scan.
- Find the brand's existing videos or ads (site, YouTube, social accounts) and note
  what to keep consistent.
- When the product is the user's own and has no site, use `config/brand.json` and ask
  for the logo and colours.

**The genre** (for example "SaaS promo", "app launch", "product explainer"):

- Check local styles first: `references/README.md` and `references/catalog.json`
  (styles and motion references).
- Search the web for strong current examples of this kind of video (official product
  launch videos, motion design showcases, award winners) and pick 3–5 with links. For
  each, write what to take (structure, pacing, shot types, transitions, typography) and
  what to avoid. Measure any video or image the user supplied with
  `pnpm dimensaz media style FILES`. To measure a web example, run
  `pnpm dimensaz source reference URL`, ask, then add `--confirm` (study only).
- Note the genre's conventions and current trends with the date and source.

References are for study: never copy another company's branding, artwork or footage.
If web search is unavailable, say so and continue from local references and the user's
files.

## 4. Production design (state: `planning`) — approval gate

Write one document that decides everything before building:
`workspace/projects/<job>/production-design.md`, from the template
[`templates/production-design.md`](templates/production-design.md). It covers the goal
and audience, researched product facts with sources, the brand (logo, colour roles,
fonts, voice), the references and genre research, the concept, the script, the
storyboard (one row per 2–5 s scene: narration, visual action, assets, motion,
transition, sound), the visual system, the motion system, voice and captions, music and
sound, the timing plan, the asset list (have, need, stand-in), deliverables, and risks
and open questions.

- **New video:** offer three concepts first (or follow the named style), then complete
  the design for the chosen one. Every storyboard row shows its sentence on screen, has
  a visual event at least every 1–2 s and a designed transition (`agent/policies.md`,
  Motion and design).
- **Footage edit:** the design is the edit plan: cuts (from `media tighten`), reframing,
  captions, overlays, brand layer, music, and the result length.
- **Revision:** list exactly what changes and what stays.

Show the user a short summary (concept, storyboard table, colours, fonts, voice, music,
length, open questions) and the file path. Nothing is rendered before approval.

## 5. Prepare (state: `creating`)

Gather everything the production design lists before building:

- Style: the chosen `references/styles/<style>/style.md` and its frames, or a new brief
  from `pnpm dimensaz media style FILES`.
- Assets: asset library first (`pnpm assets:library`), then free sources
  (`pnpm dimensaz source search --kind model|texture|hdri|image|icon|video|sound|music`,
  look at the previews, `source get N`; 3D models through `source render-3d`), then
  stand-ins drawn in code, cut-outs (`media cutout`), Lottie (`media lottie`); never
  text in place of a visual. Record each item's source and license in the asset table.
- Audio: the user's voice-over (cleaned with `media separate` if noisy), ElevenLabs
  voice-over only if asked; word timing (`media transcribe`, Sorani pipeline); music
  beats (`media beats`).
- Fonts by the language rules; brand colours exactly.

## 6. Build (state: `rendering`)

- **New video:** prepare the request and run `pnpm video:create --manifest REQUEST`,
  resolving its gates in order. Render the preview first.
- **Footage edit:** write the edit list and run `pnpm dimensaz edit --edl EDIT.json`
  (draft preset first for long edits).

## 7. Review (state: `thinking`, then `needs-approval`) — approval gate

Check before showing anything:

- `pnpm dimensaz media pacing FILE` must pass (nothing still over 1.5 s, no plain
  text-on-background stretch).
- Look at frames across the whole timeline: text shaping and direction, safe areas,
  brand colours, contrast, balance, transitions, the final hold; for edits also cut
  points, audio sync and loudness.
- Fix every failure yourself, re-render, check again.

Then show the preview (or contact sheet) with one line per scene saying what happens,
and wait for approval. On feedback: apply it as a revision (back to stage 5 or 6) and
record the lesson for memory (stage 8).

## 8. Deliver (state: `done`)

- Final render after approval (`--approve-preview`, or the final edit export).
- Run the pacing check on the final file and confirm length, resolution and audio.
- Deliver: the MP4 path, SRT when there are captions, one line per scene, the
  `source credits` lines when downloaded assets need attribution, and honest limits
  (stand-ins, unverified timing, missing files).
- Learn: propose a lesson for anything the user corrected
  (`pnpm dimensaz knowledge propose`).
- Keep the project, assets and earlier exports; remove only scratch files you created.

## Fast lane

When the user says to skip approvals ("just make it", "no need to ask"), take the most
reasonable choice at gates 4 and 7, state those choices at the top of the delivery, and
still run the research and every check in stage 7. Never skip the checks.
