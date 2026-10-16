# Vices and the Pact

The spec for tracking vices (things to quit) next to water and coffee, and for a time-boxed **Pact**
that scores them together. The maintainer approved it before the build started; this copy in the repo
is the one that counts from now on. Personal values (which vices, which chips, the Pact's dates) are
Settings values on each install, never code.

## What it does

- **Vices.** A vice is anything you are quitting (for example alcohol). You log a **slip**: one tap,
  then what it was (a chip, such as "Beer"), at the time it happened. The metric is clean days, the
  days *without* a slip, like coffee's coffee-free streak.
- **The Pact.** A named challenge with a start date and a length (for example 100 days) covering some
  of your quits (any vices, and coffee). The headline is **one combined clean day**: a day with no slip
  for any covered quit, coffee included. It reads "clean X of Y days so far (of N)", with the current
  run beside it. Underneath, each quit's own hit-rate.
- **Floors.** The things to do *at least* every day, shown beside the Pact: the water floor (from the
  water log) and, optionally, steps from an outside source.

## Rules

- **A slip counts on the calendar day it happened**, at local midnight, the same boundary water and
  coffee use. A slip at 23:59 is that day; at 00:01 it is the next.
- **Today is pending** until it is over: it never counts as clean or missed in a hit-rate.
- **A quit's day is clean** when it has no slip (for coffee: no coffee that day).
- **A run** is the consecutive clean days ending yesterday. It never reaches back before the record
  starts: the vice's "clean since" date, or its first slip when that date is not set. For the Pact,
  the record starts on Day 1. **A slip today ends the run at once**: the vice's run (on Today and in
  History) reads 0 as soon as it has a slip today, and the Pact's run reads 0 as soon as any covered
  quit has one (a coffee counts). The best run and every hit-rate are unchanged by it.
- **Hit-rate** is clean days out of completed days in a window: "clean 31 of 33 days".

## What gets built (one release, four lanes)

### A: slips data
- Migration `0005_slips.sql`, additive only: a new table `slips` with `id` text primary key, `vice`
  text (a Settings id such as `alcohol`), `at` timestamptz, `kind` text (the chip, copied at log time
  like coffee's `flavour`), `from_notes` boolean, `created_at`.
- API `/api/slips` and `/api/slips/[id]`, the same shape as `/api/coffee`.
- The same offline-first path coffee uses: the sync queue, merge, pending and undo (`src/lib/sync.ts`,
  `merge.ts`, `pending.ts`, `undo.ts`).
- Pure logic in `src/lib/vices.ts`: clean days, current run, hit-rate over a window, the Pact's
  combined day. Tests first.
- **Coffee is untouched.** Coffee *days* feed the Pact through the same pure functions, read from
  `coffee_entries` as they are now.

### B: Settings and Today
- Settings gets a **Vices** card: add, rename or remove a vice, its chips, and its "clean since" date.
  Stored in the settings JSON row and validated like `flavours` in `src/lib/settings.ts`.
  **Off by default**: a fresh install has no vices and no Pact.
- Today: **one card per vice**, like the coffee card ("clean 31 of 33 days · run 12 days") with a
  **Slip** button → chips → logged now. The undo bar, edit-a-time and log-for-yesterday work as they do
  for drinks.

### C: the Pact and Floors
- A **Pact** card, set up in Settings: a name, start date, length, and which quits it covers.
  Headline: the combined clean day; underneath, the per-quit hit-rates.
- A **Floors** card: the water floor's hit-rate from existing entries, and steps.
- **Steps** come from an optional, read-only Postgres connection, `STEPS_DATABASE_URL`, to a view
  named `daily_steps` with columns `day` (date), `steps` (integer) and `synced_at` (timestamptz). If
  the variable is unset, the steps line hides, so the public app needs no steps source. Steps are
  shown "as of" their last sync ("8,412 steps · as of 12:00"), never as live. A day in the window with
  no steps row is **no data**: it is left out of the steps hit-rate (neither clean nor missed), and the
  card says "no data for N days". The water floor is unchanged: a day with no drinks is a miss.

### D: History, demo data, import
- History: a section per vice, reusing coffee's layout: run now and best, a calendar of slip days, a
  log with remove, by-month counts, and by kind.
- Demo seed (`scripts/seed-demo.ts`, staging and demo databases only): fake vices, slips, a Pact and
  fake steps, so staging and screenshots never show a real log.
- Import: a one-time script for a private markdown file of slips (`scripts/import-slips.ts`). The file
  is passed by path when it runs and never enters the repo.

## Later, not in this release
- Money saved: an estimate from clean days, and actual spend, each labelled.
- Amount and where it came from on a slip, as optional fields.
- Moving coffee into the slips table.

## Done when
- Tap Slip on a vice card, pick a chip, and it is logged with the time; Undo works for 6 seconds.
- The card shows clean X of Y days and the current run, and they match History.
- The Pact card shows each quit's hit-rate from Day 1, imported slips included.
- The Floors card shows today's water and steps "as of" the last sync; with no steps source, steps hide.
- Settings can add a vice, edit its chips and its clean-since date; a fresh install shows no vices.
- Offline: a slip logged with the server unreachable syncs later, in order.
- Staging shows only demo slips and demo steps.
