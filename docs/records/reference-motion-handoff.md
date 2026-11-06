# Reference motion handoff

The C: working copy contains the completed reference-style implementation and its
validated silent demonstration. The original D:\kurdish-text-animation-video project
is outside this session's writable roots, so changes have not been applied there.
Open that exact D: folder as the writable project to finish integration.

docs/archive/reference-motion-update/reference-motion-update.patch contains only source, project skill, documentation,
tests, and three new original SVG assets. It excludes dependencies, private recordings,
old projects, test caches, rendered videos and the unchanged source reference images.
docs/archive/reference-motion-update/reference-motion-update-manifest.json records the exact before/after SHA-256 values.

Before applying, verify the target matches each recorded before hash; a new file's
before value is null and that path must be absent. Stop if the target has changed.
Use `git -c core.autocrlf=false apply --check PATCH_PATH`, then
`git -c core.autocrlf=false apply PATCH_PATH` from the matching project root.
The per-command setting preserves the patch bytes without changing Git configuration.
After applying the patch, run `powershell -NoProfile -File scripts/migrate-reference-paths.ps1`
from that same project. This verifies all 69 source hashes, moves the seven style
folders into references/styles/custom-motion-shorts, archives the original skill
package under references/custom-motion-source, and removes only empty old folders.
The script is repeatable and refuses missing, altered, duplicate or unindexed files.
Reference images are moved locally, not embedded in the patch.
Run typecheck and the documented focused
browser tests, then save the changes with the project's usual version-control workflow.
No existing exports need to be replaced or removed.

For subsequent videos, ask: "Use custom-motion-shorts with style-5. Render a complete
vertical video from this exact Sorani script: [script]." Add a recording when precise
voice synchronization is required. The agent reads the skill, authors real scenes and
separate assets, inspects previews and completes video:create. Users do not have to
edit JSON. The reference planner intentionally does not pretend missing artwork exists.

Read reference-motion.md for supported scene fields and asset capabilities,
reference-motion-audit.md for the source review, reference-motion-task.md for the
improved original request, and reference-motion-verification.md for actual check results.
