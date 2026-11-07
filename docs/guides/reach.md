# Reach: social platforms, the web and a browser for the agent

`pnpm dimensaz reach` gives the agent read-only access to YouTube, Instagram, TikTok, X,
Facebook, Pinterest, Dribbble, Behance, Threads, Vimeo, Reddit, LinkedIn, Bluesky,
Product Hunt, Google (images, trends, news), GitHub and any web page.
`pnpm dimensaz browse` opens and reads any page in the agent's own browser.

It is a port of [Agent Reach](https://github.com/Panniantong/agent-reach) (MIT): the
same design and the same upstream tools, with Dimensaz's own channels.

## How it works

| Part | What it does |
| --- | --- |
| **Channels and actions** | Each platform is a channel with actions (`search`, `profile`, `posts`, `video`, `transcript`, `comments`...). Each action has checked arguments, an ordered list of backends, and a live test. |
| **Backends** | [OpenCLI](https://github.com/jackwener/opencli) 2.0.2 (Apache-2.0) reads logged-in sites through a browser extension; [yt-dlp](https://github.com/yt-dlp/yt-dlp) reads and downloads videos; [Jina Reader](https://jina.ai/reader) reads any page as text; [Exa](https://exa.ai) free search finds pages; ElevenLabs transcribes only when asked. |
| **Dispatcher** | Tries backends in order and falls back on recoverable errors (broken, timeout, not installed). Stops at once on not found, bad input, needs login, rate limited, blocked by the platform, or busy. |
| **One result shape** | `{schema_version, ok, channel, action, backend, items, meta, error}`. Items: title, url, author, published_at, text, raw. Error codes: `NEED_SETUP`, `NEED_LOGIN`, `UPSTREAM_BROKEN`, `TIMEOUT`, `RATE_LIMITED`, `PLATFORM_BLOCKED`, `NOT_FOUND`, `BAD_INPUT`, `BUSY`, each with a hint saying what to do. |
| **Protection** | Searches on one site at least 10 s apart; at most 2 browser commands per site and 4 overall, others wait up to 2 minutes; a rate limit pauses that channel for 1 hour; a broken backend pauses for 1–2 minutes. |
| **Public first** | Until a login site is set up (`reach add`), searches and links go to the public web first (Exa with `site:` filters, Jina), labelled as public page text. The same route is the last resort when site tools fail. |
| **Dimensaz browser** | One profile in `.dimensaz/reach/browser/`, separate from your own Chrome. Playwright Chromium with the OpenCLI extension (downloaded once and hash-checked), or CloakBrowser if chosen. Runs hidden, closes after 10 minutes unused; a window opens only for logging in. |
| **Logins** | The first time a site is used, its login (that site's cookies only) is copied once from your own Chrome when it runs the OpenCLI extension. Otherwise `reach login CHANNEL` opens a window and you log in yourself. The agent never logs in for you and never asks for a password. |
| **Read-only** | Only commands OpenCLI marks as read can run; every write command (like, follow, comment, post, delete...) is refused in code. |
| **Memory** | `.dimensaz/reach/state.json` keeps only pauses, rate limits, added channels and login records: never searches, results or cookies. Secrets are removed from every error message. Only public http(s) links are accepted. |

## Commands

```bash
pnpm dimensaz reach channels                 # channels, actions, set up or not, logged in or not
pnpm dimensaz reach add instagram tiktok x facebook pinterest   # set up (automatic)
pnpm dimensaz reach login instagram          # window for you to log in (or --import from your Chrome)
pnpm dimensaz reach doctor                   # what works and what is missing
pnpm dimensaz reach check                    # one live test per action

pnpm dimensaz reach youtube search "saas promo video" --limit 10
pnpm dimensaz reach youtube transcript https://youtu.be/ID           # subtitles; --allow-upload uses ElevenLabs
pnpm dimensaz reach youtube comments https://youtu.be/ID --limit 30
pnpm dimensaz reach tiktok search "app launch" --limit 10
pnpm dimensaz reach tiktok explore
pnpm dimensaz reach instagram profile brandname
pnpm dimensaz reach instagram posts brandname --limit 12
pnpm dimensaz reach x search "motion design" --limit 10
pnpm dimensaz reach facebook profile brandpage
pnpm dimensaz reach pinterest search "kinetic typography poster"
pnpm dimensaz reach dribbble search "saas dashboard animation"
pnpm dimensaz reach behance search "brand motion"
pnpm dimensaz reach linkedin company stripe
pnpm dimensaz reach producthunt today
pnpm dimensaz reach google trends --region US
pnpm dimensaz reach github search "lottie animation"
pnpm dimensaz reach read https://www.instagram.com/reel/ID/   # any link: right channel automatically

pnpm dimensaz reach download URL              # title, length, size first
pnpm dimensaz reach download URL --confirm [--section 0-30]   # study-only reference download

pnpm dimensaz browse open https://example.com
pnpm dimensaz browse state | extract | screenshot | scroll down | find --css "h1"
pnpm dimensaz browse click 3 | type 2 "search words" | keys Enter | back

pnpm dimensaz reach logout instagram | remove instagram | update | uninstall
pnpm dimensaz reach browser status | stop | profiles | use ID | engine chromium|cloak
```

Options for every action: `--timeout SECONDS`, `--backend NAME`.

## Downloads

`reach download` saves reference videos to `workspace/downloads/reference/<site>-<id>/`
with a `source.json` marked study-only. It uses yt-dlp with the Dimensaz browser's login
for that site only (a private temporary cookies file, deleted after the call), then
OpenCLI's own download for Instagram, X and Pinterest. Always show the user the title,
length and size first and download only after they agree. Never put a reference
video, its frames or its audio in a final video.

## Browser engines

- **chromium** (default): Playwright's full Chromium, already used by Dimensaz. Loads the
  extension on Windows, macOS and Linux with no clicks.
- **cloak**: CloakBrowser 0.6.3 (Agent Reach's preferred engine), a Chromium build made to
  avoid bot detection. `pnpm dimensaz reach browser engine cloak` installs it into `.venv`
  and downloads its browser (about 200 MB); `engine chromium` switches back.

## Limits

- Instagram, Facebook, TikTok and X are experimental in Agent Reach and OpenCLI: they can
  break when the sites change. `pnpm dimensaz reach update` and updating Dimensaz fix most.
- These platforms forbid automated collection in their terms and can limit accounts; use
  a second account where possible. The pacing and read-only rules lower the risk, not
  remove it.
- Public web results are page text or search hits, not complete data.
- Another OpenCLI (for example OpenCLIApp) of a different version running on the same
  computer is left alone; close it if `doctor` reports it.
