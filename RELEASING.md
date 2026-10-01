# Releasing

Every change takes the same path from idea to live. Each step has its real command. When something
goes wrong, or for the monthly upkeep, see [RUNBOOK.md](RUNBOOK.md). Commands are PowerShell 7, run from
the repository.

## 1. Plan

- [ ] An issue (Feature form) says what it is and **"Done when…"**, in plain words, in the milestone for its
      version.
- [ ] One feature is one minor version (`v1.9.0`); a fix to it is a patch version (`v1.9.1`). Version numbers
      are the only release names; roadmap and idea numbers are planning IDs.

## 2. Build

- [ ] A branch in its own worktree, never in the main checkout:

      git fetch origin
      git worktree add ..\water-tracker-<slug> -b feat/<slug> origin/main

- [ ] Commits start with `feat:`, `fix:`, `docs:`, `ci:` or `chore:` (Conventional Commits).
- [ ] A pull request whose Definition of Done (the template) is filled in.

## 3. Automatic checks

CI runs on every pull request and on `main`, as three checks: `check` (lint, typecheck, tests, build),
`secrets` (gitleaks over every commit) and `audit` (dependencies with a known high or critical
vulnerability). All three must be green to merge.

## 4. Try it on staging

- [ ] From the branch's worktree: `.\scripts\deploy.ps1 staging`. It deploys the branch's **last commit**;
      uncommitted edits are not included. Staging has its own database of demo data, never live's.
- [ ] Try it on a phone, and write what you did and saw in the pull request.
- [ ] Run the main-path browser test against staging: `bun run e2e` (log, undo, refill, a changed time,
      yesterday, offline and back, the update banner, no sideways scroll; it cleans up after itself).

## 5. Release

- [ ] In the pull request: set `package.json` to the new version, and move the CHANGELOG's `[Unreleased]`
      entries under `## [1.9.0] — YYYY-MM-DD`, with its compare link at the bottom. Add **Upgrade notes** if
      anyone hosting the app must do something (a new `.env` setting, a manual step).
- [ ] The maintainer merges.
- [ ] Tag the merge commit and push the tag:

      git checkout main
      git pull
      git tag -a v1.9.0 -m "v1.9.0 — short title"
      git push origin v1.9.0

  The Release workflow publishes the GitHub Release from that CHANGELOG section, and refuses a version
  the CHANGELOG doesn't describe.

## 6. Deploy

- [ ] Wait for CI to finish on the tagged commit (merging to `main` runs it).
- [ ] Check first, then deploy:

      .\scripts\deploy.ps1 live v1.9.0 -DryRun
      .\scripts\deploy.ps1 live v1.9.0

  It refuses a commit whose CI didn't pass, then: builds or reuses `water-tracker:v1.9.0` → backs up the
  database (`water_tracker_pre_v1.9.0_<date>.dump` in `BACKUP_DIR`) → migrates → swaps the container →
  checks `/api/health` and that Today, History and Settings load from v1.9.0. Its last line is the
  command to go back.
- [ ] On the phone, an open app shows **New version — tap to reload**; tap it and look at the main screens.

## 7. If it's wrong

Roll back with the command the deploy printed, e.g. `.\scripts\deploy.ps1 live v1.8`: seconds, no data
lost. Restoring a backup is the last resort. Both are in [RUNBOOK.md](RUNBOOK.md).

## 8. Clean up

- [ ] Remove the worktree and the merged branch:

      git worktree remove ..\water-tracker-<slug>
      git branch -d feat/<slug>

- [ ] Close the issue and the milestone.
