## What and why

<!-- What changes for someone using the app, and why. Link the issue: "Closes #12". -->

## How it was tested

<!-- On staging (.\scripts\deploy.ps1 staging) and on a phone: what you did and what you saw. -->

## Definition of Done

- [ ] One feature or fix, and the issue's "Done when…" is met
- [ ] Logic in `src/lib/` with tests; CI is green (`check`, `secrets`, `audit`)
- [ ] Tried on staging, on a phone, and written up above
- [ ] Database changes only add (the previous release still runs on the new schema), or there are none
- [ ] Anything that logs works offline and syncs later
- [ ] Docs match what changed (README, CONTRIBUTING, RUNBOOK, `.env.example`)
- [ ] CHANGELOG entry under `[Unreleased]`; for a release, `package.json` and the `## [X.Y.Z]` section too
- [ ] Public-repo check of the diff, the commits and this description: no personal or health data, no
      screenshots of a real log, no internal hostnames, IP addresses or machine paths
