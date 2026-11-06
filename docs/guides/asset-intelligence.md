# Asset intelligence and creative reuse

## Commands
All commands return JSON through `pnpm assets:library`:
- search --query "mobile phone notification" [--project ID]: Unicode token search,
  curated English synonyms, weighted tags/name (3), description (2), style/category/
  measured colors (2), and project usage titles (1). Exact material match adds 2 for
  ranking with a project profile. No embedding service is required or called.
- assess --id ASSET: explicit checks, blockers, warnings, passed-check percentage.
- similar --id ASSET: 8x8 luminance distance from cached preview pixels; appearance
  matching only, not semantic recognition. Old assets without metrics report unavailable.
- style --project ID: stored Style DNA and a reusable generation/recreation prompt.
- check --id ASSET: actual existing compositor render at 360x640 for supported formats.
- recipes --file REFERENCE_RECORD.json: persist hash-addressed reviewed motion recipes.
Existing list/discover/import/download/reference commands remain available.

## Quality evidence
New imports cache coverage, luminance range, horizontal edge density, quantized colors
and an 8x8 signature from a maximum-512px preview. Transparent cutouts, raster short-edge
resolution (128px default or caller's targetPixels), deterministic format support,
verified commercial rights and adaptation rights are explicit gates. Empty content
(<=0.5% visible coverage) fails. Dense detail (>45% horizontal edges) is a warning.
The percentage is literally checks passed / checks evaluated, not an AI quality rating.
Legacy subjective ratings do not determine this score. Existing visual review remains
required for automatic reuse. Pixel evidence cannot establish semantic subject relevance,
mobile legibility of embedded text, edge halos, or good composition. Review these visually.

New supported-image imports run through the existing Chromium compositor before catalog
commit. Unsupported formats report supported:false, not a fictitious successful render.
No Lottie, animated SVG or 3D runtime was added. Unsafe or externally dependent formats
retain the existing rejection rules. SVG normalization preserves original bytes in an
original-source file when normalization changes them. No destructive conversion occurs.

## Style and versions
For newly generated 3D object assets (including 3D-style PNGs), use the
[neutral master and palette variant contract](production-system.md#neutral-masters-and-video-palette-variants).
Theme colors belong in derived variants, not in the reusable source. Region masks
must match source pixels; each selected colored variant remains separately registered
and pinned. Existing colored assets and project locks are not migrated implicitly.

New projects receive styleDNA: palette, typography, material, lighting, perspective,
spacing, composition choices, animation energy/easing/entrance and variation guidance.
Requests may supply a validated profile. Palette, alternating layouts and motion guidance
feed planning; material guides asset matching. Text, word cues and voice timing remain
unchanged. Lighting/perspective/material guide prompts and review; the renderer does not
synthesize 3D lighting or change a raster's perspective. Explicit font configuration still
controls fonts; profile typography is guidance, not a font download instruction.

New project previews pin selected assets into input/asset-locks with SHA-256 and provenance
stored in project.json.assetLocks. Rendering uses those files rather than mutable catalog
entries. Revisions copy input dependencies. Existing legacy projects without styleDNA are
not migrated implicitly. No cleanup deletes originals, locks, variants or completed media.
Asset variants use distinct content IDs and parentAssetId, requiring parent modification
permission. Equal bytes deduplicate; duplicate imports never silently rewrite metadata.

## Recipes and caching
Reference annotation automatically emits immutable recipes in motion-library/recipes.
Only reviews whose hash matches the indexed source are eligible. Recipes retain source,
range, typography, layering, interaction notes, registered presets, reviewed guidance,
confidence basis and uncertainties. Cut intervals remain measured pixel-change candidates.
Camera evidence may be null; exact keyframes, camera paths and easing are not recoverable
from these measurements. Confidence is the minimum of supplied review/technique confidence,
not an automatically calibrated probability. Existing motion selection continues to use
reviewed guidance; recipes preserve it for reuse without copying source footage.

Successful official discovery results cache for 24 hours in workspace/cache/asset-discovery.
Failures are not cached. Hash-deduplicated imports reuse existing previews. Search builds a
small in-memory metadata index per command; no expensive vector database or AI calls.

## Tests
Run pnpm typecheck and RUN_BROWSER_TESTS=1 pnpm test. The asset-intelligence tests cover
quality gates, natural-language retrieval, style prompts, image metrics/similarity,
review-bound recipe extraction, project locks/revisions and compositor compatibility.
No new model or dependency installation is required. Live network and browser-download
limitations from internet-asset-sourcing.md still apply.

## Verification on 2026-10-26
TypeScript passed. Full browser-enabled suite: 119 passed, one optional audio bridge test skipped. After the fingerprint reload regression was added and fixed, all 15 asset-intelligence and production-orchestration checks passed. video:doctor confirmed FFmpeg/FFprobe/Chromium. The separate asset-library-integration-fixture_186 smoke project rendered export002 at 360x640, 12 FPS, 2.417 seconds; fresh preview and encodedFrame inspected, stream and full-decode validation passed. Prior exports retained. Skill frontmatter and reference links validated. Git staging of the skill failed because .git/index.lock was permission denied; documentation remains local.

