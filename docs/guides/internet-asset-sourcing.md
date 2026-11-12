# Internet asset sourcing

For searching and downloading free assets and reference videos by command, see
[free-sources.md](free-sources.md) (`pnpm tempoloom source`). This guide covers importing
reviewed assets into the asset library.

This extends `assets/library/vectors/manifest.json`: legacy assets remain unchanged and the
selector merges eligible records from `assets/library/<category>/<hash-id>/metadata.json`.
The renderer remains offline and deterministic. Internet activity occurs before planning.

## Agent workflow

1. Search `assets:library list` plus the existing manifest. Match relevance, style,
   format, editability and quality; a tag match alone is not visual approval.
2. When useful, run `assets:library discover --query smartphone`. The built-in
   provider searches the official Lucide repository at a resolved commit and retains
   its complete license. Provider results are candidates, not reviewed selections.
3. Inspect candidate imagery and license evidence with available agent research/browser
   tools. Prefer official APIs and legitimate direct downloads. Generic sources use
   a submission manifest validated by `submissionSchema` in src/engine/asset-library.ts.
   Never infer permissions from popularity, a free-download button, or a screenshot.
4. Use `assets:library download --manifest METADATA --url HTTPS_URL --hosts HOSTS`
   or `assets:library import --manifest METADATA --file FILE`. Hosts are exact permitted
   download/redirect hosts, not wildcard permissions. No credentials are accepted in URLs.
5. Inspect the generated preview. `evaluation.reviewed` is the agent's visual assessment,
   not an automatic quality score. Retain unknown rights as null and verified:false.
   Do not import restricted work as an original creation.
6. Add assetNeeds to the production request: scene (zero-based), query, tags, style,
   online. Suitable local entries are reused. Missing entries produce discovery
   evidence in events.jsonl and an actionable failed job; import a reviewed selection
   then resume the SAME job. Explicit scene.asset IDs work too. No text is rewritten.
7. Inspect video previews and the encoded frame through the existing workflow.
   Exports include a `.assets.json` sidecar with source and full licensing evidence.
   Distribute required notices with outputs; evaluate any additional attribution terms.

No network calls are introduced for old projects or requests without assetNeeds.
Use consistent styles across needs; agents may choose online alternatives by importing
and assigning an explicit asset ID. Local matches do not trigger unnecessary browsing.

## Safety and recovery

HTTPS only; public IPv4 DNS is pinned for each request; private addresses and arbitrary
redirect hosts are blocked. A request has a 20-second deadline, at most five redirects,
three attempts, and exponential waits of 250/500 ms. Only transient network failures,
408, 429 and selected 5xx responses retry. Authentication/403, missing assets, invalid
content and oversized files do not repeatedly retry. Default import/download cap: 25 MiB.

SVG uses Chromium XML parsing followed by a strict inert element/attribute allowlist.
Unsupported SVG features fail closed instead of silently changing artwork. Raster
signatures and browser decoding verify images; previews inspect sampled transparency.
Safe generated filenames and content hash IDs avoid traversal and overwriting.
Catalog commits use staging directories and rename; interrupted staging is ignored.
Do not run simultaneous imports of identical content. Duplicate bytes reuse the existing
record and do not upgrade its rights. Review a restricted record separately if new
license evidence is obtained; do not silently relabel it.

Archives are rejected, never automatically extracted. Obtain individual source files
or have an agent review/extract them using a traversal/symlink-safe tool. Lottie/glTF
imports reject external references and Lottie expressions. Executables are rejected.
Editable sources are inert catalog-only files, never opened by the rendering engine.
An optional scanner callback must throw on detection; unavailable scanning is recorded
explicitly. This is not a malware-free guarantee or a sandbox for opening editable files.

## Agent capabilities and reference capture

`sourceAsset` accepts optional discover/evaluate/browserDownload/generate adapters.
Absence is reported explicitly. Browser adapters must use the normal provider interface,
stop for login, payment, CAPTCHA or access-control decisions, and return actual downloaded
bytes through the SAME importer. Generation adapters must return original provenance.
These callbacks do not install a browser automation or generation service automatically.
Use tools available to the current agent, not guessed desktop capabilities.

`assets:library reference --manifest REFERENCE_METADATA --file SCREENSHOT.png` saves
internal-only screenshots separately to references/internet with creator, source URL,
date, description, style, design characteristics and restrictions. Screenshot capture
itself belongs to the agent's authorized browser tools. References never join the render
catalog. Original recreations use origin:original and referenceIds; adaptations require
verified modification permission and origin:adaptation. Record only high-level inspiration;
do not remove watermarks or reproduce distinctive protected artwork or branded assets.

## Capability boundaries

- Built-in discovery: Lucide official repository. Other official providers, stock,
  Lottie, 3D and GitHub resources can be researched by the agent and passed to the generic
  importer; there is no universal provider crawler or inferred license engine.
- Direct render: static SVG, PNG, JPEG, WebP. GIF is cataloged with a static preview but
  cannot be automatically rendered with uncontrolled playback.
- Catalog only: self-contained Lottie JSON, GLB/glTF, MP4/WebM and recognizable Blend/AEP
  source files. Their validation is structural/signature-level, not proof of complete
  editability. Native previews/conversion for these types are not yet implemented.
- Animated SVG is currently rejected by the inert SVG allowlist. Conversion must be
  reviewed and deterministic before render integration. No hidden real-time animations.
- No automatic style restyler or image-generation API is installed. Agents can create
  or adapt permitted assets with their available tools and register the resulting bytes.
- Asset evaluation and licensing remain evidence-based agent responsibilities.

## Verification

Run pnpm typecheck and pnpm test; RUN_BROWSER_TESTS=1 enables SVG/image import,
preview, deduplication, reference registration and adapter/reuse tests. Tests use synthetic
fixtures, mock HTTP responses and mock browser callbacks, not live provider downloads.
`node scripts/run-checks.mjs --import tsx scripts/asset-smoke.ts` creates a separate
original fixture asset and production job. Inspect its preview then resume for a render.

Live provider discovery attempted on 2026-10-26 failed with ENOTFOUND api.github.com.
Do not claim successful live downloads or real browser download flows from these tests.
No Python/audio code was changed. Existing media, fonts and exports are preserved.

Verified final checks: pnpm typecheck passed; RUN_BROWSER_TESTS=1 pnpm test passed 112 tests across 16 files, with one optional Python bridge test skipped. video:doctor confirmed FFmpeg, FFprobe and Chromium. The asset-library-integration-fixture_128 job rendered 360x640 at 12 FPS for 2.417 seconds; contact sheet and encodedFrame inspected, stream/full-decode validation passed, and the export licensing sidecar was checked. Existing exports were retained.

