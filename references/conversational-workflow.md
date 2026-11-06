# Conversational video creation

Codex is the conversational interface. The CLI is internal implementation;
never require the user to operate it or author JSON.

When the user asks Create a video / Animate this script:
1. Preserve their exact script and inspect all attachments. Resolve local media
   paths; classify voice, footage, image/logo, music or SFX. Probe media duration.
2. Collect only unspecified preferences in ONE short message:
   1 Animation: Viral CapCut/Reels, Minimal Kinetic, Premium SaaS,
     Claymorphism 3D, Cinematic, Auto Creative
   2 Visual: White (plain), White Grid, Dark, Gradient, Auto
   3 Energy: Smooth, Balanced, High Energy
   4 Assets: Text Only, Animated Objects, Auto
   5 Format: 9:16 default; 1:1 or 16:9 optional
   Example reply: 1 Auto, 2 White Grid, 3 High Energy, 4 Animated Objects, 5 9:16.
   Omit answered rows; do not repeat format if its default is acceptable.
   Auto / surprise me / use defaults authorizes your design choices.
3. Internally save a brief JSON with title, exact script, preferences and media.
   Set language to ckb (default), en, ar, fa, kmr, or badini from the user’s stated language. Do not infer a dialect from shared Arabic-script letters.
   Canonical styles: viral|minimal|saas|clay|cinematic|auto;
   visual: white|white-grid|dark|gradient|auto; energy: smooth|balanced|high;
   assets: text|objects|auto. Defaults format 9:16. auto:true skips questions.
   Run video:brief --file INTERNAL_BRIEF.json and retain session ID.
   Run video:answer --session ID --text REPLY when the user answers.
   Map natural-language answers to canonical preferences yourself if necessary.
4. Run video:prepare --session ID. This creates a unique project, imports media,
   refreshes references, plans scenes, and produces a contact sheet.
   Inspect actual images. Fix visible problems in the NEW project only.
5. Run video:finish --session ID --approve-preview after YOUR visual inspection.
   This renders, validates, and exports uniquely to mp2/. Inspect encodedFrame.
6. Return filename/full path, duration, resolution/FPS, chosen style and material
   limitations. No extra user confirmation between production stages.

Voiceover:
- Probe actual duration. Check whether local transcription/alignment tools are
  available and trustworthy for Sorani before claiming speech synchronization.
- If reliable timestamps exist, supply brief.alignment entries with EXACT scene
  text and contiguous start/end seconds. The final tail covers the voice duration.
- Without reviewed word alignment, allow only an explicitly labeled estimated
  preview with full phrase holds. Block exact-sync final rendering; never claim
  word-level sync from reading-load timing or silence detection.
- Do not time-stretch, speed up, normalize or fade the supplied voice by default.
  AAC muxing is lossy; source files remain untouched. No SFX unless permitted.
- If audio is too short to read the script, explain the conflict and seek a
  content/timing choice; never silently rewrite the script or speed the recording.
- No transcription service is bundled. Codex may use available tools and pass
  their verified timings; a transcript alone does not establish alignment.

References are optional. Reviewed local techniques guide motion; unknown media
requires visual review. Use built-in assets/knowledge when no suitable references
exist, and research primary sources when useful and internet is available.
Clay style uses existing 2.5D illustrations; do not imply true 3D modeling.
Uploaded logos remain supplied imagery and are not recreated automatically.

Use typography-first kinetic presentation for new briefs: subtle white grid on Auto, no cards or progress strip, and no automatic icons. Explicit White Grid retains the grid; explicit Animated Objects permits assets. For requests to change a finished video, create a revision and retain the voiceover and script. Do not ask answered preferences again. Vary complete-word slide-up, centered word replacement and phrase entrances with larger primary-colored key words. See kinetic-typography.md.

Exact-sync voice workflow: sync defaults to exact. Supply wordAlignment containing reviewed genuine timestamps, matching audioSha256, method and source. prepare may produce a blocked draft preview; finish must reject it without valid word cues. Sentence alignment alone does not establish word sync. Use sync: estimated only for an explicitly labeled draft or when the user accepts approximate timing. Use phrase holds instead of racing word animations in those drafts. See voice-synchronization.md.

Local pipeline: prepare automatically runs cached-only CTC analysis when an exact-sync voice brief lacks reviewed timing. The returned review.html and alignment.json are for inspection/correction. Inspect errors, vocabulary support and confidence flags. Missing model dependencies do not authorize guessed timing. Use audio:apply only after every word has been reviewed; render the returned new revision.

Read language-support.md for multilingual text, local font portability, and the distinction between text rendering and vetted speech models. Failed preparation attempts are retained; retry creates a separate attempt. Missing Python dependencies leave a blocked design preview available.
