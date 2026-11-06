# Font library

Rabar 021 Bold remains the primary font at assets/Rabar_021.ttf. That protected file
and every existing font's bytes are unchanged. The duplicate in assets/fonts now uses
the standard filename Rabar-021-Bold.ttf. Filenames follow Family-Variant-Weight.ext;
font-internal naming tables were not modified.

The other normalized files are NRT-Bold.ttf, Rabar-007-Regular.ttf, Rabar-010-Bold.ttf,
Rudaw-Regular.ttf, Sirwan-008-Regular.ttf and UniSalar-F-097-Regular.otf. Sirwan's
internal family says SiRWAN_008 despite its old SiRWAN_6.ttf filename.

Use Rabar 021 by default. For intentional variation, consider Rabar 007 for expressive calligraphic regular
weight, Rabar 010 or NRT for bold headings, Rudaw for editorial/news, and Sirwan or
UniSalar for an alternate look. These are selection suggestions; inspect full words,
RTL joining, punctuation and safe-area fitting before rendering. Never randomly mix
fonts across scenes or change the exact source text to accommodate a font.

The installed Arial (regular/bold), Segoe UI, Calibri and Georgia families are registered
as English options without copying or downloading system font files. Their absolute
local paths are machine-specific. Arial remains the existing missing-glyph fallback;
fallbacks cover missing characters and do not randomly restyle text already supported
by Rabar. Font availability does not constitute permission to redistribute font files.
Existing bundled fonts have no newly asserted licensing permissions.

AI interface: `pnpm fonts:library list` and `pnpm fonts:library recommend --file SCRIPT
--role editorial`. Results are JSON and include actual per-font missing glyphs. Pass
fontPreset in video:create requests: rabar-021, rabar-007, rabar-010, nrt-bold, rudaw,
sirwan-008, unisalar-f-097, arial, arial-bold, segoe-ui, calibri, georgia. fontPreset
selects the project's primary font and takes precedence over font; omit it to retain
the default. Prefer one primary font per video and use alternatives for a purposeful
style change. English projects can explicitly use an English preset. Config/fonts.json
is the catalog; config/typography.json remains the default render configuration.

Previous projects reference assets/Rabar_021.ttf and their saved fallback paths;
none required migration. No existing project manifests or MP4 exports were modified.


Verification: all seven renamed files retained their SHA-256 hashes, and the protected primary file remained unchanged. TypeScript passed; browser-enabled tests passed 122 with one optional audio bridge skip. All 12 font faces loaded in a visual specimen. A separate Segoe UI preset smoke video rendered at 360x640, 12 FPS, 2.584 seconds; contact sheet and encoded frame inspected, stream and full-decode validation passed.

