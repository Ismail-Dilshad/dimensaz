# The studio

Every job runs through an organisation, not one long playbook: a **Director** who plans and
decides, two **departments** (motion graphics and video editing) with a lead each, and
**specialist roles** that each own one kind of decision. Nothing is built without a plan, every
role works from its own playbook and its own lessons, and your feedback goes to the role
responsible.

```text
Director ── plans, delegates, keeps your approvals, closes every job with a verdict
 ├─ Motion graphics lead ── Style designer · Scene designer · Producer
 ├─ Video editing lead ──── Footage analyst · Editor · Finisher
 └─ Shared ──────────────── Researcher · Scriptwriter · Sound designer · Voice and captions · Reviewer
```

It is defined in one file, [`agent/studio.yaml`](../../agent/studio.yaml): each role's mission,
steps, guides, commands, checks and the feedback topics it learns from, and the plan for each
kind of request. `pnpm tempoloom studio org` prints it.

## A hierarchy of responsibility

A role is a playbook plus what the brain has learned for it. The Director or a lead applies a
playbook directly, which keeps the whole job in one head, or hands the task to a sub-agent
when that helps:

| Sub-agent | When |
| --- | --- |
| `tempoloom-motion-lead`, `tempoloom-editing-lead` | A whole department stage of a job |
| `tempoloom-specialist` | One task that is heavy (research) or can run beside another; it takes any role |
| `tempoloom-reviewer` | Always: the review is done by someone who did not make the work |

Only the Director talks to you.

## Any AI agent

The studio is plain commands, so it does not depend on one AI. The same four sub-agents are
generated from `studio.yaml` for each host (`pnpm agents:sync`), and the skill is copied where
each looks for it (`pnpm skills:sync`):

| Agent | Entry file | Skill | Sub-agents | Depth |
| --- | --- | --- | --- | --- |
| Claude Code | `CLAUDE.md` | `.claude/skills/tempoloom/` | `.claude/agents/*.md` | A lead can start a specialist (three levels) |
| Codex | `AGENTS.md` | `.agents/skills/tempoloom/` | `.codex/agents/*.toml` | The Director starts leads, specialists and the reviewer |
| Gemini CLI | `GEMINI.md` | `.agents/skills/tempoloom/` | `.gemini/agents/*.md` | One level: the Director starts each sub-agent |
| Any other | `AGENTS.md` | `skills/tempoloom/SKILL.md` | none | The agent applies each role's playbook itself |

Where a sub-agent cannot start another, a lead simply does its department's tasks itself, one
at a time. To give one task to a different AI or a fresh session, `pnpm tempoloom studio prompt
JOB TASK` prints a complete brief that needs nothing from the conversation:

```bash
codex exec "$(pnpm -s tempoloom studio prompt JOB review)"
gemini -p "$(pnpm -s tempoloom studio prompt JOB research)"
```

The plan, the lessons and your feedback live in the project (the brain database and
`workspace/studio/`), so you can start a job with one AI and continue it with another.

## Plan first

```bash
pnpm tempoloom studio plan "30 s promo for Ledgerly" --type script-to-motion --write --voice
pnpm tempoloom studio next JOB            # what can be done now, what waits for you
pnpm tempoloom studio start JOB TASK      # the role's playbook, inputs, lessons, your feedback
pnpm tempoloom studio prompt JOB TASK     # the same task as a brief for any other AI
pnpm tempoloom studio done JOB TASK --output FILE --applied ID,ID --learned "..."
pnpm tempoloom studio approve JOB design-ok
pnpm tempoloom studio status JOB          # also workspace/studio/JOB/plan.md
```

`--type` is `script-to-motion`, `reference-match` or `footage-edit`; `--write` when there is no
script yet, `--voice` when a voice-over was asked for, `--visuals` for designed visuals over
footage. The plan lists every task with its owner, what it needs, what it produces and the
approvals that are yours (the script, the design, the preview). A task cannot start before what
it needs is done, an output must exist to finish it, and an approval is only ever your own yes.

## Learning, every time

- **Each role has its own lessons.** `studio start` gives a role the rules on its topics (your
  feedback about colour goes to the style designer, about music to the sound designer; a rule
  with no topic goes to everyone), the lessons it wrote itself, and the best-matching
  techniques of its craft.
- **A task says what it used.** A role that was given rules cannot finish without
  `--applied` (or `--applied none`). `--learned "..."` saves a lesson for that role, as a trial.
- **Your feedback** goes through `studio feedback JOB "your words"`: it is saved as a rule,
  routed by your own words to the roles it concerns, and their finished tasks and everything
  built on them are reopened (their approvals are asked again). Praise (`--verdict approve`) is
  learned and reopens nothing.
- **The verdict** (`studio verdict JOB approved|revised|rejected`) scores every lesson any role
  used; the job's last task cannot close without it. Trial lessons with two approved jobs
  become proven, and repeated losers retire ([the brain](brain.md)).
- **The retro** (`studio retro JOB`) shows what each role did, used and learned, and what you said.

Everything is stored in the brain's database (`.tempoloom/brain.db`, committed as
`agent/brain/*.jsonl`) and in `agent/knowledge/memory.md`.

## The Studio page

`pnpm tempoloom studio open` opens a page on this computer (the same local server as
[Teach](teach.md), with the key in the link). The user briefs a video there and rates every
step; the agent does the work in its terminal.

```bash
pnpm tempoloom studio open      # the user: brief, watch, rate, approve
pnpm tempoloom studio inbox     # the agent: new requests, tasks ready, what waits for the user
pnpm tempoloom studio take r-1a2b3c4d
```

**The brief.** Two modes. *Motion graphics video*: a finished script (used word for word), a
prompt, a topic, or only a link. *Edit my footage*: up to eight files, with instructions or
none ("decide everything"). Both take a length, shape, language, a logo, colours for this
video, references (a file, or a video the user taught), other files and notes. Files are kept in
`workspace/studio/_inbox/<request>/files/` and become the job's material.

**Taking it.** `studio take` plans the request (`script-to-motion` or `footage-edit`, with
`write`, `voice`, `visuals` and `pick` as the brief asks) and writes `request.md` in the job.

**What the user sees.** Every finished step is a card: what was decided (the step's output),
and the files the role showed with `studio done … --show FILE` (pictures, the preview video,
sound). Only files a step listed can be opened from the page.

**Ratings.** Each step takes Good, Not bad or Bad (`studio rate JOB TASK good|ok|bad`):

| Rating | Lessons that step used | The job |
| --- | --- | --- |
| Good | Each gains a win (two wins make a trial lesson proven) | Continues |
| Not bad | Unchanged | Continues |
| Bad | Each gains a loss (a repeated loser retires) | The reason (chips, flagged lines, pictures or moments, a note) becomes a rule for that step's role; only that step, and what was built on it, is redone |

One version of a step takes one rating; a redone step takes a new one. A lesson a rating or a
pick scored is not scored again by the job's verdict, so one job never counts a lesson twice.

**Two looks.** With `pick`, the style task ends with two versions
(`--choice "A: NAME|SAMPLE.png|IDS" --choice "B: …"`) and the user picks one
(`studio pick JOB style "B"`): the lessons only the picked look used win, the ones only the
other used lose, and the pick is passed to the next roles.

**More on the page.** Start a brief from a preset or reuse an earlier one (it is saved as you
type); follow a job with the step list on the left, with approved steps folded away; open a
picture large; download any shown file; copy the script; "Tell the studio something" sends
feedback in your own words to the roles it concerns; Archive hides a finished job (nothing is
deleted). Scores shows, video by video, how many steps were good the first time, and which
lessons are working or failing.

**The end.** The finished video takes Good (the job is approved and the remaining lessons are
scored), Not bad (accepted, lessons unchanged) or Bad (the reason goes back and the final is
redone). The Scores tab counts good and bad ratings by step and lists the rules they created.

## The Gallery

**Gallery** (under Studio) shows every video the agent made or edited, newest first, from three
places merged by file: the videos a studio step showed (`studio done --show`, so each job's
previews and its final), the outputs of finished jobs the brain recorded, and the export folder
(`mp2/`, or `VIDEO_OUTPUT`).

- Search, filter (finals, previews, exports; motion or edits; starred) and sort.
- Open a video to play it and see its length, size, your rating of it, the agent's own check
  against your taste, and its file path; download it, or open the job's steps.
- **Star** your best work. **Compare** two side by side, played together.
- **Teach from this**: the video becomes a draft on the Teach page, so the studio learns from
  its own work as a good or a bad example.
- **Hide** removes a video from the gallery only. Files are never moved or deleted; stars and
  hidden videos are kept in `.tempoloom/gallery.json`.

Every page of the app shares one layout: a title with a line of explanation and the page's
actions, then cards. A page with nothing to show yet is a single centred card saying what to do.
