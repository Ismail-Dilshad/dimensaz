# Teach: train the brain with videos

`pnpm tempoloom teach` lets you teach Tempoloom with videos you choose. A video is copied to a
temporary folder, measured, looked at by your agent with your prompt, and deleted. Only numbers
and lessons go to the [brain](brain.md); your original file is never touched.

```bash
pnpm tempoloom teach open          # the Teach page (this computer only)
# in the agent's terminal, after you taught videos: "study the videos I taught"
pnpm tempoloom teach next          # what the agent runs
```

## The Teach page

`teach open` prints a link like `http://127.0.0.1:4747/?k=…` and opens it. The page listens on
this computer only and needs the key in the link. The same server has the
[Studio page](studio.md#the-studio-page) (the Teach / Studio switch at the top). On it you:

- **Add a video**: drop a file (up to 2 GB; `TEACH_MAX_MB` changes it) or paste a link. A link
  shows its title, length and size first and is downloaded, for study only, when you confirm
  (needs `pnpm media:setup`).
- **Choose the part**: play, step frame by frame, set the start and end (`I`, `O`), loop it.
- **Crop** the picture (free, 9:16, 1:1, 16:9, 4:5), for example to leave out a watermark or a
  phone's interface.
- **Mark moments** (`M`) with a note ("this transition"); the agent gets eight frames around each.
- **Say what to learn**: tick topics (pacing, transitions, motion, typography, colour, layout,
  sound, hook and script, captions, editing), write a prompt ("learn how the text enters; ignore
  the colours"), and say whether it is a **good** example or a **bad** one.
- Optionally study the sound (tempo, cuts on the beat) and read the speech (ElevenLabs, only
  when you tick it).

Teach and the [Studio](studio.md#the-studio-page) are one app: a sidebar with every section, a
Home screen (what the brain holds, what is waiting, what happened lately), a card that always
shows what to tell your agent, and a light or dark theme.

- **Teach a video**: drop several videos at once; each waits in a queue to be set up.
- **Library**: search and filter (good or bad, state, topic), sort, open a video for its
  measurements (cut strip, colours, motion, sound) and lessons, and compare any two side by side.
- **Lessons**: status chips (on trial, kept, removed), search, one card per topic with a
  confidence bar on every lesson, keep all on trial at once, write a lesson yourself (kept at
  once), and export everything as Markdown. Every lesson has Keep, Reword and Remove; a lesson
  that contradicts something known waits in a "To decide" card.
- **Patterns**: what your good examples share, one card per measurement: the range, a bar with
  each good example and the typical value, and a line saying what it means.

Everything is sorted by itself. Lessons, patterns and taught videos fall into three groups by
their topics: **motion design** (motion, typography, design, colour), **footage editing**
(editing, pacing, transitions, audio) and **storytelling** (script, captions); the three pages
start with the same tiles to choose one. A taught video also gets style tags from its
measurements (fast or slow cuts, calm or busy motion, dark or light look, vivid or muted colour,
cut to the beat, shape), and the Library filters by them.

## What happens to a video

| Step | Where | What |
| --- | --- | --- |
| 1. Arrives | `workspace/teach/<id>/` (temporary) | The upload and a small preview for the page |
| 2. Sent | same | The chosen part is cut and cropped (720 px); the upload and preview are deleted |
| 3. Measured | same | Numbers, a fingerprint, frame sheets for the agent |
| 4. Studied | agent's terminal | `teach next` → the agent opens the sheets → `teach learn` for each lesson |
| 5. Finished | — | `teach finish` deletes the folder. Kept: measurements and lessons in the brain (`agent/brain/videos.jsonl`), a small still in `.tempoloom/` for the page |

"Finish now" on the page does step 5 without the agent: the measurements still count.

## What is measured (FFmpeg only, nothing to install)

| Part | Numbers |
| --- | --- |
| Pacing | Hard cuts and their times, cuts per minute, typical shot length, the first cut |
| Motion | How much changes inside shots (not the cuts), share of still time, bursts, the busiest moment |
| Colour | Brightness, saturation, contrast, the main colours, background and accent |
| Layout | Fine detail, where it sits (top, middle, bottom), an 8×8 light map |
| Sound | Tempo, sound events a second, loudness, share of cuts on a beat against chance |
| Speech (optional) | Words a second, words in the first 3 seconds |

Text on screen is not measured; the agent reads it from the frame sheets.

## How learning stays clean

1. **Trial first.** A lesson from a video starts on trial. The agent tries it when it fits; two
   approved jobs make it proven (see the brain's scoring). "Keep" on the page approves it now.
2. **Noise is dropped.** Too vague ("the video looks nice"), or about a topic you did not tick:
   not saved, and listed on the page with the reason.
3. **Repeats merge.** A lesson already known (by its rare shared words) is not copied: the video
   becomes one more piece of evidence and the lesson's confidence rises. Seen in three taught
   videos, a trial lesson is approved.
4. **Opposites are flagged.** A lesson that says the opposite of something known is kept on trial
   and shown under "To decide". Against one of your own feedback rules, your rule wins.
5. **Removed stays removed.** A lesson you removed is never learned again from another video.
6. **Patterns need agreement.** For each measurement, when at least three good examples that
   were taught for that topic agree, their range becomes a pattern ("Shots last 1 to 1.1 seconds
   in your good examples"). A video far from the rest is left out; when the examples disagree
   there is no pattern. Two or more bad examples outside the range add what to stay away from.

Lessons carry their topics, so the [studio](studio.md) gives each to the role that owns the
topic. A lesson is a way of working, never the video's own words, logo, people or story.

## Videos like this one

`teach similar ID|FILE` compares fingerprints (pacing, motion, colour, sound, layout) and lists
the most alike taught videos with what they taught. The page shows the same under each video.
It compares measurements; it does not recognise objects or meaning.

## Commands

```bash
pnpm tempoloom teach open [--port 4747] [--no-browser]
pnpm tempoloom teach add clip.mp4 --topics pacing,audio --prompt "learn the cut rhythm" --start 2 --end 14 --mark "5.2:this transition"
pnpm tempoloom teach add clip.mp4 --bad --topics typography          # a bad example
pnpm tempoloom teach next                                            # the next video to study
pnpm tempoloom teach learn ID --topic pacing "Cut on the beat, about once a second at 120 BPM."
pnpm tempoloom teach finish ID
pnpm tempoloom teach list | show ID | similar ID | patterns
pnpm tempoloom teach keep LESSON | remove LESSON | forget ID
```
