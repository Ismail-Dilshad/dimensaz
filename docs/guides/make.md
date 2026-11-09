# One command: script to finished video

```bash
pnpm dimensaz make script.txt                      # no narration
pnpm dimensaz make script.txt --voice              # ElevenLabs voice-over (ELEVENLABS_VOICE_ID)
pnpm dimensaz make script.txt --voice VOICE_ID --look "calm paper, serif type"
pnpm dimensaz make --approve JOB                   # after looking at the preview
```

`make` runs the whole chain:

1. **Storyboard.** A visual designed from zero for every sentence and a new style for the
   video ([storyboard](storyboard.md)); `--look` passes your own words for the look.
2. **Voice-over**, only with `--voice` (and `ELEVENLABS_API_KEY` in `.env`). ElevenLabs returns
   word timings, so the scenes and every part of their visuals land on the spoken words
   ([scene visuals](scene-pieces.md#following-the-voice-over)). Without `--voice` there is no
   narration and nothing is paid for.
3. **The video job and its preview**, with the quality checks ([quality](quality.md)). It stops
   here so you can look at the contact sheet and `storyboard.md`.
4. **`--approve JOB`**: the final render, the other shapes (default 1:1 and 16:9) and a
   thumbnail, then the verdict command so the brain learns.

Everything for one video is in `workspace/makes/<title>/` (never overwritten): `storyboard.md`,
`request.json`, `voiceover.mp3` and `make.json`, which records the job, the style, the quality
score, the preview, the output files and the next step. The finished files go to your exports
folder as usual.

| Option | Meaning |
| --- | --- |
| `--text "..."` | The script inline instead of a file |
| `--voice [VOICE_ID]` | Add an ElevenLabs voice-over (list voices: `pnpm dimensaz media voices`) |
| `--look "WORDS"` | Your words for the look; the style is still new |
| `--title TEXT` | Title (default: the first sentence) |
| `--format 9:16\|1:1\|16:9` | The master shape (default 9:16) |
| `--formats 1:1,16:9,4:5\|none` | Other shapes to export (default 1:1,16:9) |
| `--no-thumbnail` | Skip the thumbnail |
| `--draft` | Faster, smaller render for a quick look (540×960, 30 fps) |
| `--yes` | Finish without stopping when the preview passes every quality check (unattended runs) |
| `--out DIR` | Another folder for the make files |

If the preview has quality problems, `make` reports them and does not finish on its own, even
with `--yes`; fix them or tell the user before approving.
