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

**Tools over MCP.** `pnpm tempoloom mcp` serves the studio as tools to any agent that speaks
the Model Context Protocol: `studio_next`, `studio_status`, `studio_start`, `studio_say`,
`studio_done`, `studio_check`, `studio_prompt`, `read_file`, `write_job_file`, `brain_recall` and
`source_search`. They are the same functions the commands call. An agent reads only project
files (never `.env`, `.tempoloom`, `.git` or anything outside the project) and writes only
inside its job's folder. In Claude Code:

```bash
claude mcp add tempoloom -- pnpm --silent tempoloom mcp
```

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

## The team at work

Each video's page (Videos, then a video) shows the job as a team at work, above its steps:

- **The team**: the roles working now come first, each wearing the Tempoloom mascot in its own
  colour with the face of what it is doing (reading, thinking, planning, making, rendering,
  unsure, stuck, done) and the line it last said; click one to jump to its step. The others
  wait below (All roles shows every one). When a choice waits for you, you join the team with
  the "needs you" face.
- **What is happening**: every step started, finished, checked, rated or approved, and what the
  agents say, streamed as it happens with no reload. Click a line to jump to its step.
- The step list on the left pulses on the steps being worked on; the steps below keep
  everything they always had (output, pictures and videos, rating, picks, approvals).

The Videos list shows the face and the last line of any video being worked on right now, and the
sidebar shows your agent's face and what it is doing, whatever page you are on.

Every studio action writes one line to the job's `events.jsonl`. While they work, agents say
what they are doing: `pnpm tempoloom studio say JOB TASK "Searching your music for a calm bed
near 90 BPM" --face thinking` (the skill and the sub-agents do this by themselves); a face is
chosen from the work when an agent says nothing. The same face goes to `.tempoloom/state.json`,
which `pnpm tempoloom status STATE "DETAIL"` also sets outside a job, so the standalone mascot
viewer (`assets/brand/web/state-viewer.html`) keeps working.

## Models and keys

**Models and keys** (at the bottom of the menu) is for the browser studio, and all of it is
optional: with no key, your terminal agent does the work as before.

- **Services**: Claude, OpenAI, Gemini, OpenRouter, xAI, Mistral, DeepSeek and Groq for the
  agents; fal and Replicate for images, video and sound; ElevenLabs for voice; Pexels, Pixabay and
  Freesound; and model servers on your computer or network (Ollama, LM Studio, llama.cpp, or any
  server that speaks the OpenAI API). **Connect** takes a key once and checks it by reading the
  service's own model list, so new models appear without an update, with what each can do
  (agents, see frames, images, video, speech) and its price where the service gives one.
- **Keys** go to your system's keychain (Windows Credential Manager, macOS Keychain, Linux Secret
  Service); where there is none, to `.env`, which is never committed. The page only ever shows
  the last four letters. Every command reads keychain keys too; a real environment variable wins.
- **Models for the team**: a main model, and a different one for any role. The reviewer should
  use a different model from the producer, so its review stays independent; the page warns
  when it does not.
- **Who makes what**: images, video clips, music and sound effects come from a service you
  choose, or are found in free sources and drawn with code (Off). Voice stays ElevenLabs, only
  when you ask. Text in a video is always drawn by Tempoloom, in the open fonts.
- **Budgets**: per video, per day, and the cost above which a single step asks you first
  (defaults: $2, $10, $0.50).
- **What may leave this computer**: frames only (the default), short clips, full videos, or
  nothing (local models and free sources only).

Settings are kept in `.tempoloom/settings.json` (no keys in it). For now your terminal agent
drives every job; the browser studio's own agents are the next step and will use these settings.

## The Gallery

**Gallery** (under Studio) shows every video the agent made or edited, newest first, from three
places merged by file: the videos a studio step showed (`studio done --show`, so each job's
previews and its final), the outputs of finished jobs the brain recorded, and the export folder
(`mp2/`, or `VIDEO_OUTPUT`).

- **Sorted for you.** Each video is put into a kind by itself, from the words of its brief or
  file name, then from how it was made, its length and its shape: teasers and launches,
  explainers and tutorials, ads and promos, talking head and interviews, social shorts, other.
  Nothing is filed by hand and nothing is stored; rename a file and it is sorted again.
- Search, filter (kind of video; finals, previews, exports; rated good, not bad, bad or not yet;
  starred) and sort.
- **Rate** a video Good, Not bad or Bad, on its card or its page. Bad asks for the reason. When
  the video came from a studio step that has no rating yet, the step is rated too, so the
  lessons it used are scored; click your rating again to remove it.
- Open a video to play it and see its length, size, your rating of it, the agent's own check
  against your taste, and its file path; download it, or open the job's steps.
- **Star** your best work. **Compare** two side by side, played together.
- **Teach from this**: the video becomes a draft on the Teach page, so the studio learns from
  its own work as a good or a bad example.
- **Hide** removes a video from the gallery only; the file stays.
- **Delete the file** removes it from your computer for good, after you confirm. Only files in
  the export folder or the workspace can be deleted here; any other file can only be hidden.
  Stars, ratings and hidden videos are kept in `.tempoloom/gallery.json`.

Every page of the app shares one layout: a title with a line of explanation and the page's
actions, then cards. A page with nothing to show yet is a single centred card saying what to do.
