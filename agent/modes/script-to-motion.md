# Mode: script to motion

**Trigger:** the user gives a script (optionally a voice-over) and no style reference.

## Flow

1. **Read** the script and any media. Detect the language (or use the one named).
   Report state `listening`.
2. **Brief.** Load `agent/questions/briefing.yaml` and the user's `config/brand.json`.
   Ask only the questions whose answers are missing, at most five at once, in the
   user's language. If the user says "you decide", choose and state your choice in
   one line. Report state `needs-approval` while waiting.
3. **Three concepts.** Propose three genuinely different design directions. Each one:
   - a name and a one-line idea (the visual metaphor)
   - palette roles from the brand (dominant, accent, neutral) and the font (by style)
   - background and texture, composition approach
   - motion personality (calm, smooth, snappy, elastic, cinematic) and transitions
   - one signature moment (where the video peaks)
   Differ on at least three of: metaphor, composition, motion personality,
   typography treatment, background. Avoid repeating the user's previous video
   (check recent exports and `agent/knowledge/memory.md`).
4. **Wait for the choice.** Accept mixes ("concept 2 with concept 1's colors").
5. **Plan beats.** One idea per beat, 2–5 seconds each; for 30 seconds about 70–80
   words and 6–8 scenes. For every beat write the **visual action** that shows the
   sentence (UI mockup, cards, chart, cursor, counter, icon in motion), its motion
   (entrance, mid-scene event at least every 1–2 s, exit) and the transition into the
   next beat. On-screen text is 1–4 words that label the picture. A beat without a
   visual action is not finished. Follow `agent/policies.md` (Motion and design) and
   `docs/guides/short-form-editing.md`.
6. **Assets and sound.** Search the asset library and local sounds first
   (`agent/policies.md`). Report state `creating`.
7. **Produce.** Prepare the request internally and run
   `pnpm video:create --manifest REQUEST` (`skills/tempoloom/SKILL.md` step 5).
   Report `planning`, then `rendering`.
8. **Preview.** Inspect the contact sheet: shaping, safe areas, balance, motion,
   transitions, final hold. Reject any plain text-on-blank frame or still stretch.
   Fix in a revision. Show the preview and ask for approval.
9. **Final render and delivery.** After approval, render, run
   `pnpm tempoloom media pacing FILE` (must pass), verify frames and audio, deliver
   the MP4 (and SRT when there are captions) with one line per scene saying what
   happens in it. Report `done`.

## Defaults when the user delegates

- 9:16, 1080x1920. Fps from the production preset.
- Motion and design are mandatory (`agent/policies.md`); automatic subtle motion on
  (`preferences.autoMotion`) on top of the designed animation.
- Missing screenshots or logos: draw stand-in UI and shapes in code, never text only.
- Captions on for narrated videos; kinetic keywords for music-only videos.
- Sound effects only from licensed local sounds; music off unless supplied.
