# Your taste, the self-check and the guesses

Three things make the studio's first version closer to what you want: a taste profile it starts
from, a check of its own preview against that profile before you see it, and a guess of how you
will rate each step.

## The taste profile

`pnpm tempoloom taste show` (or **Your taste** in the app) is one page of what you like:

| Part | Comes from |
| --- | --- |
| Lines by topic | Lessons you kept or that jobs proved, your feedback rules, and lines you write |
| Targets | The ranges your good examples share (the [patterns](teach.md)), or numbers you set |
| What you reject most | The reasons of your bad ratings |
| In your own words | Notes you write |

You can switch any line off, add your own, set or reset a target, and ignore a pattern. Your
edits are in `agent/brain/taste.json`; everything else is rebuilt from the brain each time.

**Profiles.** `taste new "Client name" --videos ID,ID` makes a profile for a client or a brand,
based on all taught videos or only some, with its own lines and targets. A brief on the Studio
page can choose one; `studio start` gives every role the profile's lines for its topics.

```bash
pnpm tempoloom taste show [PROFILE]          # as text, for the agent
pnpm tempoloom taste add main --topic color "One warm accent colour only."
pnpm tempoloom taste off main LESSON_ID       # or: on
pnpm tempoloom taste target main shot-length 0.9 1.4
pnpm tempoloom taste target main loudness --clear
```

## The self-check

When the profile has targets, the step that makes the preview (`build`) cannot finish before
the agent has watched its own video:

```bash
pnpm tempoloom studio check JOB build preview.mp4
```

It measures the preview exactly like a taught video and compares it with the targets:

| Result | Meaning |
| --- | --- |
| matches | Inside your range |
| close | Just outside (within half the measurement's tolerance) |
| off | Further out: the report says what to change and whose step fixes it |

It also writes frame sheets (`workspace/studio/JOB/selfcheck/build/`) and lists the profile's
lines, for the agent to hold the frames against: something that breaks a line is a problem even
when the numbers pass. With anything off, `studio done` refuses until the video is fixed and
checked again (three tries), or the agent keeps it with a reason when the brief asks for
something else (`--accept "the brief asks for a slow, calm film"`). The result is shown on the
step's card.

## The guesses

When a step finishes, the studio guesses your rating from three things: how you rated that kind
of step before, how much the lessons it used are trusted, and what the self-check found. The
card shows the guess once six ratings of that step exist. When you rate, the guess is judged;
**Scores** counts how often it matched. Until 20 guesses are judged and 7 in 10 match, a guess
is advice only. After that, a first version you would probably reject is held back once: the
agent improves it, or finishes it with `--anyway`.
