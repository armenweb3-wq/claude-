# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A single GitHub Actions automation that periodically fetches FIFA World Cup match
scores from the [football-data.org](https://football-data.org) v4 API and writes
them to a `live.json` file committed back into the repo. There is no application
build, package manager, dependency set, or test suite — it's a lone Node script
plus the workflow that runs it.

## Running locally

`scripts/fetch-scores.mjs` is a standalone ESM script run with plain Node (uses
the built-in global `fetch`, so Node 18+; CI pins Node 20). It takes no install step.

```bash
FOOTBALL_DATA_TOKEN=<your-free-api-key> node scripts/fetch-scores.mjs
```

It reads/writes `live.json` in the current working directory. The token is a free
key from football-data.org; in CI it comes from the `FOOTBALL_DATA_TOKEN` repo secret.

## Architecture / things to know

- **Two-stage change detection.** The script only treats the run as a *score*
  change when the `matches` array differs from the previous `live.json`; otherwise
  it still rewrites the file (refreshing `updatedAt`) and exits 0. The
  workflow's separate `git diff --quiet -- live.json` check is what actually
  decides whether to commit — so a pure `updatedAt` bump never produces a commit.
  Keep both halves of this logic in sync if you change the output shape.

- **The data window is yesterday → tomorrow (UTC)** so a run catches recently
  finished, in-play, and upcoming matches. Match `status` values from the API are
  `SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED`.

- **The workflow commits to a different branch than the default.**
  `.github/workflows/scores.yml` checks out and pushes to
  `claude/world-cup-betting-strategy-tsvivl` (not `main`), runs every 5 minutes
  on a best-effort cron, and can be triggered manually via `workflow_dispatch`.
  Commits use `[skip ci]` and a `concurrency` group to avoid overlapping/looping
  runs. If you rename the target branch, update the `ref:` in the checkout step.
