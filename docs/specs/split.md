# Water and steps only (2.0)

The spec for version 2.0.0: the app becomes a water and steps tracker. This file says what goes, what
stays for now, and in what order the rest is removed.

## What 2.0 removes

- **Coffee** on every screen: the coffee card, coffee lists, the desktop sidebar coffee block, the
  coffee-free streak and History's coffee section.
- **Vices**: the vice cards, the Slip button and History per vice.
- **The Pact card**, and Settings' Flavours, Vices and Pact cards.
- **Code and files**: the coffee and vice logic, `scripts/import-slips.ts`, `docs/specs/vices.md` and the
  screenshot `docs/screenshots/coffee-dark.png`.
- Demo data for staging is water and steps only.

## What stays until a later release, and why

"Expand, then contract" means a change is made in two steps: first add the new way and keep the old one
working, and only later remove the old one. 2.0 stops showing and stops reading the removed features;
it does not delete their plumbing.

- **The offline queue.** A phone that logged something under 1.9.x may still hold changes it has not sent.
  The queue still sends the older kinds of change, and these routes still accept reads and writes, so
  those changes land: `/api/coffee`, `/api/coffee/[id]`, `/api/slips`, `/api/slips/[id]`. They write to
  the tables `coffee_entries` and `slips`, which stay as they are.
- **Rollback safety.** The settings fields `flavours`, `vices` and `pact` stay in the stored settings row.
  Saving Settings in 2.0 carries them through unchanged, so rolling back to 1.9.1 still shows them.
- **No new migration.** Nothing is dropped from the database in 2.0.

## The order

1. **2.0** stops showing and stops reading. Routes, queue kinds, tables and settings fields stay.
2. **A later minor release** removes the routes, the old queue kinds and the old settings fields. Before
   it clears `pact` from the settings row, it must store the Floors count-from date explicitly (2.0 works
   it out from the Pact's start date until Settings is first saved), or the Floors window would move.
3. **Dropping the tables** comes after that, as a separate step, with a kept backup taken first.

## Floors window

The Floors card stays: how often the water floor was met and, when a steps source is set up, steps too.
It used to count from the Pact's first day. Now Settings has an optional **Floors count from** date.

- With a date, Floors count from that date to yesterday.
- Without one, they cover the last 30 days.
- On upgrade, an install that had a Pact gets the Pact's start date as the starting value, so the
  numbers shown do not move. The first Settings save stores it.
- The Steps floor field moves from the Pact card into a new Floors card in Settings, beside the date.

Floors and steps logic lives in `src/lib/floors.ts`.

## Upgrade notes

- Export coffee and slips first if you want a copy. Nothing reads them in 2.0, but a backup is cheap:

  ```bash
  pg_dump -h 127.0.0.1 -U <your_user> --table=coffee_entries --table=slips <your_database> > coffee-and-slips.sql
  ```

- Deploy as usual. There is no migration to apply.
- To roll back, deploy the 1.9.1 image; the data it needs is still there.
