# Changelog

## 9.5.0: The Gallery, and one layout for every page

- **Gallery** (under Studio): every video the agent made or edited, from the studio's previews
  and finals, the jobs the brain recorded and the export folder, each file once. Search, filter
  and sort; play a video with its length, size, your rating and the agent's own check; star the
  best; compare two side by side; download; open the job's steps; hide one (files are never
  deleted); and **Teach from this**, which sends a video to the Teach page so the studio learns
  from its own work. Home shows the latest four.
- Every page now uses the Teach page's layout and behaviour: one centred workspace, a title with
  a line of explanation and the page's actions beside it, quiet cards with small section
  headings. New video uses the same choice tiles as Teach; Your taste uses the same switch rows.
  A page with nothing to show stays a single centred card.

## 9.4.0: Taste, a self-check and guesses

- **Your taste** (`pnpm tempoloom taste`, and a page in the app): one readable profile of what
  you like, built from the lessons you kept, your rules, and the ranges your good examples
  share. Switch lines off, add your own, set targets, write notes, export it; keep a separate
  profile per client or brand, based on all taught videos or only some. Every role starts from
  the lines for its topics, and a brief can choose a profile.
- **The agent watches its own video first** (`studio check JOB build VIDEO.mp4`): the preview is
  measured like a taught video and compared with your targets (matches, close, off), with what to
  change and whose step fixes it, and frame sheets to hold against your lines. The preview step
  cannot finish with something off until it is fixed and checked again, or kept with a reason
  when the brief asks otherwise. The step's card shows the result.
- **Guesses**: when a step finishes, the studio guesses your rating from how you rated that kind
  of step before, how trusted its lessons are, and its self-check. Scores counts how often the
  guesses match; once 20 are judged and 7 in 10 match, a first version you would probably reject
  is held back once for the agent to improve.

## 9.3.0: One app for Teach and Studio

- Teach and Studio are now one app: a sidebar with every section and its counts, a Home screen
  (what the brain holds, what waits for you, what happened lately), a card that always shows
  what to tell your agent with a copy button, messages that appear and fade instead of a red
  bar, proper confirm dialogs, a light and a dark theme, and a layout that works on a phone.
- Teach: drop several videos at once into a queue; a Library with search, filters and sorting;
  a page for each video with its cut strip, colours, motion and sound; compare two videos side
  by side; write your own lessons; keep all lessons on trial at once; export lessons as Markdown.
- Studio: brief presets, reuse an earlier brief, a brief that is saved as you type, a word
  count with the spoken length; in a job, a step list to jump with approved steps folded away,
  pictures that open large, downloads, copy the script, "Tell the studio something" in your own
  words, and Archive. Scores shows steps that were good the first time, video by video, and the
  lessons that are working or failing.

## 9.2.0: The Studio page: make a video and rate every step

- `pnpm tempoloom studio open` opens the Studio page (local, next to Teach). Brief a video in
  two modes: a motion graphics video from a finished script, a prompt, a topic or only a link;
  or an edit of your footage, with instructions or none. Add a logo, colours, references (a file
  or a video you taught) and other files.
- The agent works in its terminal: `studio inbox` lists new requests, tasks that are ready and
  what waits for you; `studio take` plans a request into a job.
- Every finished step is a card with what was decided and the files the role showed
  (`studio done --show`): script lines, pictures, the preview video, sound.
- Rate each step Good, Not bad or Bad (`studio rate`). A rating scores only the lessons that
  step used. Bad takes a reason (chips, flagged lines, pictures or moments in the video, a
  note), saves it as a rule for that step's role and redoes only that step.
- Two looks to pick from (`--choice`, `studio pick`): the picked look's own lessons win, the
  other's lose. The finished video takes a rating too; one job never scores a lesson twice.
- A Scores tab counts ratings by step and lists the rules they created.

## 9.1.1: Teach, saved from anywhere

- A running Teach page picks up lessons saved by another process or by a `git pull` within a
  second, so it never writes an older brain over newer lessons.

## 9.1.0: Teach the brain with videos

- `pnpm tempoloom teach open` opens the Teach page on your computer (local only, with a key in
  the link): drop a video or paste a link, choose the part to study, crop it, mark moments, tick
  what to learn, write a prompt, and say whether it is a good or a bad example.
- The video is copied to a temporary folder, measured with FFmpeg (cuts, shot length, motion,
  colour, layout, tempo, loudness, cuts on the beat), studied by the agent from frame sheets
  (`teach next`, `teach learn`), and deleted (`teach finish`). Only numbers and lessons stay.
- Learning stays clean: lessons start on trial; vague or off-topic ones are dropped with the
  reason; repeats merge and raise confidence; opposites are flagged for you to decide; a lesson
  you removed is never learned again; and what at least three good examples share becomes a
  pattern, with outliers left out and bad examples as the contrast.
- `teach similar` finds the taught videos most like another, by pacing, motion, colour, sound
  and layout. It compares measurements and needs no download.
- Every lesson can be kept, reworded or removed on the page; `teach forget` removes a video and
  what only it taught. The brain's committed copy gains `agent/brain/videos.jsonl`.

## 9.0.0: Tempoloom

- The project is now **Tempoloom**, everywhere: the package and command (`pnpm tempoloom`), the
  skill (`/tempoloom`) and its copies for Codex and Gemini CLI, the studio's sub-agents
  (`tempoloom-motion-lead`, `tempoloom-editing-lead`, `tempoloom-specialist`,
  `tempoloom-reviewer`), the status helper, the local folder (`.tempoloom/`, with the brain),
  the environment variables (`TEMPOLOOM_*`) and the repository
  (github.com/Ismail-Dilshad/tempoloom).
- The brand kit has the new wordmark, "tempo" with "loom" in coral, in Fredoka Bold like
  before: every logo, lockup and social image, SVG and PNG, at the same sizes.

## 8.1.1: Every command checked

- Help works the same on all 25 commands: `--help`, `-h` or `help` prints the usage and runs
  nothing. Nine commands crashed on `--help` (init, doctor, create, brief, answer, edit, fonts,
  assets, tools) and six treated it as an error; init, doctor, create, brief, answer, fonts,
  assets, tools and status now have usage text.
- `fonts recommend` answers first with `recommended`, the best font that covers every character
  of the text. For Kurdish text its top-level `primary` said Inter (the catalog default, which
  has no Kurdish letters) although the ranking below was right.
- `doctor` checks the skill copies and the studio's sub-agents for Claude Code, Codex and
  Gemini CLI.

## 8.1.0: The studio works with any AI agent

- The studio's four sub-agents are generated for every host from the same organisation
  (`pnpm agents:sync`): Claude Code (`.claude/agents/*.md`), Codex (`.codex/agents/*.toml`) and
  Gemini CLI (`.gemini/agents/*.md`). Their instructions name no host; where a sub-agent cannot
  start another, a lead does its department's tasks itself.
- The skill is copied to `.agents/skills/tempoloom/` (read by Codex and Gemini CLI) as well as
  `.claude/skills/`; `GEMINI.md` joins `AGENTS.md` and `CLAUDE.md` as an entry file.
- `pnpm tempoloom studio prompt JOB TASK` prints a complete brief of one task for any other AI
  or a fresh session (`codex exec "$(…)"`, `gemini -p "$(…)"`). The plan, lessons and feedback
  live in the project, so a job can start with one AI and continue with another.

## 8.0.0: The studio

Every job now runs through an organisation instead of one long playbook.

- **Roles** (`agent/studio.yaml`, one source of truth): a Director; a motion graphics lead with a
  style designer, a scene designer and a producer; a video editing lead with a footage analyst,
  an editor and a finisher; and shared roles (researcher, scriptwriter, sound designer, voice and
  captions, an independent reviewer). Each has a mission, steps, guides, commands, checks and
  the feedback topics it learns from.
- **Plan first** (`pnpm tempoloom studio`): `plan` turns a request into tasks with owners, inputs,
  outputs and the user's approvals; a task cannot start before what it needs, cannot finish
  without its output, and an approval is only the user's own yes. `next`, `start`, `done`,
  `approve`, `status` (and `workspace/studio/JOB/plan.md`).
- **Learning per role**: `start` gives a role the rules on its own topics, the lessons it wrote
  itself and the techniques of its craft; a role that was given rules must say which it used;
  `done --learned` saves a lesson for that role. `feedback` saves the user's words as a rule,
  routes it by those words to the roles responsible and reopens their tasks and what was built
  on them. `verdict` scores every lesson the job used (the last task cannot close without it);
  `retro` shows what each role did, used and learned.
- **Sub-agents** generated from the organisation (`pnpm agents:sync`, `.claude/agents/`): the two
  leads, a specialist that takes any role for a heavy or parallel task, and the reviewer, who
  never sees the work being made. Small jobs stay in the Director's own context.

## 7.10.0: Script writing from a topic, link or product page

- `pnpm tempoloom write "TOPIC"|URL [--seconds 30] [--language …]` reads the page in a headless
  browser (its own content, not menus, cookie notices or footers; pages built by scripts
  included; public links only) and writes a brief to `workspace/scripts/<name>/`: the facts a
  script may use, each with its source sentence (name, what it is, features, figures, prices,
  quotations with who said them), the beats (hook, problem, solution, proof, call to action), and
  lines and words sized with the same timing the video uses. A topic has no facts, so its
  script names no figures.
- The agent writes the script from the brief (new mode: script writing). `write --check` stops a
  script that runs too long, greets instead of hooking, has no call to action, or uses a figure,
  quotation or superlative that is not in the facts; it notes long lines and plain visuals and
  shows the visual the designer will give each line. Then `make` as usual.
- Designer fixes found while testing: a call to action stays a button when it mentions a figure
  ("Start your free 14-day trial today"), and its label is its own words; a number word inside a
  list ("payroll takes two clicks") is not the sentence's figure; a list whose last item runs on
  ("cash, bills and payroll hide in different places") is read as a list; the "after" side of a
  change drops fillers ("quiet dashboard", not "one quiet"); labels that only just overshoot stay
  whole ("for small teams").
- Fixed: with `VIDEO_WORKSPACE` set to an absolute path, makes, styles, voice-overs, sound kits,
  transcripts, downloads, research and quality reports were written inside the project folder.

## 7.9.1: Visuals read their sentences better

Found by making videos from every test script and reviewing each scene:

- No invented lists: tiles, orbits and paths only show a sentence's real list. "Track every
  project live on one dashboard" no longer becomes Track · Project live · One dashboard.
- A list's last item stops where the list does ("your roof, your battery and your car work
  together" → Roof · Battery · Car); two parts joined only by a comma are not a list.
- Labels shorten at whole words, never with "…" mid-phrase, and a shortened label never ends
  on a filler ("Book a call on", "Workspace that keeps everything in"); a long key phrase ends
  at its natural break ("Download the app on the App Store"); short clauses are kept whole.
- Filler words ("Meet", "That") are never labels on their own.
- A before→after sentence ("From chaos to clarity") is never shown as a pile of problems.
- A quotation is shown as a quote even when it mentions a figure (it was a bar chart of "10").
- The call-to-action's words stop before its arrow.
- Kurdish: "a place" (شوێن) no longer makes a sentence a map; the Arabic-script comma splits
  clauses like a comma; Kurdish digits in a counter keep their natural spacing (٤٠٪, not ٤ ٠ ٪).

## 7.9.0: The art director

- Before the preview, every designed visual is measured the way a designer would look at it:
  unreadable, sparse, crowded, off-balance (visual weight), text running into an icon or 3D
  object, the same as the scene before; a static ending and busy text are noted. Only the
  visual's own pixels count (captured with and without it).
- Weak visuals are fixed in order: their layout (moved or scaled within their space), the same
  composition drawn again, then another composition only if it shows the sentence at least 75%
  as well. A change is kept only when it measures better and adds no quality problem. Replaced
  compositions count against themselves in the brain. Once per job; on for `make` and
  `scenePieces: auto`, `"artDirector": "off"` turns it off; hand-written visuals and approved
  storyboards are never changed. `make` reports what it did.
- Fixed: the `scale`, `pop` and `spin` entrances dropped a layer's own opacity (a 10% shape was
  drawn solid).
- Fixed: text colour in visuals, and the contrast check, now see through translucent shapes to
  what is beneath them (map labels came out unreadable).

## 7.8.1: Kurdish figures and spacing

- Counting numbers use the sentence's own digits: a Kurdish line that writes ٤٠٪ counts up in
  ٠-٩ (Persian ۰-۹ likewise), with ٬ and ٫ as separators. Number layers take
  `digits: latin|arabic|persian`; the designer sets it from the sentence.
- Headlines: the space between a number or a Latin word and the next word in a right-to-left
  line (and the reverse) no longer drifts to the wrong side ("٤٠٪ زیادی" lost its space).
- 3D figures place ٪ as the headline does.

## 7.8.0: Solid 3D in scene visuals

- New `scene3d` layer: a real 3D object drawn on the GPU (three.js WebGL, one shared renderer):
  bevelled 3D text shaped with HarfBuzz from the video's fonts (Kurdish joins and reads right to
  left, figures keep the sentence's digits), any icon as rounded tubes, and shapes (orb, blob,
  gem, coin, ring, capsule, cube, knot, badge, stack, arrow). Physically based materials that
  follow the video's style (glass, frosted, chrome, brushed, gold, ceramic, candy, clay, neon,
  glossy, matte), a studio light with a reflection environment and filmic tone, soft contact
  shadows, entrances, letters rising in reading order and camera moves. Works in videos and in
  transparent clips over footage, with its own whoosh and impact sounds.
- Two new compositions, `solid-figure` and `solid-object`, learned by verdicts like the others
  and kept to one 3D moment per video.
- Chromium gets WebGL everywhere: the graphics card when there is one, its software renderer
  otherwise (`TEMPOLOOM_GL=auto|gpu|software`).
- `pnpm tempoloom pieces layers` lists the 3D kinds, shapes, materials and cameras.

## 7.7.0: Talking-head videos edited automatically

- `pnpm tempoloom edit auto FOOTAGE` edits a talking head from its speech: pauses and fillers cut,
  alternating punch-ins that hide the jump cuts, visuals designed from zero for the moments worth
  showing (figures, lists, changes, quotations, the call to action) on a panel between the face
  and the captions with their parts entering on the spoken words, compact captions from the kept
  words, music of the talk's mood ducked under the voice, and loudness. `--plan` writes the edit
  list and plan.md only; `--like` steers the visuals' style; `--brand` adds the brand layer.
- Designed visuals can now be rendered as transparent clips (renderer/piece-clip.ts).
- New edit operations: `punch` (many punch-ins in one pass) and `overlays` (many overlays in one
  pass).

## 7.6.0: Looks learn everything they can measure

- A look now also learns the headline size and stroke weight (calibrated on known font weights),
  where the text sits and how busy the frame is, shot length, the music's tempo and how busy the
  sound is, and its colours. Each part goes to one place only: the style's traits, the headline
  size, the visual's placement and size, scene pacing (only without a voice-over), the music's
  mood and tempo, and the sound kit.
- Nothing is copied unless you ask: `--copy colors` (or `"likeCopy": ["colors"]`) uses the
  video's own background, accent and text colours exactly. Fonts cannot be identified from
  frames and are never copied.
- Better measurements: the accent is the most vivid colour that covers part of the frame, tempo
  confidence compares against clearly different tempos, and `media_tools look` measures text
  lines and frame density.

## 7.5.0: Learn a look from a video you like

- `pnpm tempoloom look learn URL|FILE --name NAME` studies a video (a link is downloaded for study
  only after `--confirm`) with the existing reference measurements plus a new FFmpeg cut detector:
  brightness, background and accent colour temperature, cut rhythm, motion energy and easing. Only
  these numbers are saved (`assets/looks/NAME.json`).
- `--like NAME` (make, storyboard, or `"like"` in a request) makes the matching style traits much
  likelier (tone, motion curve, transitions) and sets the music's mood. It never copies: brand
  colours stay and every video is still generated new and different from earlier ones.
- The style generator takes weighted nudges and now weighs transitions like other traits.

## 7.4.0: Music that fits

- Every new motion video gets background music of its mood (read from the script and style):
  a track from your library (`assets/music`) cut to the video on its beats, looping on whole
  bars and fading over its last bar at the video's end; otherwise an original score composed for
  that video (free to use), with chords changing where the scenes change and a held chord at the
  end. With a voice-over the music sits lower and ducks while words are spoken; scene sound
  effects keep their level. CC BY credits go to `NAME.credits.txt`.
- `pnpm tempoloom music list|add|analyze|compose|mood|moods`; tempo and beats are measured with
  FFmpeg alone. Request fields `music` (auto, library, composed, off) and `musicMood`;
  `make --music` and `--mood`.

## 7.3.0: Captions

- Every video with a voice-over gets caption files: `NAME.srt` and `NAME.vtt` beside the video
  and each other shape. The text is the script, timed by the voice's own word timings; cues are
  two lines at most and split at sentences, commas and pauses; right-to-left cues are marked.
- `"captions": "burned"` (or `make --captions burned`) also makes `NAME_captions.mp4` with the
  captions drawn on; `"off"` skips them.
- `pnpm tempoloom media captions FILE` (footage) now writes a `.vtt` next to the `.srt`.

## 7.2.0: One command from script to finished video

- `pnpm tempoloom make SCRIPT.txt` runs the whole chain: the storyboard (a visual for every
  sentence and a new style), an ElevenLabs voice-over with word timings when you pass `--voice`,
  the video job and its preview with quality checks. It stops for you to look, then
  `pnpm tempoloom make --approve JOB` renders the final video, the other shapes (1:1 and 16:9 by
  default) and a thumbnail. `--yes` finishes on its own when the preview passes every check.
  Everything for one video is kept in `workspace/makes/<title>/` with a `make.json` record
  ([guide](docs/guides/make.md)).
- Fixed: draft and preview renders (540 and 720 pixels wide) failed with "Text does not fit";
  type sizes now scale with the render size.

## 7.1.0: Visuals follow the voice-over

- With a voice-over and word timings, each part of a scene's visual enters as its words are
  spoken: list items one by one on their words, a number landing on the spoken figure, a
  before→after tile on its word. Cards, lines and rings arrive with the part they hold; nothing
  enters too late to be seen. The layer sounds move with them, and when timings arrive later
  (`--alignment`) the sound bed is rebuilt.
- Layers carry `says` (the sentence's words they stand for); the designer fills it in.
- Fixed: a full stop could stick to the last list item when a scene's text ended with a new line.

## 7.0.1: Test cleanup

- Only the quality checks (`tests/quality.test.ts`, with its scripts in `tests/fixtures/quality`)
  and the tool registry check (`tests/agent-structure.test.ts`) remain; every other test file
  was removed.

## 7.0.0: Every video designed from zero

Breaking: the ready-made pieces, named styles and saved templates are gone.

- **Scene visuals are designed from zero.** Every sentence gets a new composition built from
  layers with only its own words and numbers, chosen by what it means: cards piling up for a
  problem, the name landing for a reveal, a counting number with bars or an arc for a figure, a
  before→after flow, parts orbiting a centre, a drawn path, a grid of tiles, the old way crossed
  out beside the new, pins on an abstract map, a quotation typing in, a call to action on a
  button, a statement card or a big symbol. Arrangement, shapes, colours, timing and loops vary
  with every video; scenes next to each other never share a composition.
- **No mock content.** No sample names, apps, task titles, chats, prices, chart data, logos or
  dates are ever invented; the storyboard only flags icons that are general marks.
- **Styles are generated from zero.** Each style is drawn trait by trait from the brief, the
  user's words for the look (`"look"` in a request, `--look` in the storyboard), their feedback
  and the traits learned from verdicts, and must differ from every earlier style. The eight
  named looks and `pieceStyle` are removed (`pieceGenome` still repeats a look when asked).
- **`video:create` designs visuals itself** when a motion request has no `sceneVisuals`
  (`"scenePieces": "auto"`), never over footage, reference styles, explainers or directors.
- **The brain keeps only its own knowledge**: general motion and editing principles, the
  user's feedback and reference styles, and what it learned. Named style examples, style
  descriptions, genre recipes and saved pieces are removed on the next sync. Verdicts now score
  each video's style traits (`pt-*`) and compositions (`pd-*`).
- Removed: the 20 ready-made piece kinds (phone, browser, dashboard, tasks, chart, counter...),
  their 30 layouts, `assets/pieces` templates, `pieces styles|templates|save|KIND`, and the
  storyboard's `--product`, `--genre`, `--device`, `--people`, `--url` and `--style`.
  New: `pieces design "SENTENCE"` and `pieces layers`; icons `x`, `quote` and `alert`.
- The quality harness's scripts are test fixtures now (`tests/fixtures/quality`); 15 videos
  (5 scripts × 3 styles) score 100 with every check passed.
- Older projects still open; a ready-made piece they used is dropped (rerun the storyboard).
- Fixed: a looping layer kept its loop pose when the preview seeked back in time.

## 6.6.0: Faster previews

- Preview frames are captured as high-quality JPEG (about twice as fast as PNG) and shared
  across several browser pages at once (one per spare CPU core, up to 4, within free memory;
  `TEMPOLOOM_PREVIEW_WORKERS` sets the number). The quality checks run across the same pages.
- The renderer's script bundle is built once per run instead of once per page.
- Measured on a 5-scene video on a 2-core machine: preview with quality checks went from 5.0 s
  to 2.7 s; on machines with more cores the extra pages add to that. The quality harness scores
  its sample videos the same way (10 videos in 15 s).

## 6.5.0: The storyboard designs new pieces itself

- When no ready-made or saved piece fits a sentence, the storyboard designs a new composed
  piece from what the sentence says: a before→after flow, parts orbiting a centre, points along
  a drawn path, a number beside rising bars, a big symbol with rings, or a statement card. Words,
  numbers and icons come from the sentence; arrangement, shapes and motion vary with the video.
- New designs appear under "Check before rendering", are written to `designed/` beside the
  storyboard, and are saved for reuse when the video is approved (`brain verdict JOB approved`).
- 13 more icons (sun, battery, car, money, water, heartbeat, book, briefcase, truck, target and
  others) and a wider icon vocabulary in English, Kurdish, Arabic and Persian.
- Text that counts up while it animates is checked against the frame too; "planet" no longer
  reads as "plan".

## 6.4.0: Layouts that change per video

- Eleven pieces have 2–3 layouts each (30 in all): dashboard as tiles, a hero number with a
  trend line, or a list; checklist as rows, a grid or staggered cards; notifications as a
  stack, a tilted pile or big pills; progress as bars, rings or columns; counter as a big
  number, a filling ring or a split; chat as bubbles or a thread; avatars as a row, grid or
  overlapping stack; quote as a card, big words or split; bar chart vertical or horizontal;
  tasks with people below, above or beside; pricing as columns or rows.
- Every layout keeps its piece's timing, so sounds stay in step, and passes the quality
  checks in every style.
- Each video picks layouts from its style's seed (never the same twice in a row for one kind),
  learned by the brain (`pt-layout-*`), shown in the storyboard; `"layout"` sets one.

## 6.3.0: Automatic quality checks

- Every preview scores each settled scene: text size, contrast against what is actually
  beneath the text, the sentence running into the piece, text cut off, clipped or covered,
  and empty frames. The result (score, pass, every issue) is in the preview and the
  `video:create` output.
- A bred style that causes hard contrast or empty-frame failures is redesigned (up to twice)
  and its colour and depth traits are marked in the brain. Final renders get a loudness,
  true-peak and effect-density check.
- `pnpm tempoloom quality`: renders sample scripts (examples/quality) in new styles, writes a
  report, lists the traits behind failures, compares with the last run and flags regressions;
  `--learn` teaches the brain, `--project ID` scores one project.
- Fixes found by the checks: text on orange and other mid-tone fills now picks dark or white by
  contrast; brand colours used as text are made readable; text drawn straight on the frame is
  checked against the frame colour; dashboard values fit narrow phone screens; trend arrows
  and the phone status bar read on every style.

## 6.2.0: The whole frame follows the video's style

- The bred style now paints the whole frame: background colour and frame-scale pattern,
  headline colour, highlight colour, headline font, weight, capitals and tracking, and the
  headline's motion. Colours are contrast-checked (text 7:1, highlights 3:1 and distinct
  from the text). Arabic-script lines keep their language's font.
- Pieces no longer draw a separate slab behind themselves when the frame is styled (glass
  keeps its colour behind it).

## 6.1.0: A new style for every video

- The named styles are examples now, not looks to reuse. Every video gets a new design
  style bred from the examples that fit its brief: traits come from the parents and are
  mutated, made coherent, and the result must differ from every style made before.
  Rendering is reproducible: the style is stored with the job.
- The brain learns style traits (`pt-<trait>`): each video records its traits, and approvals
  and rejections raise or lower them, so liked traits come back more often. Feedback such as
  "never brutal" removes that example and steers away from its signature traits.
- Saved composed pieces are varied every time: scale, timing, entrances, shapes, colours and
  idle motion. Sounds are tuned to each style (pitch and brightness).
- `pieceStyle: NAME` and `--style NAME` start from an example instead of copying it;
  `pieceGenome` keeps an exact earlier style when a user asks to repeat a look.

## 6.0.0: No fixed look: design styles, sound kits and composed pieces

- Eight whole design styles for scene pieces (soft, glass, neon, brutal, editorial, clay,
  outline, pop). Each has its own palette built from the brand, surfaces, corners, depth,
  fonts (bundled open fonts), check marks, avatars, motion character, backdrop, transitions
  and sound kit. Request field `pieceStyle` (auto by default) and a per-piece `style`.
- The style is chosen per video from the brief, the genre, the brand, the brain (stated
  preferences and each style's approval record, `ps-<style>`) and recent videos, so styles
  rotate. The storyboard shows the choice, why, and the alternatives (`--style`).
- Sound kits: `library` (CC0 recordings) and four original synthesised kits (`soft`,
  `digital`, `punchy`, `minimal`) with alternating variants; request field `soundKit`.
- Composed pieces: new visuals built from layers (cards, text, numbers, shapes, 35 icons,
  bars, lines, images, avatars) with entrances, loops and sounds, mirrored for right-to-left.
  Save good ones as templates (`pnpm tempoloom pieces save`); the brain learns them and the
  storyboard reuses them. Six starters: stat-hero, icon-trio, hero-tagline, growth-arrow,
  step-flow, badge-burst.
- The brain drops entries for references and saved pieces that were renamed or removed.

## 5.9.0: Eight new scene pieces

- `pricing` (plan cards, counting prices, features, a pressed button), `quote` (a review with
  stars), `logos` (a logo wall that lights up), `calendar` (events landing on their dates),
  `map` (pins and a route on a stylised city), `compare` (a before/after slider), `form`
  (fields typing themselves, then submitted) and `download` (store-style buttons and a rating).
- Each has its own timed sounds, mirrors itself in right-to-left languages, and keeps English
  phrases left to right inside them. Arabic-script form values appear word by word.
- The automatic storyboard picks them from the sentence (prices, customer quotes, "trusted
  by", before/after, dates, places, sign-up details, downloading the app), with example words
  in English, Kurdish, Arabic and Persian and every guess flagged for review.

## 5.8.0: Automatic sound for scene pieces

- Every animated piece plays sound effects timed to its animation: a whoosh on transitions,
  cursor clicks, pops when notifications, messages, tiles and avatars land, ticks while
  numbers count and bars grow, clicks for checked items and a chime when work is done.
- Sounds come from the CC0 library in `assets/sfx`, levelled by measured loudness, spaced at
  least 70 ms apart (14 per scene at most) and mixed into one sound bed; 6 dB quieter under a
  voice-over. On by default; `"pieceSounds": "off"` turns them off.
- Piece timing now has one source (`components/pieces/timing.ts`) shared by the animation
  speed and the sound cues.

## 5.7.0: Right-to-left scene pieces

- Every animated piece is mirrored for right-to-left languages (Kurdish, Arabic, Persian):
  dashboards, task cards and avatars, notifications, checklists, progress bars, bar and line
  charts, donuts, chat bubbles, the phone status bar, the browser bar and the cursor path.
  Numbers and web addresses stay left to right; notification times are localised.
- New piece option `direction`: `auto` (default, follows the sentence), `ltr` or `rtl`, for
  an English app shown inside a Kurdish video and the reverse.
- The automatic storyboard writes Arabic and Persian example words, reads Arabic and Persian
  keywords, and splits Arabic lists joined with و.

## 5.6.0: Automatic storyboard

- `pnpm tempoloom storyboard SCRIPT.txt --product NAME`: splits the script into one sentence
  per scene, reads what each sentence means and picks an animated piece for it
  (notifications for a problem, the product in a browser or phone, task cards flying to
  people, a dashboard, a rising chart, a counter, a chat, avatars, a checklist, the call to
  action), using the brain's recipe for the genre.
- Pieces are filled from the sentence's own numbers and lists; every guessed detail is listed
  under "Check before rendering" in `storyboard.md` for approval. Writes a valid
  `request.json` for `video:create`.
- English and Kurdish (Sorani example words, Kurdish keywords, Kurdish digits and ٪).

## 5.5.0: Finishing tools

- `pnpm tempoloom media formats FILE --to 1:1,16:9`: one master in other shapes. Narrower
  shapes crop around a focus point (the speaker's face from `media reframe`); wider ones
  fit the whole frame over a blurred copy, so no text or design is cut off.
- `pnpm tempoloom media thumbnail FILE --title "..."`: picks the sharpest, best-exposed
  settled frame, adds the title in the language's font (last word in the brand accent)
  and the brand logo; PNG and JPEG under the YouTube size limit.
- Video requests take `formats` and `thumbnail`, made automatically after the final render.
- Editor `music` operation: background music lowered automatically while someone speaks
  (sidechain ducking) and back up in the gaps, with gain, fades, loop and offset.
- `pnpm tempoloom media voiceover` and `media voices`: ElevenLabs voice-over with word
  timings saved as a voice alignment for `video:create`; cached, and only when asked.

## 5.4.0: Apache-2.0 license; only openly licensed material

- Tempoloom is licensed under the Apache License 2.0 (`LICENSE`, `NOTICE`).
- Removed everything without a license allowing redistribution: the 7 Kurdish fonts
  (NRT, Rudaw, Sirwan, UniSalar, Rabar 007/010/021), 31 sound effects, 34 third-party
  reference frames, 7 comparison images and 7 editable SVGs with an embedded font. They
  were also erased from the git history.
- Kurdish now uses open fonts that cover every Kurdish letter: Vazirmatn (default), Noto
  Sans Arabic, Noto Kufi Arabic, Noto Naskh Arabic and the newly added Amiri; saved
  projects that used a removed font render with Vazirmatn.
- Reference styles keep their written descriptions; the per-frame notes in `style.md`
  are now the anchors scenes cite. The 11 remaining sounds are CC0.

## 5.3.0: The brain: Tempoloom learns and gets better

- A knowledge database (SQLite built into Node 22, in `.tempoloom/brain.db`) committed as
  `agent/brain/knowledge.jsonl` and `jobs.jsonl`, so it rebuilds on any computer.
- Starts with about 90 curated entries on motion design and video editing (principles,
  timing and easing, transitions, 20 styles, editing techniques, platform facts, genre
  recipes, Kurdish and RTL practice, things to avoid) plus the user's 8 reference
  styles, 16 motion references, every guide, and the feedback rules.
- Learns from four sources: every finished video and edit (recorded automatically),
  the user's feedback (rules, and a verdict on the job), the user's references
  (`brain learn-reference`), and web study sessions (`brain study`, through Reach).
- Measured facts and feedback apply at once; web findings stay `trial` until two
  approved jobs prove them; items in repeatedly rejected jobs retire. The user can
  approve, reject or retire any item.
- `brain recall` before every video and edit, `brain apply` and `brain verdict` to score
  what was used, `brain report` to show whether recent work gets approved faster.

## 5.2.0: Animated scene pieces

- A library of ready-made, brand-coloured, animated scene pieces for new videos: phone
  and browser mockups (with any other piece as their screen), dashboard with counting
  stat tiles and a chart, task cards that fly to team avatars (or tick off), bar, line
  and donut charts, a big counter, progress bars, stacking notifications, a checklist,
  a chat with typing dots, avatars, and images with a slow zoom.
- A cursor that moves along a path and clicks with a ripple; designed scene transitions:
  wipe, push, zoom-through, mask-reveal, circle-reveal, fade.
- Requests take `sceneVisuals: [{match: "words of the sentence", piece: {...}}]` (or a
  scene index) and an optional `pieceTheme`; colours come from `config/brand.json`, and
  highlighted words use the same primary colour. The sentence stays on screen as the
  headline above (or below) the piece. A piece longer than its scene plays faster so it
  always finishes.
- `pnpm tempoloom pieces` lists the kinds with an example each; `pieces check REQUEST.json`
  validates a request and lists sentences without a piece.
- Workflow, policies, production design template and skill: every scene gets a piece.

## 5.1.1

- Learned rules are read correctly from `memory.md` on Windows (CRLF line endings).

## 5.1.0: Learning from your feedback

- `pnpm tempoloom feedback add`: every rejection, correction or specific praise is
  recorded at once, without waiting for approval. The user's words go to
  `agent/knowledge/feedback.jsonl`; a rule written for future videos goes to the
  "Learned from your feedback" section of `memory.md`. The same point said again is
  merged and counted, and the newest wording wins.
- `feedback lessons --for "<brief>"`: the rules to apply to a new video. A rule seen twice,
  or one from a rejected video, applies to every video; others apply when the brief
  matches their topics. `feedback list` and `feedback forget ID` manage them.
- The workflow loads the rules at intake, lists them as "Lessons applied" in the
  production design, checks them before every preview, and records feedback during
  review. The Flowly rejection is the first saved rule.

## 5.0.2: Instagram profiles and posts from the page

- When Instagram's data API refuses (HTTP 404 even when logged in), `reach instagram
  profile` and `reach instagram posts` read the profile page itself in the Tempoloom
  browser: name, follower, following and post counts from the page, and recent posts
  and reels with their captions and links. A login page gives NEED_LOGIN.

## 5.0.1: Reach fixes from the first live check

- Site errors such as HTTP 404 from a site API, "not found", page layout changes and empty
  results are treated like Agent Reach does (broken, not "not found"), so the next backend
  or the public web is tried and a missing login turns into NEED_LOGIN. Dribbble search
  falls back to web search when its page layout changes.
- X needs both `auth_token` and `ct0` to count as logged in.
- YouTube transcripts: when yt-dlp gets no subtitles, OpenCLI's transcript reader is tried
  next; the ElevenLabs step no longer hides the real error.
- `reach check` lists what each backend answered.

## 5.0.0: Reach, social platforms and the agent's browser

Agent Reach's core ported into Tempoloom (TypeScript), with its tools and Tempoloom's own
channels:

- `pnpm tempoloom reach <channel> <action>`: read-only access to YouTube (search, video,
  transcript, comments, channel), Instagram, TikTok, X, Facebook, Pinterest, Dribbble,
  Behance, Threads, Vimeo, Reddit, LinkedIn, Bluesky, Product Hunt, Google (images,
  trends, news) and GitHub; `reach read URL` routes any link by itself.
- Agent Reach's logic: ordered backends with fallback, final error codes that stop at
  once, one JSON result shape with hints, search spacing per site, browser slots (2 per
  site, 4 overall), a one-hour pause after a rate limit, short pauses for broken
  backends, public web first for sites not set up, and a public last resort.
- Agent Reach's tools: OpenCLI 2.0.2 (project dependency, read commands only, write
  commands refused), its browser extension (downloaded once, hash-checked), yt-dlp
  (installs itself into .venv at the tested version), Jina Reader, Exa search, and
  optional CloakBrowser.
- The Tempoloom browser: its own profile, hidden, closes after 10 minutes unused, a
  window only for logging in; site logins copied once from the user's Chrome (that site
  only) or made by the user in the window; saved and restored between runs.
- `reach download URL [--confirm]`: study-only reference downloads from any of these
  platforms with that site's login; `reach youtube transcript` uses subtitles first and
  ElevenLabs only with `--allow-upload`.
- `pnpm tempoloom browse`: open, read, extract, scroll and screenshot any page in the
  Tempoloom browser; eval and upload need `--confirm`.
- `reach add|login|logout|remove|doctor|check|update|uninstall`, workflow research
  stage, policies, production design template and skill updated.

## 4.4.0: Free sources and reference videos

- `pnpm tempoloom source search|get`: free 3D models, textures and HDRIs (Poly Haven),
  icons (Iconify), images (Openverse, Pexels, Pixabay), stock video (Pexels, Pixabay),
  sounds (Freesound, Openverse) and music (Openverse). Every result is classified as
  final, study or blocked; blocked licenses (NC, ND, unknown) are never downloaded, and
  each download keeps a `source.json` with its license and attribution line.
- `source render-3d`: glTF/GLB models to transparent PNG views and a transparent
  turntable with three.js in Chromium.
- `source reference URL [--confirm]`: reference videos with yt-dlp (added to the media
  tools), info first, download only when confirmed, always study only.
- `source credits`, `source list`, `source doctor`; new keys `PEXELS_API_KEY`,
  `PIXABAY_API_KEY`, `FREESOUND_API_KEY` (all free) in `.env.example`.
- Workflow, policies, production design template and skill use the free sources in the
  Research, Prepare and Deliver stages.

## 4.3.0: Research and production design before building

- Workflow now has eight stages: a **Research** stage (the product's facts and brand
  from its official site, its existing videos, and current examples of the genre on the
  web plus the local reference styles, all with sources) and a **Production design**
  stage that fills `agent/templates/production-design.md` (goal, product facts, brand,
  references, concept, script, storyboard, visual system, motion system, voice, music
  and sound, timing, assets, deliverables, risks) for approval before anything renders.
- `pnpm tempoloom media brand-scan URL [--download]`: logo candidates, theme colour,
  ranked CSS colours and fonts from a product's website.

## 4.2.0: One workflow for every request

- `agent/workflow.md`: seven stages every request follows (Intake, Brief, Plan with
  approval, Prepare, Build, Review with approval, Deliver), with a routing table for
  prompt-only, script, reference, footage, revision and resume requests, a storyboard
  format, mandatory checks before every preview and delivery, and a fast lane that
  skips approvals but never the checks. Linked from the skill, agent.yaml and AGENTS.md.

## 4.1.0: Pure reusable reference styles

- `references/` is now eight reusable styles and sixteen motion references, written as
  text with only the frames that matter: 274 files and about 158 MB became 120 files and
  20 MB. Each style has `style.md` (look, measured palette, rhythm and motion, all
  observations, the shared prompt base), `style.json`, 3–6 frames and a motion sheet in
  place of its clips. `references/catalog.json` indexes everything.
- Removed duplicates and raw material: the numbered `references/styles/style-1..7`
  copies, the style-library review evidence, every reference video (now motion sheets
  and notes) and the old prompt package (in git history).
- The engine reads the catalog: card evidence, numbered presets, reference folders and
  older saved anchors resolve to the kept frames.
- `pnpm tempoloom media style FILES --save --name NAME` adds new references the same way.

## 4.0.0: A new name

The project was renamed. The package and command, the skill, the status helper, the local
status folder and the brand kit all followed, with the wordmark redrawn in Fredoka Bold.

## 3.7.0: Transcription, captions, tightening, brand layer and style briefs

- `media transcribe`: word-timed transcripts with ElevenLabs Scribe (the chosen
  provider), cached by audio hash; Kurdish sent as `kur`.
- `media captions`: readable SRT cues; with `--script` the text is exactly the user's
  script, timed from the recognised words (lenient Kurdish matching).
- `media tighten`: an edit list that removes pauses, filler words and dead air, keeps
  breaths, retimes captions and can add the brand layer.
- Editor `brand` operation: logo watermark and an animated end card from
  `config/brand.json`.
- `media style`: reference style brief with palette roles, cut rhythm, motion energy
  and easing, plus saved frames and *by eye* sections.
- Policies: ElevenLabs-only transcription and voice-over (voice-over only on request),
  image generation only with a tool the host agent has. Doctor reports the key.

## 3.6.0: Motion and design are mandatory

- New standing rules in `agent/policies.md` (Motion and design): no static or
  text-on-blank scene, every scene shows its sentence with designed visuals, one
  consistent branded style, a visual event every 1-2 s in 2-5 s scenes (about 70-80
  words and 6-8 scenes per 30 s), eased staggered animation with designed transitions,
  a rendered MP4, and a per-scene summary on delivery.
- The skill, persona, script-to-motion mode, editing guide, rubric, memory and a new
  eval task (E11) apply the rules. Missing screenshots or logos are drawn as stand-ins,
  never replaced by text only.
- `pnpm tempoloom media pacing FILE`: fails a video with stretches that do not move
  for more than 1.5 s or plain text-on-background frames; required before delivery.

## 3.5.0: Voice separation, stabilization, quality checks, Lottie and overlays

- **Demucs** (`media separate`): split voice from music and noise, or into four stems.
  Uses the CUDA torch already in `.venv`; models download only with `--allow-download`.
- **OpenCV** (`media quality`, `media motion`, `media stabilize`): sharpness, exposure
  and noise checks; camera pan, zoom and shake; stabilization that keeps the audio.
- **lottie-web** (`media lottie`, `media lottie-info`): render Lottie animations
  frame-exactly in Chromium to transparent ProRes `.mov`, VP9 `.webm`, PNG frames or
  `.mp4`. Example: `examples/lottie/slide-box.json`.
- **Editor `overlay` operation**: place images and videos (logos, lower thirds, Lottie
  clips) over footage with position, width, timing, opacity and looping; transparency
  is kept.
- Tool registry: stabilization, overlays and noise reduction are ready; new
  `analyze-quality`, `analyze-motion` and `asset-lottie`.
- Cut-outs use the CPU ONNX Runtime shared with faster-whisper, because the GPU build
  conflicts with it.

## 3.4.0: Media tools

- **New `media_tools/`** (Python, optional, `pnpm media:setup`):
  silence detection with auto-editor, shot and rhythm detection with PySceneDetect,
  tempo and beats with librosa, face-aware reframing with MediaPipe, and background
  removal with rembg (BiRefNet). One command: `pnpm tempoloom media ...`.
- Silence and reframe results write ready `cut` and `reframe` operations for the
  footage editor (`--edl-out`). Models download only with `--allow-download`.
- Tool registry: silence removal and auto-reframe are now ready; new `media-setup`,
  `media-doctor`, `analyze-scenes`, `analyze-beats` and `asset-cutout`.
- `pnpm tempoloom doctor` reports the media tools; `pnpm test:media` runs their tests.
- Model pointers for the audio pipeline are stored relative to the cache, so models
  survive moving the project folder.

## 3.3.0: One skill, one source tree

- **One skill:** `skills/tempoloom/` is the only skill. The old code-motion-shorts,
  custom-motion-shorts, video-production and legacy skills were removed; their
  working rules live on as guides (`docs/guides/layered-assets.md`,
  `docs/guides/style-cards.md`). Codex metadata moved to `skills/tempoloom/agents/`.
- **Source:** command entry points moved from `scripts/` to `src/cli/`; the footage
  editor moved from `packages/editor/` to `src/editor/`. `scripts/` now holds only
  developer tools (checks, benchmarks, smoke tests, skill sync, status helper).
- **Config:** the brand profile is `config/brand.json`; agent strings are in
  `agent/locales/`.
- **Assets:** flat vectors and their manifest are in `assets/library/vectors/`,
  backgrounds in `assets/library/backgrounds/`; finished example scenes moved to
  `examples/scenes/`. The duplicate `assets/Rabar_021.ttf` was removed; saved
  projects that use it load the identical `assets/fonts/Rabar-021-Bold.ttf`.
- **References:** the seven styles are in `references/styles/style-1..7`; the style
  review sits inside the library at `references/style-library/review/`. The extracted
  old skill source, the one-time handoff archive and its organizer script were removed.

## 3.2.0: Leaner, scalable layout

- **Layout:** all TypeScript source in `src/`; living guides in `docs/guides/`,
  historical records in `docs/records/`; `references/` holds only reference media
  and style catalogs; memory in `agent/knowledge/memory.md`. See `docs/MIGRATION.md`.
- **Styles:** removed 11 old presets (premium-viral, word-reveal, active-word,
  text-bounce, spring, object-motion, saas, statistics, camera, clay,
  premium-transition) and the retired Citron Clay and Violet Cutout cards. `kinetic`
  (text only) is now a normal preset for new videos.
- **Assets:** kept only consistent 3D objects. Removed 2D illustrations, flat shapes,
  near-duplicates, test recolors, the origami set and per-scene copies
  (1,035 files, 283 MB to 790 files, 151 MB).
- **References:** added 20 reference videos that were only on the maintainer's
  machine. A full third-party YouTube download stays local and links to its source.
- **Scripts:** removed 29 one-off scripts for past videos, demos and migrations.
- **.env:** commands now load `.env`; `.env.example` documents every setting.

## 3.1.0: Agent foundation (English default, Kurdish first-class)

- **Agent:** new `agent/` with manifest, persona (senior motion designer and editor),
  policies, three mode playbooks (script to motion, reference match, footage edit),
  briefing questions (at most five, only what is missing), a 69-tool registry
  (8 planned), a knowledge index with source and license per entry, ten golden
  evals and a rubric. Knowledge updates are proposals that wait for approval.
- **Languages:** English is the default. Language is detected from the script
  (Kurdish letters select Sorani, Persian letters Persian, other Arabic script
  Arabic, otherwise English). `config/locales.json` maps each language to its
  direction and fonts; `locales/` holds agent strings (non-English drafts need
  native review).
- **Fonts:** Kurdish uses only the existing Kurdish fonts; other languages use six
  bundled OFL fonts chosen by style. The Latin fallback is bundled, so renders no
  longer depend on Windows or Linux system fonts. No hardcoded font in instructions.
- **Editor:** `packages/editor` edits footage from an edit decision list: trim,
  split, cut, concat, crop, reframe, zoom, speed, fades, gain, two-pass loudness,
  resize and right-to-left caption burn-in. Never modifies inputs or overwrites outputs.
- **Automatic motion:** on by default from `config/brand.json`; a request can set
  `autoMotion: false`.
- **Setup:** `tempoloom` command, `tempoloom init`, a fuller `doctor`, and the
  `hello-en` / `hello-ckb` examples.
- **Open source:** README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, templates, CI,
  THIRD_PARTY_LICENSES; license decision pending (`LICENSE.todo.md`).
- **Fixes:** 29 broken symlinked PNGs replaced with real files; sound index paths
  made relative; one skill source of truth with a synced Claude Code copy.
- Saved projects keep their language, fonts and look. See `docs/MIGRATION.md`.

## Portable motion production skill

- Consolidated the default create, review, resume and export workflow into
  `SKILL.md`. The former production skill forwards to it.
- Moved the layered scene and scene packet guides from `output/` to
  `references/` and updated the storyboard command, skills and local indexes.
- Removed three verified byte-identical duplicates: the root Pendulum fit JSON,
  the archived green-brand video and the archived Raycast video. Removed the
  duplicate archive's guide and empty folders. The canonical copies remain.
- Retired Citron Clay, Violet Cutout and new clay preset creation. New reference
  jobs require 3D object records and still require provenance and visual review.
  Saved jobs and render dependencies retain their original style data.
- Added a short-form editing guide and a searchable local memory file. The
  root skill uses both when planning new work.

### Folder tree

```text
SKILL.md          Portable agent workflow
AGENTS.md         Repository development and production invariants
README.md         Setup and command reference
CHANGELOG.md      Migration record
references/       Production guides, reference footage and evidence
memory/           Verified techniques, setup notes and preferences
assets/           Fonts, asset masters, variants, audio and provenance
scripts/          Command entry points and checks
engine/           Planning, project state and validation
renderer/         Deterministic capture, audio mix and encoding
components/       Scene and layer renderers
animations/      Registered motion behaviors
config/           Runtime configuration and reference evidence
presets/          Reusable and compatibility settings
motion-library/   Reference indexing and search
audio_pipeline/   Optional local speech analysis
skills/           Specialized workflows and compatibility entry points
templates/        Authoring templates
examples/         Sample inputs
tests/            Verification
workspace/        Local requests, jobs, pinned inputs and history
mp2/              Video exports
output/           Historical work and optional examples
```

The collection catalog and visual review now live under `references/`.
Saved evidence paths using the former catalog location still resolve to the
same checksummed anchors. The shared Claude Code and Cursor entry point lives
under `.claude/skills/`. Historical handoffs, saved media and prior exports
were preserved.
