# Music

Every new motion video gets background music that fits it (`"music": "auto"`, the default):

1. **The mood** comes from the script's words and the video's style: calm, warm, inspiring,
   upbeat, playful, energetic or dark (`"musicMood"` or `make --mood` to choose it).
2. **Your library first.** A track of that mood from `assets/music` (varied between videos)
   is cut to the video: it starts on its first beat, loops on whole bars with a short crossfade
   when it is shorter than the video, and fades over its last bar so it ends with the video.
3. **Otherwise an original score**, composed for this video and free to use: the mood sets the
   tempo, key and instruments (pads, plucked arpeggios, bass, drums), the video picks the key,
   chords and patterns so no two videos share a piece, the chords change where the scenes
   change, drums come in after the opening scene, and it ends on a held chord exactly as the
   video ends.
4. **Mixed under the voice.** With a voice-over the music sits about 10 dB lower and dips
   further while words are spoken (the scene sound effects keep their own level); without one
   it carries the video. Both are levelled before mixing.

A CC BY track's credit is written to `NAME.credits.txt` beside the video and listed in the
result. `"music": "library"` uses only your tracks (and stops if none fits), `"composed"`
always composes, `"off"` has no music. A music file you add to the request's `media` yourself
is used as it is. No music is added over footage, reference styles, explainers or a director
(they have their own sound rules).

## Commands

```bash
pnpm tempoloom music list
pnpm tempoloom music add track.mp3 --mood calm,warm --license cc0
pnpm tempoloom music add song.mp3 --mood upbeat --license cc-by --credit "Song by Artist (CC BY 4.0, link)"
pnpm tempoloom music compose --mood playful --seconds 30      # hear an original piece
pnpm tempoloom music mood --text "Our family cafe welcomes everyone."
pnpm tempoloom source search "calm piano" --kind music          # find openly licensed tracks, then source download N
```

Tempo and beats are measured with FFmpeg alone (no extra installs).
