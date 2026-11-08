# Animated scene pieces

Ready-made, brand-coloured, animated visuals that show what each sentence says. The
sentence stays on screen as the headline; the piece fills the rest of the frame. They
work with the `kinetic` preset and any request that uses the standard renderer.

## In a request

Write the script **one sentence per line** (each line becomes a scene), then attach a
piece to each line by its words:

```json
{
  "schemaVersion": 1,
  "title": "Flowly promo",
  "preset": "kinetic",
  "script": "Your team drowns in tasks every Monday.\nFlowly assigns them automatically.\nRevenue grew forty two percent.",
  "sceneVisuals": [
    {"match": "drowns in tasks", "piece": {"kind": "notifications", "items": [
      {"app": "Slack", "title": "5 new requests"}, {"app": "Mail", "title": "Urgent: client feedback"}],
      "transition": "zoom-through"}},
    {"match": "assigns them", "piece": {"kind": "tasks", "flow": "assign", "tasks": [
      {"title": "Launch deck", "assignee": "Sara"}, {"title": "Fix login bug", "assignee": "Omar"}]}},
    {"match": "Revenue grew", "piece": {"kind": "chart", "type": "bar", "values": [40, 52, 61, 88],
      "labels": ["Q1", "Q2", "Q3", "Q4"], "unit": "k", "transition": "mask-reveal"}}
  ]
}
```

`"scene": 2` (0-based) works instead of `match`. Check before rendering:
`pnpm dimensaz pieces check REQUEST.json` (every line should have a piece).

## Kinds

| Kind | Shows | Animation |
| --- | --- | --- |
| `phone` | A mobile app; `screen` is any piece below | Slides up and settles with a tilt, then its screen animates |
| `browser` | A web app; `screen` is any piece below, `url` types itself | Rises in, URL types, screen animates |
| `dashboard` | `stats` tiles (value, prefix, suffix, trend) and an optional `chart` | Tiles pop in and count up, chart draws |
| `tasks` | Task cards, `people`, `flow`: `assign` / `complete` / `appear` | Cards slide in, then fly to their assignee's avatar (badge counts) or tick off |
| `chart` | `type` bar, line or donut; `values`, `labels`, `highlight`, `unit` | Bars grow, line draws with dots and a value tag, donut sweeps |
| `counter` | One number `from` → `to`, `prefix`, `suffix`, `caption` | Counts up with an underline, then pulses |
| `progress` | Up to 5 labelled bars in percent | Bars fill one after another, numbers count |
| `notifications` | Up to 4 app notifications | Drop in from the top and stack |
| `checklist` | Up to 6 items | Each item appears and its check fills and draws |
| `chat` | Messages `from` me or them | Typing dots, then bubbles pop in |
| `avatars` | People and a `caption` | Avatars pop in one by one |
| `image` | An `asset` id (screenshot, product photo, 3D render from `source render-3d`) | Rises in with a slow zoom |

`pnpm dimensaz pieces KIND` prints a working example of each.

## Options for every piece

| Option | Values | Default |
| --- | --- | --- |
| `transition` | `none`, `fade`, `wipe`, `push`, `zoom-through`, `mask-reveal`, `circle-reveal` | `wipe` |
| `placement` | `center` (sentence above), `top` (sentence below), `bottom` | `center` |
| `size` | share of the frame height, 0.3–0.75 | 0.56 |
| `delay` | seconds before the piece starts | 0.15 |
| `cursor` | `{"path": [{"x": 0.3, "y": 0.4, "at": 1.2}, {"x": 0.7, "y": 0.4, "at": 1.8, "click": true}], "style": "arrow"}` | none |
| `direction` | `auto` (follows the sentence's language), `ltr`, `rtl` | `auto` |

Cursor `x` and `y` are 0–1 of the piece; `at` is seconds into the scene; each `click`
shows a press and a ripple.

## Colours

Pieces take the brand colours from `config/brand.json` (primary, accent, background,
text). Override with `"pieceTheme": {"accent": "#FF6B4A"}` in the request. Highlighted
words in the sentence use the same primary colour.

## Timing

Each piece animates over about 1.5–3 s. When a scene is shorter, the piece plays faster
so it finishes by 85% of the scene. With reduced motion (autoMotion off) pieces show
their finished state.

## Sound

Every piece plays its own sound effects, timed to its animation, from the CC0 sounds in
`assets/sfx` (on by default; `"pieceSounds": "off"` in the request turns them off):

| Moment | Sound |
| --- | --- |
| Scene transition (wipe, push, zoom-through, mask-reveal, circle-reveal) | Whoosh (none for fade or none) |
| Phone or browser enters (when there is no transition whoosh) | Soft whoosh |
| Cursor click | Click |
| Notification lands, chat message arrives, dashboard tile, avatar, chart value tag | Pop |
| Counter and dashboard numbers counting, bars growing, line points | Ticks |
| Checklist item or task ticked | Click; a chime when all are done |
| Task card reaches its person | Pop |
| Counter lands, donut completes | Soft impact |

All cues go into one sound bed: at least 70 ms apart, at most 14 per scene, each sound
levelled by its measured loudness, and 6 dB quieter when there is a voice-over (which is
also ducked over). When a piece plays faster to fit a short scene, its sounds follow.

## Choosing a piece

- Problem, overload, pressure → `notifications`
- Work gets assigned, organised or done → `tasks` (`assign`, `complete`)
- "See everything", results → `dashboard`, often inside `browser`
- Growth, comparison, share → `chart`; one big number → `counter`
- Goals or completion → `progress`; steps or benefits → `checklist`
- Support, teamwork, speed of reply → `chat` inside `phone`
- Team or customers → `avatars`; a real product → `image`
- Add a `cursor` with a click when the sentence is about an action ("one click").

## Right-to-left languages

In right-to-left scripts (Arabic, Persian, Kurdish in Arabic script and others), every
piece is mirrored automatically: dashboards, task cards and avatars, notifications, checklists (tick on the right, items slide in from the right),
progress bars (fill from the right), bar and line charts (time runs right to left), donuts
(sweep the other way), chat (your messages on the left), the phone status bar and the
browser bar (window buttons on the right). Cursor paths are mirrored too, so a click still
lands on the same element; write `x` as for a left-to-right layout. Numbers such as `40%`,
`$1,200` and web addresses stay one left-to-right run, and notification times read
"ئێستا", "الآن" or "اکنون". To show an English app inside a right-to-left video, set
`"direction": "ltr"` on that piece.
