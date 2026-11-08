# Production memory

Before a new brief, search this file for the language, motion mechanism, source
format or tool needed. For example, run `rg -in 'Sorani|cutaway|FFmpeg' memory`.
Read only the matching entries and follow their linked evidence.

After each task, review what was verified. Update the existing entry with the
same ID or add one entry when the lesson is distinct. Keep the date, conditions,
evidence and practical consequence. Merge overlapping entries. Record explicit
preferences as preferences. Keep raw footage, transcripts, secrets, and
unverified claims in their proper project context.

- **motion-mandatory** · Preference, 2026-11-07: every video must move throughout, show each sentence with designed visuals (UI, cards, charts, cursors, counters), keep a consistent style, put a visual event every 1–2 s in 2–5 s scenes (about 70–80 words and 6–8 scenes per 30 s), use eased staggered animation and designed transitions, pass `media pacing`, and be delivered with a one-line summary per scene. A text-only Flowly promo (kinetic preset, missing screenshots) was rejected as slow, empty and undesigned. [Policies](../policies.md#motion-and-design-every-video)
- **sorani-shaping** · Complete shaped words in one of the existing Kurdish fonts, chosen by style, are the default for Sorani. Inspect joined text and mixed-direction lines in the actual render. [Language guide](../../docs/guides/language-support.md)
- **presenter-cutaway** · Use a full-screen visual when a spoken beat benefits from a concrete demonstration. Keep dialogue continuous where the edit permits and return to the presenter for the close. [Editing guide](../../docs/guides/short-form-editing.md)
- **local-render-check** · Windows baseline verified Node, FFmpeg, FFprobe and Chromium with `pnpm video:doctor` and two decoded smoke exports. On another host, run the same doctor before rendering. [Setup](../../README.md#setup)
- **ismail-pendulum-revision** · For an explicitly requested revision of the approved style, preserve the cord wipe, smooth pivot and single CTA exit. [Approved recipe](../../docs/guides/pendulum-reveal.md)
- **independent-product-tag** · On 2026-11-06, a silent 540×960 Sorani proof used a static shoe and an independently pivoted tag. The preview and encoded samples showed the tag settle by 0.98 seconds and the caption remain readable during the hold. [Layered scene guide](../../docs/guides/layered-scenes.md)

## Learned from your feedback

Written automatically from the user's feedback (`pnpm dimensaz feedback add`). Apply every
rule that matches the brief; a rule seen 2× or more, or from a rejected video, always applies.
Remove one with `pnpm dimensaz feedback forget ID`.

- **fb-motion-not-text** · Rule, 2026-11-08, 1× (reject, job flowly-promo): Never deliver text on a plain background: every sentence gets a designed visual (UI, cards, charts, cursors, counters), a visual event every 1-2 s, eased entrances and exits, designed transitions; run media pacing before showing — you said: "The Flowly promo was only text: slow, empty and with no design". Topics: motion, pacing, design, typography, color, transitions.
