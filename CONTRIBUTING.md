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
6. Releases (maintainer): add the change to [CHANGELOG.md](CHANGELOG.md), tag `vX.Y` on `main`, and
   publish a GitHub Release with the same notes.

## Ground rules

- **No data in the repo.** Entries live in Postgres. Never commit a seed, export, or `.env`.
- **Additive schema changes** go in a new `drizzle/NNNN_*.sql` file; never edit an applied one.
- **Offline first.** Anything that logs a drink must work with the server unreachable and sync later.
- Everyday choices (bottles, daily floor, units, pace window, flavours, colour) live in the app's Settings.
  The defaults a fresh install starts with are `DEFAULT_SETTINGS` in `src/lib/settings.ts`.
- **Screenshots use demo data only**, never a real person's log.

## Style

TypeScript and the Ink Kit stylesheet (`src/styles/ink.css`, one accent, 2px ink borders), with Tailwind for
layout. No component library. Prefer a plain HTML element over a dependency. New colours must pass
WCAG contrast in their role; `src/lib/color.ts` has the checker.
