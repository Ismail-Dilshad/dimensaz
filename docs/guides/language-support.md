# Language support and fidelity

English (`en`) is the default language and Kurdish is first-class. When a request
omits `language` or says `"auto"`, the language is detected from the script: Kurdish
letters (ڕ ڵ ۆ ێ ە ڤ ھ) select Sorani (`ckb`), Persian letters select `fa`, other
Arabic script selects `ar`, and anything else selects `en`. Explicit `en`, `ckb`,
`ar`, `fa`, `badini` and `kmr` are accepted by config, the new-project CLI, requests
and conversational briefs. Kurmanji and Badini are never guessed; name them.
Badini can be supplied in Arabic or Latin script; the renderer does not translate,
transliterate, normalize, or guess a dialect from shared letters. Language metadata
is applied to text elements; direction comes from the first strong character in
each scene unless explicitly overridden. Embedded directional runs are isolated
so English phrases remain left-to-right inside Kurdish/Arabic/Persian, and Arabic
phrases remain right-to-left inside English.

Fonts follow the policy in `config/locales.json`:

- Kurdish in Arabic script (Sorani, and Badini or Kurmanji written in Arabic script)
  uses only the open fonts in `assets/fonts/open/` that cover every Kurdish letter. Choose among them by the
  video's style with `pnpm fonts:library recommend`. Missing glyphs are reported;
  the font is never silently swapped. Latin words inside Kurdish lines use the
  bundled Latin fallback.
- Every other language, including Kurmanji in Latin script, uses the bundled
  open-license fonts in `assets/fonts/open/`, chosen to fit the style. New fonts
  need an open license, its text, a catalog entry and the user's approval before
  download.
- New projects store their resolved font and fallback paths. Saved projects keep
  theirs and are never restyled. `VIDEO_LATIN_FONT` overrides the Latin fallback;
  a bad explicit path fails. No font is fetched by a network request at render time.

Every rendering checks font cmap coverage; unsupported emoji or other untested
characters still fail explicitly. Glyph coverage is not a guarantee of every
possible linguistic layout: inspect actual diacritics, joins, punctuation, and
mixed-direction phrases in previews. Browser tests cover representative examples,
Latin Kurdish diacritics, Persian ZWNJ, exact text, safe bounds, and deterministic
seeking. They are not a linguistic translation review.

## Voice

Supplied audio and reviewed hash-bound word alignment work for every supported
text language. Automatic acoustic model selection is currently vetted only for
Sorani. Other language requests produce pause/waveform evidence and unresolved
word times instead of using the Sorani model. They need a separately reviewed
provider/manual timing file for exact final rendering. No download, ASR accuracy,
or word timing is implied by selecting a text language. Automatic scores are never
marked reviewed. Exact mode remains blocked without complete evidence.

Without reviewed timing, use explicitly estimated phrase-hold drafts. Never infer
word timestamps from token counts, punctuation, sentence boundaries, or silence.

## Examples

`video:new --title "English" --file english.txt` (language detected)

`video:new --title "Arabic" --file arabic.txt --language ar`

`video:new --title "Persian" --file persian.txt --language fa`

`video:new --title "Badini" --file badini.txt --language badini`

A conversational brief uses `{ "language": "badini", "title": "…", "script": "…", "auto": true }`.
Choose this value from the user's stated language; do not ask them to author JSON.

## Font choices
Each language has a default in `config/locales.json`. For a deliberate style, consult
[font-library.md](font-library.md) and pass the named `fontPreset` request field.
Inspect glyph coverage and previews; existing projects retain their saved font paths.

