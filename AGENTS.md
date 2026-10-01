<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Water Tracker: working in this repo

A self-hosted water and coffee tracker: Next.js (App Router), TypeScript, Tailwind for layout with the
Ink Kit stylesheet, Drizzle + `pg`, vitest, Docker. **This repository is public**: every file, commit
message and pull request is published.

## Commands

| What | Command |
| --- | --- |
| Install | `bun install` |
| Run locally (against staging's database) | `bun run dev` |
| What CI runs | `bun run lint` · `bunx next typegen && bunx tsc --noEmit` · `bun run test` · `bun run build` |
| Try a branch on staging | `.\scripts\deploy.ps1 staging` (PowerShell 7, from the branch's worktree) |
| Release, deploy, roll back, restore | [RELEASING.md](RELEASING.md) · [RUNBOOK.md](RUNBOOK.md) |

## Rules

- **Work in a git worktree on a branch** (`feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `ci/<slug>`), never in
  the main checkout and never on `main`. Commits use Conventional Commits (`feat:`, `fix:`, `docs:`, `ci:`,
  `chore:`). One feature per pull request, with the template's Definition of Done filled in.
- **Real logic goes in `src/lib/` as pure functions with tests**; components and scripts stay thin.
- **Never touch live data.** Try changes on staging, which has its own database of generated demo data.
  `bun run dev` and every script run without a target use staging. The seed, migrate, backup and restore
  scripts refuse the wrong database on purpose: never work around a guard.
- **Never open, print or commit `.env*`** (only `.env.example`, which holds placeholders). Secrets reach the
  containers through `docker-compose.yml`, never through an image.
- **Public-repo check on every diff, commit message and PR**: no personal data, real health data or
  screenshots of a real log (screenshots use demo data), and no internal hostnames, IP addresses or
  machine paths. CI's `secrets` job (gitleaks) scans every commit; `.gitleaks.toml` lists the reviewed
  false alarms.
- **Migrations only add.** A schema change is a new `drizzle/NNNN_name.sql` with the next number; an
  applied file is never edited or renamed. Remove something only a release after nothing reads it (expand,
  then contract): a rollback runs the previous version on the new schema.
- **Offline first.** Anything that logs a drink works with the server unreachable and syncs later, in order.
- **Version numbers are the only release names**: `vX.Y.Z` (SemVer; a feature bumps the middle number, a
  fix the last). Roadmap and idea numbers are planning IDs.
- Merging, tagging, deploying live and changing repository settings are the maintainer's calls.

## Where things are

- `src/app` pages and API routes · `src/components` UI · `src/lib` logic and its tests · `src/db` schema
- `drizzle/` SQL migrations, applied by `scripts/migrate.ts`
- `scripts/` `deploy.ps1`, `migrate.ts`, `seed-demo.ts`, `backup.ts`, `restore-check.ts`, `restore.ts`,
  `ci-status.ts`, `release-notes.sh`
- `.github/workflows/` CI (`check`, `secrets`, `audit` on every pull request) and Release (a tag publishes
  the GitHub Release from CHANGELOG.md)

## History

Versions 0.0–0.10 were built in a separate private repository. This public repository starts at v1.0
with one squashed commit, so none of that history (or anything personal in it) is here, and all work
since v1.0 happens here. The private repository is a frozen archive: nothing flows between the two, and
changes are never copied across.
