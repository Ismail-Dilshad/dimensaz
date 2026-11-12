<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo/svg/dimensaz-horizontal-for-dark.svg">
    <img src="assets/brand/logo/svg/dimensaz-horizontal-for-light.svg" alt="Dimensaz" width="480">
  </picture>
</p>

<h1 align="center">Dimensaz</h1>

<p align="center">An open-source AI agent that works like a motion designer and a video editor.<br>English by default. Multilingual, including right-to-left languages.</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="skills/dimensaz/SKILL.md">Agent skill</a> ·
  <a href="agent/">Agent definition</a> ·
  <a href="#documentation">Docs</a>
</p>

## What it does

Dimensaz runs inside a coding agent such as Claude Code or Codex. You talk to the
agent; it plans, designs, renders and checks the video with local tools (Chromium for
frames, FFmpeg for encoding). No video-generation model is involved: every frame comes
from code, your assets and your footage, so every word, color and timing stays editable.

| You give it | It does |
| --- | --- |
| **A script only** | Asks a few briefing questions, proposes three design directions, and builds the one you pick. |
| **A script and a reference** (image, video or link) | Studies the reference's rhythm, easing, composition and look, then recreates that style with *your* logo, colors and fonts from `config/brand.json`. |
| **Your own footage** (talking head or any video) | Follows your edit instructions exactly. Without instructions it suggests edits; with a style reference it edits in that style. |

Subtle motion is added by default (gentle entrances, punch-ins on key words). Say
"no automatic motion" to turn it off for a project.

### Languages

- **English** is the default. Language is detected from the script; you can always
  name it.
- **Languages:** English by default. Right-to-left scripts (Arabic, Persian and others)
  get correct shaping, whole-word animation and mirrored layouts; any language the
  bundled fonts cover works.

Every bundled font is open-licensed (SIL OFL) and chosen to fit the video's style and
language.

## Quick start

You need Node.js 22 or newer and pnpm 11.

```bash
git clone https://github.com/Ismail-Dilshad/dimensaz.git
cd dimensaz
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dimensaz init      # language, brand profile, tool check
```

Then open the folder in your agent:

- **Claude Code:** run `/dimensaz`, or just describe the video you want.
- **Codex or other agents:** they read `AGENTS.md`, which points to the skill.

Example requests:

```text
Make a 30-second vertical motion video from script.txt. Ask me what you need.
Recreate the style of reference.mp4 for my script, with my brand colors.
Edit interview.mp4: cut the pauses, reframe to 9:16, add captions.
```

## Commands

The agent runs these for you; they are listed for scripting and debugging.

| Command | Purpose |
| --- | --- |
| `pnpm dimensaz init` | First-run setup |
| `pnpm dimensaz doctor` | Check Node, FFmpeg, Chromium, fonts and audio tools |
| `pnpm dimensaz studio plan "REQUEST" --type KIND` | The studio that runs every job: a plan of tasks owned by roles (director, two department leads, specialists, an independent reviewer), each with its own playbook and lessons; feedback goes to the role responsible ([guide](docs/guides/studio.md)) |
| `pnpm dimensaz write "TOPIC"\|URL` | No script yet: the facts from a link or product page and a brief for the length you want; the agent writes the script, `--check` verifies it (length, hook, call to action, no invented figures or quotes) ([guide](docs/guides/write.md)) |
| `pnpm dimensaz make SCRIPT.txt [--voice]` | Script in, finished video out: storyboard, voice-over, an art director that fixes weak visuals, preview with quality checks, then `--approve JOB` for the final, other shapes and thumbnail ([guide](docs/guides/make.md)) |
| `pnpm dimensaz look learn URL --name NAME` | Learn a look from a video you like, then `make --like NAME`: same feel, never a copy ([guide](docs/guides/looks.md)) |
| `pnpm dimensaz music list\|add\|compose` | Background music that fits each video: your tracks by mood, else an original score; lowered under the voice ([guide](docs/guides/music.md)) |
| `pnpm dimensaz edit auto talk.mp4` | Talking-head footage edited automatically: pauses cut, punch-ins, designed visuals on what is said, captions, music ([guide](docs/guides/video-editing.md)) |
| `pnpm dimensaz create --manifest request.json` | Create a video job (`--resume JOB` to continue) |
| `pnpm dimensaz edit --edl edit.json` | Edit footage from an edit decision list |
| `pnpm dimensaz fonts recommend --file script.txt` | Fonts that cover a script, ranked by style |
| `pnpm dimensaz tools` | Every tool the agent can use, and its status |
| `pnpm dimensaz knowledge search "kinetic type"` | Search the motion and editing knowledge base |
| `pnpm dimensaz media silence\|scenes\|beats\|reframe\|cutout` | Media tools (install once with `pnpm media:setup`) |
| `pnpm dimensaz brain recall "saas promo"` | What it knows about motion design and editing, and how it learns from jobs, feedback, references and web study ([guide](docs/guides/brain.md)) |
| `pnpm dimensaz storyboard SCRIPT.txt` | Automatic storyboard: a visual designed from zero for every sentence, in a style generated new for the video, ready for your approval ([guide](docs/guides/storyboard.md)) |
| `pnpm dimensaz quality` | Automatic quality checks: text size, contrast, overlaps, cut-off text, empty frames and effect loudness, on every preview and across sample scripts; the art director's design checks and fixes ([guide](docs/guides/quality.md)) |
| `pnpm dimensaz pieces design "SENTENCE"` | What the designer makes of a sentence, including solid 3D (GPU-drawn figures, icons and shapes); `layers`, `sounds`, `check REQUEST.json` ([visuals](docs/guides/scene-pieces.md), [styles](docs/guides/piece-styles.md)) |
| `pnpm dimensaz reach tiktok search "saas promo"` | Read YouTube, Instagram, TikTok, X, Facebook, Pinterest, Dribbble and the web, read-only ([guide](docs/guides/reach.md)); `pnpm dimensaz browse` opens any page |
| `pnpm dimensaz source search "chair" --kind model` | Free 3D, textures, images, icons, video, sounds and reference videos, license-checked ([guide](docs/guides/free-sources.md)) |

All earlier `pnpm video:*`, `audio:*`, `assets:*` and `fonts:*` scripts still work.

## Live status viewer

The mascot shows what the agent is doing (thinking, planning, rendering, done).

```bash
python -m http.server --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/assets/brand/web/state-viewer.html> while a job runs.

## Project layout

```text
agent/           who the agent is: persona, policies, modes, questions, locales,
                 tools, knowledge, evals, status
skills/          the one workflow the agent follows (skills/dimensaz/SKILL.md)
src/             all product code
  engine/          planning, timing, language, fonts, production jobs
  renderer/        Chromium frame capture and FFmpeg encoding
  components/      scene building blocks
  animations/      motion primitives
  presets/         kinetic, presenter inserts, pendulum reveal, reference styles
  motion-library/  motion recipe search and analysis
  editor/          footage editing from an edit decision list
  cli/             the commands behind `pnpm dimensaz` and `pnpm video:*`
audio_pipeline/  optional local speech alignment (Python)
media_tools/     optional silence, scene, beat, face and cut-out tools (Python)
config/          defaults, brand (brand.json), locales, fonts, rendering, audio
assets/          fonts, brand kit, sound effects, asset library
                 (3D objects, vectors, backgrounds)
references/      reference styles, style-card library and motion examples
docs/            guides and records
examples/        smoke examples, sample requests and finished example scenes
scripts/         developer tools: checks, benchmarks, smoke tests, skill sync
tests/           Vitest suites
bin/             the `dimensaz` command
```

## Documentation

- [Agent skill](skills/dimensaz/SKILL.md): briefing, design, rendering and delivery
- [Agent definition](agent/README.md): persona, modes, questions, tools and knowledge
- [Production system](docs/guides/production-system.md): manifests, commands, recovery
- [Language support](docs/guides/language-support.md): scripts, direction and fonts
- [Voice synchronization](docs/guides/voice-synchronization.md) and [local audio pipeline](docs/guides/local-audio-pipeline.md)
- [Audit](docs/AUDIT.md) and [migration guide](docs/MIGRATION.md)
- [Changelog](CHANGELOG.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please read the [Code of Conduct](CODE_OF_CONDUCT.md)
and report security issues as described in [SECURITY.md](SECURITY.md).

## License

Dimensaz is licensed under the [Apache License 2.0](LICENSE) (see also [NOTICE](NOTICE)).
Bundled fonts (SIL OFL 1.1), CC0 sounds and other third-party material keep their own
open terms; see [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
