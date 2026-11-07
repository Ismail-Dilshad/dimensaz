# License decision (pending)

Dimensaz has no project license yet. Until one is added as `LICENSE`, the code is
"all rights reserved" by default, even though the repository is public, and
`package.json` stays `"private": true`.

## Options

| License | Summary | Good fit when |
| --- | --- | --- |
| Apache-2.0 | Permissive. Includes an explicit patent grant and requires keeping notices. | You want companies to adopt it safely; common for AI tooling. |
| MIT | Permissive and very short. No explicit patent grant. | You want the simplest possible terms. |

Both allow commercial use, modification and redistribution.

## Before choosing, resolve the open items in `docs/AUDIT.md`

The project license covers only the code and assets you own. Bundled third-party
material keeps its own terms (see `THIRD_PARTY_LICENSES.md`). These need a decision
before a public release:

1. Kurdish fonts in `assets/fonts/`: redistribution rights unknown.
2. 31 sound effects with no recorded license.
3. About 167 MB of third-party reference images under `references/`.

## To finish

1. Add the full license text as `LICENSE` at the repository root.
2. Add `"license": "Apache-2.0"` (or `"MIT"`) to `package.json`.
3. Delete this file.
