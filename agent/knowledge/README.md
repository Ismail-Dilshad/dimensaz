# Knowledge base

What the agent knows about motion design and editing, beyond its persona. Content
stays where it already lives (`references/`, `memory/`, `motion-library/`, `agent/`,
`skills/`); `index.json` makes it retrievable, with a source and license per entry.
`schema.json` describes the index.

```bash
pnpm reelwright knowledge search "kinetic typography rtl"
pnpm reelwright knowledge show short-form-editing
pnpm reelwright knowledge list --topic editing
pnpm reelwright knowledge validate
```

## Updating: proposals only

The knowledge base never changes silently. To add a technique, a tool update or a
lesson from a finished video, the agent writes a proposal:

```bash
pnpm reelwright knowledge propose --title "Punch-ins hide jump cuts" \
  --file lesson.md --source "Verified on job 2026-11-06_demo_003" --license project
```

The proposal lands in `agent/knowledge/proposals/`. The user reviews it; when
approved, the agent merges it into the right file (usually `memory/README.md` or a
guide) and adds or updates the index entry with `"reviewed": true`.

Research from the web follows `motion-library/research-notes.md`: official sources or
the original publisher, recorded URL and date, no downloading of source art, and the
user's confirmation before any download.
