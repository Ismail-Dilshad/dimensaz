# The brain: what Dimensaz knows and how it gets better

`pnpm dimensaz brain` is the agent's knowledge of motion design and video editing, kept in
a database that grows and re-scores itself with every job.

## Where it lives

- `.dimensaz/brain.db`: SQLite database with full-text search (built into Node 22.13+,
  nothing to install). Local, rebuilt automatically.
- `agent/brain/knowledge.jsonl` and `agent/brain/jobs.jsonl`: the committed copy. After a
  `git pull` on another computer the database loads them by itself. Commit them with the
  project.

## What it knows at the start

About 90 curated entries, plus your own material:

| Kind | Examples |
| --- | --- |
| principle | Easing, durations, stagger, overshoot, anticipation, one focus at a time, holds stay alive, type scale, contrast, colour roles, grids |
| technique | Masks, counting numbers, cursor demos, kinetic type, match cuts, whip pans, J/L cuts, punch-ins, b-roll, dead-air removal, music cuts, sound design, captions, grading, reframing, speed ramps |
| style | Swiss, bold kinetic, clean SaaS, premium reveal, glass, clay, isometric, flat 2D, neo-brutalism, Y2K, glitch, doodle, collage, liquid, data-viz, minimal, UGC, documentary, trailer, YouTube retention, podcast clips, and your 8 reference styles |
| recipe | SaaS promo, app launch, explainer, testimonial, product ad, talking head, event recap, tutorial, 6 s bumper |
| fact | Platform specs (TikTok/Reels/Shorts, YouTube, LinkedIn), loudness targets |
| rule / preference | Your feedback rules |
| avoid | Text-only scenes, everything moving at once, fades everywhere, tiny text, music over voice |
| tool | Every guide in `docs/guides/` |

## How it learns

| Source | How | Status |
| --- | --- | --- |
| Every finished job | Recorded automatically when a video or edit finishes (format, pieces, transitions, length, render time) | measured |
| Your feedback | `feedback add` saves a rule and gives the job a verdict | proven, applies at once |
| Your references | `brain learn-reference FILES --name NAME` measures and saves the style | proven |
| Study sessions | `brain study "topic"` searches the web, YouTube, Dribbble and Behance (via Reach); the agent reads the best and saves techniques with `brain add --source URL` | trial |

**Scoring:** the agent records what a job used (`brain apply --job JOB IDS`). Your
verdict (`brain verdict JOB approved|revised|rejected`, or `feedback add --job`) adds a
win or a loss to each. A trial item with two approved jobs becomes **proven**; an item in
repeatedly rejected jobs **retires**. Recall ranks by match × status × success, so what
works rises and what fails sinks.

## Commands

```bash
pnpm dimensaz brain recall "30 s SaaS promo, vertical"      # before every video
pnpm dimensaz brain recall "talking head, remove pauses" --domain editing
pnpm dimensaz brain study "kinetic typography trends"       # research a topic
pnpm dimensaz brain add --title "..." --body "..." --source https://... --kind technique --domain motion
pnpm dimensaz brain learn-reference ref.mp4 --name "Neon launch"
pnpm dimensaz brain apply --job JOB st-saas-clean rc-saas-promo
pnpm dimensaz brain verdict JOB approved
pnpm dimensaz brain approve ID | reject ID | retire ID | show ID | list --status trial
pnpm dimensaz brain report                                  # progress over time
```

`report` compares earlier and recent jobs (approved the first time, average revisions)
once at least four jobs have a verdict.
