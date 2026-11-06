# Language support and fidelity

Sorani (`ckb`) is the default language. Explicit `en`, `ar`, `fa`, `badini`, and
`kmr` are accepted by config, new-project CLI, and conversational briefs.
Badini can be supplied in Arabic or Latin script; the renderer does not translate,
transliterate, normalize, or guess a dialect from shared letters. Language metadata
is applied to text elements; direction comes from the first strong character in
each scene unless explicitly overridden. Embedded directional runs are isolated
so English phrases remain left-to-right inside Kurdish/Arabic/Persian, and Arabic
phrases remain right-to-left inside English.

Rabar 021 is preserved. Its tested Arabic-script coverage includes Sorani,
Badini characters, Arabic marks, Persian letters, and Persian/Arabic digits.
Latin Kurdish Ş/ş require a fallback. New projects discover an explicit local
Arial/DejaVu Sans path, or use VIDEO_LATIN_FONT; a bad explicit override fails.
The default project stores the resolved path. No proprietary system font is copied
or redistributed. To move a project between machines, supply a compatible local
font path, regenerate the preview, and inspect it. Set `fallbacks` explicitly to
control the list. No font is silently supplied by a network request.

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

`video:new --title "Arabic" --file arabic.txt --language ar`

`video:new --title "Persian" --file persian.txt --language fa`

`video:new --title "Badini" --file badini.txt --language badini`

A conversational brief uses `{ "language": "badini", "title": "…", "script": "…", "auto": true }`.
Choose this value from the user's stated language; do not ask them to author JSON.

## Font choices
Keep Rabar 021 as the primary default. For deliberate alternate Kurdish or English styles, consult [font-library.md](font-library.md) and use the named fontPreset request field. Inspect glyph coverage and previews; existing projects retain their saved font paths.

