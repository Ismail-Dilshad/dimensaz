# Font library

`config/fonts.json` is the catalog. `config/locales.json` maps each language to its
font source and default. Never modify or delete a font file; filenames follow
`Family-Variant-Weight.ext` and internal naming tables are untouched.

## Policy

| Text | Fonts allowed |
| --- | --- |
| Kurdish in Arabic script (Sorani, Badini, Kurmanji in Arabic script) | Only the open fonts in `assets/fonts/open/` that cover every Kurdish letter (`languages` includes `ckb`): Vazirmatn (default), Noto Sans Arabic, Noto Kufi Arabic, Noto Naskh Arabic, Amiri. |
| Everything else (English, Arabic, Persian, Kurmanji in Latin script, other languages) | Bundled open-license fonts in `assets/fonts/open/` (`origin: bundled-open-font`), chosen to fit the video's style. Installed system fonts remain selectable by explicit preset but are machine-specific. |

Adding a font: confirm an open license (OFL, Apache),
ask the user before downloading, put the file in `assets/fonts/open/` and its
license text in `assets/fonts/open/licenses/`, add a catalog entry with `sha256`,
`license`, `licenseFile`, `languages` and style `roles`, and list it in
`THIRD_PARTY_LICENSES.md`. A Kurdish font must contain every Kurdish letter
(ڕ ڵ ۆ ێ ە ڤ گ چ پ ژ ی ھ) before `ckb` goes into its `languages`.

## Choosing a font

Pick by the video's style, not at random. Keep one primary font per video and use
an alternate only for a purposeful change. Every catalog entry has `roles`
(for example `playful`, `editorial`, `tech`, `elegant`, `bold`, `headlines`) that the
recommender matches.

```bash
pnpm fonts:library list
pnpm fonts:library recommend --file SCRIPT --role editorial
```

Results are JSON, limited to the fonts the policy allows for the script's language,
and include the actual missing glyphs per font. Pass `fontPreset` (a catalog `id`)
in a request; it overrides `font`. Without either, the language default from
`config/locales.json` is used.

Coverage is technical evidence, not typographic judgment: inspect whole words,
right-to-left joining, punctuation and safe-area fitting in the preview. Never
change the source text to suit a font.

## Compatibility

Saved projects keep the font and fallback paths stored in their `project.json`.
Older projects that reference the Kurdish fonts removed in 5.4.0 (they had no license
allowing redistribution) are mapped to Vazirmatn when they load. Every bundled font is
under the SIL Open Font License; see `THIRD_PARTY_LICENSES.md`.
