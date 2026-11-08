# Production design: {{TITLE}}

<!-- Filled in by the agent in workflow stage 4 and saved as
workspace/projects/<job>/production-design.md. Every section is decided before
building. Mark anything assumed with (assumed) and anything still open with (open). -->

**Request:** one line in the user's words. **Type:** SaaS promo, product explainer,
footage edit… **Length:** 30 s. **Format:** 9:16, 1080×1920, 30 fps.
**Language:** English. **Date:** YYYY-MM-DD.

## 0. Lessons applied

Rules from `pnpm dimensaz feedback lessons --for "<request>"`, one line each with its id
(for example `fb-motion-not-text`), and how this video follows it.

## 1. Goal and audience

- **One job of this video:** what the viewer should think or do afterwards.
- **Audience:** who they are, what they already know, where they watch (TikTok, Reels,
  YouTube Shorts, LinkedIn, landing page).
- **Hook (first 1.5 s):** the problem, result or question that stops the scroll.
- **Call to action:** exact words and where it leads.

## 2. Product facts (researched)

| Fact | Value | Source (link, date) |
| --- | --- | --- |
| What it is | | |
| Main problem it solves | | |
| Three key features, as benefits | | |
| Proof (numbers, customers, awards) | | |
| Pricing or offer to mention | | |
| Tagline or positioning line | | |

Only facts with a source go on screen. Unverified claims are marked and left out or
softened.

## 3. Brand (researched and confirmed)

- **Logo:** file and version used (light/dark), where it appears (end card, corner),
  minimum size. From `media brand-scan` or the user; missing → (open) and a stand-in.
- **Colours with roles:** background, text, primary, accent, success; hex values and
  contrast ratios (text on background at least 4.5:1).
- **Fonts:** the brand's fonts if open-licensed, otherwise the closest allowed font
  (Kurdish: existing Kurdish fonts only); headline and body weights.
- **Voice and tone:** three words, plus words to avoid.
- **Existing brand videos or ads studied:** links and what to keep consistent.
- **Social accounts read:** Instagram, TikTok, X, YouTube, LinkedIn (from `reach`), with
  what their posts show about style, colours and voice.

## 4. References and research

| Reference | Link or file | What we take from it | What we avoid |
| --- | --- | --- | --- |
| Local style (`references/styles/…`) | | | |
| Current examples of this genre (3–5) | | | |

- **Genre conventions found:** structure, pacing, typical shots for this kind of video
  (for SaaS: problem → product reveal → three feature demos → proof → call to action).
- **Trends worth using now** (with date and source), and what feels dated: from
  `reach tiktok explore`, `reach tiktok search`, `reach youtube search`,
  `reach pinterest search`, `reach dribbble search`.
- **What the audience says:** themes from `reach youtube comments` on competitor videos.

## 5. Concept

- **Name and one-line idea** (the visual metaphor).
- **Why this concept** for this audience and product.
- **Alternatives considered** and why not.

## 6. Script

Final narration, word count and spoken length (about 2.5 words per second). Exact user
text is never changed; a script the agent wrote is approved by the user first.

## 7. Storyboard

| # | Time | Narration | Visual action (what happens on screen) | Piece (`pnpm dimensaz pieces`) and assets | Motion and easing | Transition in | Sound |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.0–2.5 | | | | | | |

Rules: scenes of 2–5 s, a visual event at least every 1–2 s, every sentence shown
(UI, cards, charts, cursors, counters), text only as labels, designed transitions.

## 8. Visual system

- **Palette in use:** roles from section 3; where each colour may appear.
- **Typography scale:** headline, label and caption sizes; words per line; alignment.
- **Layout:** grid, margins, safe areas (150 px top and bottom at 1080×1920), focal point.
- **Shapes and depth:** corner radius, shadows, glass or flat, background treatment.
- **UI and illustration style:** mockup frames, card style, icon set, 3D or flat assets.

## 9. Motion system

- **Easing:** entrances (ease-out or spring, 0.3–0.6 s), exits (ease-in, 0.2–0.4 s),
  overshoot amount if any.
- **Stagger:** 40–80 ms between related elements.
- **Camera:** push-ins, parallax, pans; when it stays still.
- **Transitions:** the 2–3 kinds used and where (wipe, morph, zoom-through, mask).
- **Signature moment:** the one shot people should remember.

## 10. Voice

- **Voice-over:** user's recording / ElevenLabs (only if asked) / none (on-screen text).
- **Voice character:** gender, age range, accent, energy; pace in words per minute.
- **Captions:** on or off, style, position (lower third, clear of headlines), language.

## 11. Music and sound

- **Music:** mood, tempo (BPM), where it builds and drops; source and license (user-
  supplied, or CC0 / CC BY from `source search --kind music`); volume under voice (ducking).
- **Sound effects:** list with times (clicks, whooshes, pops) from licensed local sounds or `source search --kind sound`.
- **Mix:** voice first, music about −18 to −22 dB under speech, loudness −14 LUFS.

## 12. Timing plan

Total length, scene lengths, where beats land (narration stresses or music beats),
the final hold on the call to action (at least 1.5 s).

## 13. Assets

| Asset | Have / need / stand-in | Source and license |
| --- | --- | --- |

Needed assets come from the library, then `pnpm dimensaz source` (final-use licenses
only); write the provider, link and license for each.

## 14. Deliverables

Files (MP4, SRT, thumbnail), formats (9:16, 1:1, 16:9), naming, where they go (`mp2/`).

## 15. Risks and open questions

What could go wrong (missing assets, unverified claims, licensing, Kurdish glyphs) and
the questions that need the user's answer before building.
