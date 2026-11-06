# Reference audit — 2026-10-27

Historical audit: the scope and contact-sheet review below describe that earlier
session. Later individual-image inspection and application to the D: project are
recorded in [reference production verification](reference-production-verification.md).
Do not treat the historical blocked-installation note as current workspace status.

Inspected all 54 supplied JPGs in 12 labeled contact sheets, covering every folder.
Read all three files in custom-motion-shorts.skill. The archive is a prompt-directing
workflow, not executable rendering code. Original reading copies are retained unchanged.
The SHA-256 inventory records every supplied file, including empty motion documents.

| Folder | Images present | Image scene prompts | Motion evidence |
|---|---:|---:|---|
| style-1 | 10 | 10 | Written six-second directions |
| style-2 | 9 | 9 | Written six-second directions |
| style-3 | 8 | 9 | Written six-second directions |
| style-4 | 5 | 9 | Empty; motion must be designed |
| style-5 | 10 | 10 | Empty; motion must be designed |
| style-6 | 9 | 9 | Empty; motion must be designed |
| style-7 | 3 | 7 | Empty; motion must be designed |

## Findings that affect implementation

- Seven folders represent five palette families. Folders 1/2 share blue-white;
  folders 3/6 share red-black. Their scene themes and arrangements differ.
- Images emphasize one large physical metaphor, large connected Sorani headlines,
  solid accent keyword blocks, thin square/dot grids, two faint diagonals, restrained
  organic corners, soft ground shadows and sparse supporting accents.
- Hero placement varies: top/bottom captions, side compositions, text behind a hero,
  ghost words and selective foreground overlap. The new renderer implements safe
  top/bottom/side zones and ghost emphasis; it does not promise arbitrary text masking
  behind an opaque photograph.
- Motion directions request moving internal parts (crowds, knobs, drawers, darts,
  needles, keys, paper planes, liquid). A single PNG cannot reproduce these actions.
  Separate assets and part-level timing are required; true 3D articulation is not present.
- Several prompt scenes have no corresponding supplied image (style 3: one;
  style 4: four; style 7: four). Do not invent visual review of absent images.
- Style 4–7 motion files are zero bytes. Movement for these is inferred/design work,
  not recovered keyframes. Static posters cannot establish exact durations/easing.
- The source skill stops at prompts and uses baked-in lettering, English default,
  six-second scene templates and staged NEXT prompts. The adapter instead completes
  the existing MP4 lifecycle, keeps actual Rabar text and follows actual voice timing.
- Old reference copy includes GROW and marketing specifics. These are examples,
  not instructions to reintroduce copy the user has rejected. Preserve new source text.
- Asset sourcing already has importer/provenance checks and optional capability
  callbacks. It does not automatically provide image-generation or browser services.
- Existing compositor used the first imported image across all scenes or one small
  scene asset. New optional reference scenes use an explicit large hero plus independent
  parts, and all parts are now part of asset locks, fingerprints and export sidecars.
- Existing reference palettes were not represented as persistent renderable locks.
  New full snapshots prevent later preset edits from silently restyling old jobs.
- White-on-orange in style 4 has weak contrast. The adapter uses espresso lettering
  on orange blocks while keeping the reference accent/background values.

## Scope

Changes are prepared in the attached C: working copy of the D: project. Originals,
references/styles/custom-motion-shorts files, Rabar_021.ttf, old projects and MP4s are not modified.
Applying the prepared patch to D: remains a separate blocked step in this session.
Verification results are recorded in reference-motion-verification.md.
