# Sorani typography

Keep the original UTF-8 script unchanged, including ڕ ڵ ۆ ێ ە, numbers,
punctuation, spaces and line endings. No Markdown interpretation by default.
Use browser-native shaping with the project's Kurdish font (one of the existing fonts in assets/fonts) and direction on each block.
The viewport remains LTR. First strong character decides paragraph direction;
override direction in config for intentionally mixed paragraphs.

Word reveals clone the FULL shaped text and clip its measured word rectangles.
They do not separate letters or words into independent shaping runs.
Typewriter reveals whole word groups based on grapheme progress, deliberately
preserving Arabic joins; it is not a character-by-character reflow.

The TrueType cmap checker identifies missing glyphs before rendering and reports
the exact Unicode characters. Configure fallbacks in project.config.fallbacks.
Only explicit TTF/OTF cmap format 4/12 fallbacks are supported by preflight.
The browser may use OS fonts for glyph variants not caught by cmap, such as
complex emoji sequences; emoji should be avoided unless visually verified.

Layout shrinks between fontSize and minFontSize, then fails rather than clips.
Split long scenes at natural boundaries, preserving all characters in order.
Social safe area defaults: 9% horizontal, 12% top, 22% bottom.
Inspect mixed-script lines and punctuation in actual Chromium PNGs.
