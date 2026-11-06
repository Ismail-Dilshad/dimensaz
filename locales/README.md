# Locales

Agent-facing strings per language: the greeting, briefing questions, mode messages
and status labels. Direction, script and font sets live in `config/locales.json`.

English (`en.json`) is the source. The other files are drafts marked
`"status": "draft: needs native-speaker review"`; corrections are very welcome.
Badini (`badini`) uses the Kurmanji or Sorani strings depending on the script.

Every file must have exactly the same keys as `en.json` (checked by
`tests/agent-structure.test.ts`).
