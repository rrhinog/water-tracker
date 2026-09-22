# Contributing

This is a small personal app published so others can read, copy, and adapt it. Issues and pull
requests are welcome; expect a slow, friendly response.

## The loop

Every change follows the same path, whether it's mine or yours:

1. Open an issue (or a short PR description) saying what you want and how you'll know it works.
2. Branch from `main`: `git checkout -b feat/<name>`.
3. Build it. Put real logic in `src/lib/` as pure functions with tests; keep components thin.
4. `bun run test && bun run lint && bun run build` must pass.
5. Open a PR. Keep it to one feature. Say what you tested on a phone, because that's where it's used.

## Ground rules

- **No data in the repo.** Entries live in Postgres. Never commit a seed, export, or `.env`.
- **Additive schema changes** go in a new `drizzle/NNNN_*.sql` file; never edit an applied one.
- **Offline first.** Anything that logs a drink must work with the server unreachable and sync later.
- Personal defaults (bottles, the daily floor, the pace curve) are in `src/lib/bottles.ts`, `src/lib/log.ts`,
  and `src/lib/pace.ts`. Make them yours in a fork; PRs that make them configurable are welcome.

## Style

TypeScript, Tailwind, no component library. Prefer a plain HTML element over a dependency.
