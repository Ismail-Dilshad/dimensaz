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
kind of request. `pnpm dimensaz studio org` prints it.

## A hierarchy of responsibility

A role is a playbook plus what the brain has learned for it. The Director or a lead applies a
playbook directly, which keeps the whole job in one head, or hands the task to a sub-agent
when that helps:

| Sub-agent | When |
| --- | --- |
| `dimensaz-motion-lead`, `dimensaz-editing-lead` | A whole department stage of a job |
| `dimensaz-specialist` | One task that is heavy (research) or can run beside another; it takes any role |
| `dimensaz-reviewer` | Always: the review is done by someone who did not make the work |

The sub-agents are generated from `studio.yaml` (`pnpm agents:sync`) into `.claude/agents/`.
A lead can hand a task to a specialist (three levels). Only the Director talks to you.

## Plan first

```bash
pnpm dimensaz studio plan "30 s promo for Ledgerly" --type script-to-motion --write --voice
pnpm dimensaz studio next JOB            # what can be done now, what waits for you
pnpm dimensaz studio start JOB TASK      # the role's playbook, inputs, lessons, your feedback
pnpm dimensaz studio done JOB TASK --output FILE --applied ID,ID --learned "..."
pnpm dimensaz studio approve JOB design-ok
pnpm dimensaz studio status JOB          # also workspace/studio/JOB/plan.md
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

Everything is stored in the brain's database (`.dimensaz/brain.db`, committed as
`agent/brain/*.jsonl`) and in `agent/knowledge/memory.md`.
