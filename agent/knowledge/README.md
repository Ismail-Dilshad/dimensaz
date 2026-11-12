# Knowledge base

What the agent knows about motion design and editing, beyond its persona. Content
stays where it already lives (`docs/guides/`, `agent/knowledge/memory.md`, `agent/`,
`skills/`); `index.json` makes it retrievable, with a source and license per entry.
`schema.json` describes the index.

```bash
pnpm tempoloom knowledge search "kinetic typography rtl"
pnpm tempoloom knowledge show short-form-editing
pnpm tempoloom knowledge list --topic editing
pnpm tempoloom knowledge validate
```

## Learning from the user's feedback (automatic)

The user's own feedback is the exception to proposals: it is recorded at once.

```bash
pnpm tempoloom feedback add "too slow, just text" --rule "Every sentence gets a designed visual" --verdict reject --job JOB
pnpm tempoloom feedback lessons --for "30 s SaaS promo"   # rules to apply to a new video
pnpm tempoloom feedback list | forget ID
```

The rule goes to the "Learned from your feedback" section of `memory.md` (the same point
said again is merged and counted, the newest wording wins), and the user's exact words go
to `feedback.jsonl`. Rules seen twice, or from a rejected video, apply to every video.

## Updating other knowledge: proposals only

Techniques, tool updates and research never change the knowledge base silently. The
agent writes a proposal:

```bash
pnpm tempoloom knowledge propose --title "Punch-ins hide jump cuts" \
  --file lesson.md --source "Verified on job 2026-11-06_demo_003" --license project
```

The proposal lands in `agent/knowledge/proposals/`. The user reviews it; when
approved, the agent merges it into the right file (usually `agent/knowledge/memory.md` or a
guide) and adds or updates the index entry with `"reviewed": true`.

Research from the web follows `docs/guides/motion-research.md`: official sources or
the original publisher, recorded URL and date, no downloading of source art, and the
user's confirmation before any download.
