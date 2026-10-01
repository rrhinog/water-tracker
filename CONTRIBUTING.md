# Contributing

This is a small personal app published so others can read, copy, and adapt it. Issues and pull
requests are welcome; expect a slow, friendly response.

## The loop

Every change follows the same path, whether it's mine or yours. The full checklist, with commands, is
[RELEASING.md](RELEASING.md).

1. Open an issue with the **Feature** or **Bug** form: what you want, and how we'll know it works ("Done
   when…"). A small fix can skip this and say it in the pull request.
2. Branch from `main`, in its own worktree: `feat/<name>` or `fix/<name>`.
3. Build it. Put real logic in `src/lib/` as pure functions with tests; keep components thin. Commit
   messages follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`).
4. `bun run test && bun run lint && bun run build` must pass. CI runs them on every pull request, plus a
   typecheck, a secrets scan over every commit and a dependency audit.
5. Open a PR; its template's Definition of Done is the checklist. Keep it to one feature. Say what you
   tested on a phone, because that's where it's used.
6. Releases (maintainer): versions are `vX.Y.Z` ([SemVer](https://semver.org)). A `## [X.Y.Z]` section in
   [CHANGELOG.md](CHANGELOG.md), a tag on `main`, then a deploy; the Release workflow publishes the GitHub
   Release from that section and refuses a version the CHANGELOG doesn't describe.

Security problems: privately, as [SECURITY.md](SECURITY.md) says, not as an issue.

## Ground rules

- **No data in the repo.** Entries live in Postgres. Never commit an export or `.env`. Demo data is
  generated in code (`src/lib/demo.ts`) and only ever written to a `*_staging` / `*_demo` database.
- **Schema changes** go in a new `drizzle/NNNN_*.sql` file (next number, plain SQL). `scripts/migrate.ts`
  applies it: `deploy.ps1` runs it against the target's database before the new container starts, and
  records the file name in `schema_migrations`. **Never edit or rename a file once it is applied**
  anywhere; a fix is a new file. Don't add `BEGIN`/`COMMIT`: the runner wraps each file in a transaction.
- **Keep migrations additive.** The old container is still serving while the migration runs, and a
  rollback runs the previous release on the new schema, so a change must work with both the old and new
  code (add a column now, drop the old one in a later release).
- **Staging never uses live's database.** Try a branch on staging against demo data; `bun run dev` should
  point at staging too.
- **Offline first.** Anything that logs a drink must work with the server unreachable and sync later.
- Everyday choices (bottles, daily floor, units, pace window, flavours, colour) live in the app's Settings.
  The defaults a fresh install starts with are `DEFAULT_SETTINGS` in `src/lib/settings.ts`.
- **Screenshots use demo data only**, never a real person's log.

## Style

TypeScript and the Ink Kit stylesheet (`src/styles/ink.css`, one accent, 2px ink borders), with Tailwind for
layout. No component library. Prefer a plain HTML element over a dependency. New colours must pass
WCAG contrast in their role; `src/lib/color.ts` has the checker.
