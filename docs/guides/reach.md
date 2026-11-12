# Reach: social platforms, the web and a browser for the agent

`pnpm tempoloom reach` gives the agent read-only access to YouTube, Instagram, TikTok, X,
Facebook, Pinterest, Dribbble, Behance, Threads, Vimeo, Reddit, LinkedIn, Bluesky,
Product Hunt, Google (images, trends, news), GitHub and any web page.
`pnpm tempoloom browse` opens and reads any page in the agent's own browser.

It is a port of [Agent Reach](https://github.com/Panniantong/agent-reach) (MIT): the
same design and the same upstream tools, with Tempoloom's own channels.

## How it works

| Part | What it does |
| --- | --- |
| **Channels and actions** | Each platform is a channel with actions (`search`, `profile`, `posts`, `video`, `transcript`, `comments`...). Each action has checked arguments, an ordered list of backends, and a live test. |
| **Backends** | [OpenCLI](https://github.com/jackwener/opencli) 2.0.2 (Apache-2.0) reads logged-in sites through a browser extension; [yt-dlp](https://github.com/yt-dlp/yt-dlp) reads and downloads videos; [Jina Reader](https://jina.ai/reader) reads any page as text; [Exa](https://exa.ai) free search finds pages; ElevenLabs transcribes only when asked. |
| **Dispatcher** | Tries backends in order and falls back on recoverable errors (broken, timeout, not installed). Stops at once on not found, bad input, needs login, rate limited, blocked by the platform, or busy. |
| **One result shape** | `{schema_version, ok, channel, action, backend, items, meta, error}`. Items: title, url, author, published_at, text, raw. Error codes: `NEED_SETUP`, `NEED_LOGIN`, `UPSTREAM_BROKEN`, `TIMEOUT`, `RATE_LIMITED`, `PLATFORM_BLOCKED`, `NOT_FOUND`, `BAD_INPUT`, `BUSY`, each with a hint saying what to do. |
| **Protection** | Searches on one site at least 10 s apart; at most 2 browser commands per site and 4 overall, others wait up to 2 minutes; a rate limit pauses that channel for 1 hour; a broken backend pauses for 1–2 minutes. |
| **Public first** | Until a login site is set up (`reach add`), searches and links go to the public web first (Exa with `site:` filters, Jina), labelled as public page text. The same route is the last resort when site tools fail. |
| **Tempoloom browser** | One profile in `.tempoloom/reach/browser/`, separate from your own Chrome. Playwright Chromium with the OpenCLI extension (downloaded once and hash-checked), or CloakBrowser if chosen. Runs hidden, closes after 10 minutes unused; a window opens only for logging in. |
| **Logins** | The first time a site is used, its login (that site's cookies only) is copied once from your own Chrome when it runs the OpenCLI extension. Otherwise `reach login CHANNEL` opens a window and you log in yourself. The agent never logs in for you and never asks for a password. |
| **Read-only** | Only commands OpenCLI marks as read can run; every write command (like, follow, comment, post, delete...) is refused in code. |
| **Memory** | `.tempoloom/reach/state.json` keeps only pauses, rate limits, added channels and login records: never searches, results or cookies. Secrets are removed from every error message. Only public http(s) links are accepted. |

## Commands

```bash
pnpm tempoloom reach channels                 # channels, actions, set up or not, logged in or not
pnpm tempoloom reach add instagram tiktok x facebook pinterest   # set up (automatic)
pnpm tempoloom reach login instagram          # window for you to log in (or --import from your Chrome)
pnpm tempoloom reach doctor                   # what works and what is missing
pnpm tempoloom reach check                    # one live test per action

pnpm tempoloom reach youtube search "saas promo video" --limit 10
pnpm tempoloom reach youtube transcript https://youtu.be/ID           # subtitles; --allow-upload uses ElevenLabs
pnpm tempoloom reach youtube comments https://youtu.be/ID --limit 30
pnpm tempoloom reach tiktok search "app launch" --limit 10
pnpm tempoloom reach tiktok explore
pnpm tempoloom reach instagram profile brandname
pnpm tempoloom reach instagram posts brandname --limit 12
pnpm tempoloom reach x search "motion design" --limit 10
pnpm tempoloom reach facebook profile brandpage
pnpm tempoloom reach pinterest search "kinetic typography poster"
pnpm tempoloom reach dribbble search "saas dashboard animation"
pnpm tempoloom reach behance search "brand motion"
pnpm tempoloom reach linkedin company stripe
pnpm tempoloom reach producthunt today
pnpm tempoloom reach google trends --region US
pnpm tempoloom reach github search "lottie animation"
pnpm tempoloom reach read https://www.instagram.com/reel/ID/   # any link: right channel automatically

pnpm tempoloom reach download URL              # title, length, size first
pnpm tempoloom reach download URL --confirm [--section 0-30]   # study-only reference download

pnpm tempoloom browse open https://example.com
pnpm tempoloom browse state | extract | screenshot | scroll down | find --css "h1"
pnpm tempoloom browse click 3 | type 2 "search words" | keys Enter | back

pnpm tempoloom reach logout instagram | remove instagram | update | uninstall
pnpm tempoloom reach browser status | stop | profiles | use ID | engine chromium|cloak
```

Options for every action: `--timeout SECONDS`, `--backend NAME`.

## Downloads

`reach download` saves reference videos to `workspace/downloads/reference/<site>-<id>/`
with a `source.json` marked study-only. It uses yt-dlp with the Tempoloom browser's login
for that site only (a private temporary cookies file, deleted after the call), then
OpenCLI's own download for Instagram, X and Pinterest. Always show the user the title,
length and size first and download only after they agree. Never put a reference
video, its frames or its audio in a final video.

## Browser engines

- **chromium** (default): Playwright's full Chromium, already used by Tempoloom. Loads the
  extension on Windows, macOS and Linux with no clicks.
- **cloak**: CloakBrowser 0.6.3 (Agent Reach's preferred engine), a Chromium build made to
  avoid bot detection. `pnpm tempoloom reach browser engine cloak` installs it into `.venv`
  and downloads its browser (about 200 MB); `engine chromium` switches back.

## Limits

- Instagram, Facebook, TikTok and X are experimental in Agent Reach and OpenCLI: they can
  break when the sites change. `pnpm tempoloom reach update` and updating Tempoloom fix most.
- These platforms forbid automated collection in their terms and can limit accounts; use
  a second account where possible. The pacing and read-only rules lower the risk, not
  remove it.
- Public web results are page text or search hits, not complete data.
- Another OpenCLI (for example OpenCLIApp) of a different version running on the same
  computer is left alone; close it if `doctor` reports it.
