# Backup and move

Everything the studio learned fits in one file. Keep it somewhere safe, or open it on another
computer and carry on where you stopped.

## What is in a backup

| Part | From |
| --- | --- |
| Lessons and their scores (wins, losses, status) | the brain database |
| Taught videos: their measurements and lessons (never the videos) | the brain database |
| Videos the studio made (brain records) | the brain database |
| Your taste profiles | `agent/brain/taste.json` |
| Your feedback rules and their history | `agent/knowledge/memory.md`, `feedback.jsonl` |
| Studio jobs and your ratings (plans, events, text outputs) | `workspace/studio/` |
| Thumbnails of taught videos | `.tempoloom/teach-thumbs/` |
| Gallery stars and ratings, your settings | `.tempoloom/` |

Never in a backup: your keys, your videos, previews or exports, and anything outside these
places. Every file in a backup has a checksum in its `manifest.json`; a damaged or changed backup
is refused, and a file in a place a backup never writes is ignored.

## Make one

- In the app: **Backup and move** (bottom of the menu), then **Download a backup**, or **Save
  one in the backups folder**.
- In a terminal: `pnpm tempoloom backup` (writes `backups/tempoloom-backup-DATE.zip`), or
  `pnpm tempoloom backup create --out D:/safe/tempoloom.zip`.
- By itself: once a week, when the app opens, a backup goes to `backups/auto/`; the four newest
  are kept. The `backups/` folder is never committed.

## Restore, or move to another computer

1. On the new computer, install Tempoloom (`pnpm install`).
2. In the app, **Backup and move**, then **Choose a backup file**. It shows what the backup holds
   and what would change: new, updated, the same, or yours kept. Nothing changes yet.
3. Choose how, then **Restore**:
   - **Merge** (recommended): newer wins item by item, nothing is removed, and your own settings
     and taste profiles on this computer stay. A job you deleted here stays deleted.
   - **Replace**: the backup wins everywhere it has something.

Or in a terminal: `pnpm tempoloom backup check FILE.zip`, then `pnpm tempoloom backup restore
FILE.zip --yes` (add `--replace` to replace).

Before any restore, a backup of what is here is saved as `backups/tempoloom-before-restore-DATE.zip`,
so a restore can always be undone by restoring that file with `--replace`.

Keys stay on the computer they were typed on: connect them again in **Models and keys** on the
new one.
