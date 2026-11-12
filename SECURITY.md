# Security policy

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting
(Security tab, "Report a vulnerability") on this repository. Include steps to reproduce,
the affected command, and your OS. You should get a reply within a week.

## Scope

Tempoloom runs locally. It launches Chromium and FFmpeg, reads media you give it,
and can download sounds or models when you approve. Things we treat as security issues:

- A crafted script, project file, request manifest or media file that runs commands,
  writes outside the project folders, or overwrites existing exports.
- Downloads that bypass the allow-listed hosts or the license checks.
- Secrets from `.env` appearing in logs, previews or exports.

Keep API keys in `.env` (never committed) and review what an agent is about to
download before approving it.
