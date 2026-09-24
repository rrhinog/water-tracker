# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/): a new feature bumps the middle number,
a fix to existing behaviour bumps the last.

## [1.8] — YYYY-MM-DD

Log faster: fewer taps for the usual cases, and a way back from the wrong one.

### Added
- **Undo.** After logging a drink or a coffee, a bar shows "Logged 36 oz · Undo" (or "Logged a coffee ·
  Undo") for 6 seconds, next to the button you tapped. Undo removes it through the normal delete, so it
  works offline too. The bar floats beside the button (below it, or above when below would reach the tab
  bar), so nothing on the page moves and it never sits on the Log button, the tab bar or the STAGING bar.
- **Refill.** The latest drink in "Logged today" has a Refill button: the same bottle and amount again,
  finished now. Works for a one-off Other amount too.
- **Edit a time.** Tap a logged drink's time and pick the real one. Same entry, new time, sent as an
  update; no future times, and it stays on its own day. Bottle durations follow the new time.
- **Log for yesterday.** A Today / Yesterday switch under the Log button; Yesterday asks for a time
  (9:00 PM to start with), the drink lands on yesterday in History, and the switch goes back to Today.
- **Offline banner.** "2 drinks waiting to sync" (or "1 drink and 1 coffee…") while the server can't be
  reached, "Can't reach the server" when nothing is waiting; it goes when everything has been sent. It
  replaces the old "not synced" tag and shows on every page.
- **Update banner.** "New version — tap to reload" when the server is running a different release than
  the page was loaded from (the page's version against `/api/health`, checked on opening, on return to
  the app and every 5 minutes). It reloads only when tapped.

### Changed
- Changes are always sent in the order they were made: a new change waits behind anything still queued,
  and the queue is retried every 15 seconds while offline, when the network comes back and when the app
  returns to the foreground (it used to retry only on the next launch). A send that hangs gives up
  after 10 seconds.
- A change still waiting to be sent (an edited time, a finished coffee) is no longer replaced by the
  server's older copy when the app refreshes; a Settings save that failed offline is sent again before
  the next refresh instead of being overwritten.
- Banners appear and disappear only when no finger is on the screen, so the page never jumps under a tap.
- At large display sizes the "Started bottle" button, the rows in "Logged today" and the coffee streak
  line wrap instead of making the page scroll sideways (seen at 125 % on a 375 px phone).
- `package.json` carries the app version 1.8.0.

## [1.7.1] — 2026-09-24

### Changed
- The display size starts at **90 %** on a device that hasn't picked one (was 100 %). The app's fixed sizes
  read large on a phone at 100 %. A size already chosen on a device is kept; 100 % is one tap away in
  Settings → Display.

## [1.7] — 2026-09-24

Display size: the app can be made smaller or larger on each device.

### Added
- Settings → **Display**: five sizes, 80 · 90 · 100 · 110 · 125 %, that scale the whole app. The size
  applies as you tap, is kept on this device only (not synced, not part of Save), and is applied
  before the first paint, so a reload never flashes at 100 %. The default stays 100 %.
- Staging can't be mistaken for live: a **STAGING · demo data, not your log** bar across the top of
  every page, and the installed app is named "Water · Staging" (manifest, iPhone home-screen title
  and tab title). Decided at request time from `APP_ENV=staging` on the staging container only, so the
  same image never shows it on live; anything other than exactly `staging` is live.

### Changed
- Touch targets are sized so they stay at least 44 px on screen at every display size.
- At large sizes on a phone, crowded rows wrap instead of pushing the page sideways: the Today and
  History headers, card headers, the Settings save bar and the pace line; table gutters narrow to the
  normal column gap. Nothing moves at 100 %.
- The small flavour chips on an open coffee meet the 44 px touch target on phones (they were 32 px).
- Pages and the web manifest are rendered per request (they were prerendered) so the staging mark
  comes from the running container, not the build.
- `package.json` carries the app version 1.7.0.

## [1.6] — 2026-09-24

Safe to change: nothing on screen changes; building and trying new features no longer puts real data at risk.

### Added
- Staging has its own database with generated demo data (about 75 days of drinks and coffees, from a
  fixed seed). `scripts/seed-demo.ts` refuses any database whose name does not end in `_staging` or `_demo`.
- Migration runner: `scripts/migrate.ts` applies the `drizzle/*.sql` files a database has not applied
  yet, each in a transaction, and records them in `schema_migrations`. `--baseline` records existing
  files without running them.
- `GET /api/health` answers `{ ok, version, db }` after a database round-trip, or `503` when the
  database is unreachable. The version includes the deployed commit.
- Browser errors are reported to the server log (`[client-error]` lines), rate-limited, with no
  personal data beyond the message, stack, path and browser.

### Changed
- Live and staging read their database URLs from `.env` (`LIVE_DATABASE_URL`, `STAGING_DATABASE_URL`,
  plus `…_FROM_HOST` variants for scripts on the host); the containers no longer receive the rest of `.env`.
- `deploy.ps1` migrates the target's database before recreating the container, stops if that fails,
  and probes `/api/health` instead of `/`, printing the version.
- Setup in the README uses the migration runner instead of a `psql` loop.
- `package.json` carries the app version (1.6.0).

## [1.5] — 2026-09-23

### Added
- Installable over HTTPS, opens with no signal. A service worker keeps the app's pages and code for
  offline launch; your data is never cached by it (logging offline still uses the app's own queue).
  Pages are network-first, so an online launch always gets the latest version.
- PNG app icons (192, 512, maskable, and the 180 px iPhone icon); iOS ignores SVG home-screen icons.
- **Squirtle** colour theme in Settings → Colour: blue for water, shell tan / mocha for coffee, with
  separate light and dark shades, each contrast-checked in its role.
- Coffee has its own colour slot (buttons and the coffee calendar); it stays ink under the other accents.
- Security headers, and `sw.js` is always served uncached.
- CI: lint, typecheck, tests and build on every pull request.
- README section on HTTPS with Tailscale Serve; `TS_HTTPS_HOST` makes the deploy script print the URL.

### Changed
- New icon: navy tile with a half-full drop.
- README now applies every migration in `drizzle/`, not only the first.

## [1.4.1] — 2026-09-23

### Fixed
- Sync no longer re-uploads rows that were deleted on another device. On load, a row that only this
  device has survives only while it is still waiting in the offline queue.
- Phone layout: amounts no longer wrap mid-value, time lines break between parts, tables fit a 375 px
  screen, and text inputs and colour swatches meet the 44 px touch target.

### Changed
- Coffee rows show their time on the second line, like water rows; the button reads "+ Coffee".

## [1.4] — 2026-09-23

### Added
- Bottle drinking duration. Each finished bottle shows how long it took and ounces per hour, measured
  from the previous finish. An optional **Started bottle** tap times the day's first bottle.
- History: "Bottle pace" card with the median full-bottle time and ounces per hour by hour of day.

### Fixed
- Database migration `0004` allows bottle-start markers and bottles added in Settings (the original
  table only accepted the three default bottle ids).

## [1.3.1] — 2026-09-23

### Fixed
- Imported coffees carry their real time and, when known, a real sip window, instead of one noon
  placeholder per day.

## [1.3] — 2026-09-23

### Added
- Coffee flavours: pick the pod when logging, manage the list in Settings, see counts by flavour in History.

## [1.2] — 2026-09-23

### Added
- Brew timer: a coffee stays open from pour to **Finished**, with live elapsed time; the sip window is
  kept in History.

## [1.1] — 2026-09-22

### Added
- Coffee history: current and best coffee-free streak, a coffee calendar, a by-month table, and the full
  log with remove.

## [1.0] — 2026-09-22

First public release.

- Log a bottle in one tap (pick a bottle, slide ¼ / ½ / ¾ / Full) or type a one-off amount.
- Today against a daily floor, with pace: ahead or behind, next drink due, first-bottle checkpoint.
- Coffee log with a coffee-free streak.
- History: streaks, 7 / 30 day and 13 week charts, month calendar, week / month / quarter tables.
- Settings: your own bottles, floor, units, pace window and accent colour, saved on the server.
- Offline-first sync with Postgres; Docker live and staging containers.

Versions 0.0–0.10 were built privately before the public release and are summarised above.

[1.7.1]: https://github.com/rrhinog/water-tracker/releases/tag/v1.7.1
[1.7]: https://github.com/rrhinog/water-tracker/releases/tag/v1.7
[1.6]: https://github.com/rrhinog/water-tracker/releases/tag/v1.6
[1.5]: https://github.com/rrhinog/water-tracker/releases/tag/v1.5
[1.4.1]: https://github.com/rrhinog/water-tracker/releases/tag/v1.4.1
[1.4]: https://github.com/rrhinog/water-tracker/releases/tag/v1.4
[1.3.1]: https://github.com/rrhinog/water-tracker/releases/tag/v1.3.1
[1.3]: https://github.com/rrhinog/water-tracker/releases/tag/v1.3
[1.2]: https://github.com/rrhinog/water-tracker/releases/tag/v1.2
[1.1]: https://github.com/rrhinog/water-tracker/releases/tag/v1.1
[1.0]: https://github.com/rrhinog/water-tracker/releases/tag/v1.0
