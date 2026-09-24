# Contributing

This is a small personal app published so others can read, copy, and adapt it. Issues and pull
requests are welcome; expect a slow, friendly response.

## The loop

Every change follows the same path, whether it's mine or yours:

1. Open an issue (or a short PR description) saying what you want and how you'll know it works.
2. Branch from `main`: `git checkout -b feat/<name>`.
3. Build it. Put real logic in `src/lib/` as pure functions with tests; keep components thin.
4. `bun run test && bun run lint && bun run build` must pass. CI runs the same checks, plus a typecheck,
   on every pull request.
5. Open a PR. Keep it to one feature. Say what you tested on a phone, because that's where it's used.
6. Releases (maintainer): add a `## [X.Y]` section to [CHANGELOG.md](CHANGELOG.md), then tag `main`
   (`git tag -a vX.Y -m "vX.Y — short title"`) and push the tag. The Release workflow publishes the
   GitHub Release from that section; it refuses a version the CHANGELOG doesn't describe.

## Ground rules

- **No data in the repo.** Entries live in Postgres. Never commit an export or `.env`. Demo data is
  generated in code (`src/lib/demo.ts`) and only ever written to a `*_staging` / `*_demo` database.
- **Schema changes** go in a new `drizzle/NNNN_*.sql` file (next number, plain SQL). `scripts/migrate.ts`
  applies it: `deploy.ps1` runs it against the target's database before the new container starts, and
  records the file name in `schema_migrations`. **Never edit or rename a file once it is applied**
  anywhere; a fix is a new file. Don't add `BEGIN`/`COMMIT`: the runner wraps each file in a transaction.
- **Keep migrations additive.** The old container is still serving while the migration runs, so a
  change must work with both the old and new code (add a column now, drop the old one in a later release).
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
