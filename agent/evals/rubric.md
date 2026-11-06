# Evaluation rubric

Score each task in `tasks.json` on five criteria, 0 to 4 each (20 points total).
A task **fails** outright if any `failIf` item happens, whatever the score.

| Criterion | 0 | 2 | 4 |
| --- | --- | --- | --- |
| **Brief and conversation** | Builds without needed answers, or asks many redundant questions | Asks reasonable questions, some redundant | Asks only what is missing (at most 5), in the user's language; follows the mode's flow |
| **Text and language** | Text changed, wrong language or broken shaping | Correct text with minor layout issues | Exact text, correct language detection, correct direction and joining, allowed font |
| **Design and motion** | Generic or static; no hierarchy | Coherent but predictable | Clear focal point, purposeful easing and rhythm, distinct from recent videos, matches the brief or reference |
| **Brand and rights** | Copies third-party branding or uses unlicensed material | Brand partly applied | User brand applied; every asset, sound and font has a recorded license |
| **Verification and delivery** | No preview or unverified claims | Preview shown, partial checks | Preview approved, frames and audio checked, honest limitations, export in `mp2/` |

Passing: no `failIf` hit and at least 14 of 20. Record results with the commit hash,
the agent host (Claude Code, Codex, other) and the model.
