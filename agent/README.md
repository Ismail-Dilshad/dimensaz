# Agent definition

**Start here:** [`workflow.md`](workflow.md) is the eight-stage flow every request follows, and
[`templates/production-design.md`](templates/production-design.md) the document it fills in before building.

Who Dimensaz is and how it behaves. The production workflow it follows lives in
[`skills/dimensaz/SKILL.md`](../skills/dimensaz/SKILL.md).

| File | What it defines |
| --- | --- |
| [`agent.yaml`](agent.yaml) | Manifest: name, default locale (English), modes, preferences (`autoMotion`), capabilities, status reporting |
| [`persona.md`](persona.md) | The mind of a senior motion designer and video editor: timing, easing, hierarchy, composition, rhythm, sound, color, typography, pacing per platform |
| [`policies.md`](policies.md) | Production rules: text, fonts, timing, projects, assets, sound, references, downloads |
| [`modes/`](modes) | Playbooks: [script to motion](modes/script-to-motion.md), [reference match](modes/reference-match.md), [footage edit](modes/footage-edit.md) |
| [`questions/briefing.yaml`](questions/briefing.yaml) | Briefing questions, asked only when missing (at most five at once) |
| [`tools/registry.json`](tools/registry.json) | Every tool: id, description, command, inputs, status (ready or planned), when to use |
| [`knowledge/`](knowledge) | Retrievable knowledge index with source and license per entry; updates arrive as proposals |
| [`evals/`](evals) | Ten golden tasks and a scoring rubric |
| [`status/`](status) | Mascot states shown in the live status viewer |

Strings the agent says to users are in [`locales/`](locales); language direction
and font sets are in [`config/locales.json`](../config/locales.json). The user's brand
is in [`config/brand.json`](../config/brand.json).

`tests/agent-structure.test.ts` keeps these files consistent: every ready tool's
command exists, every locale has the same keys, every knowledge path exists, and the
skill copies are in sync.
