# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/): a new feature bumps the middle number,
a fix to existing behaviour bumps the last.

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

[1.5]: https://github.com/rrhinog/water-tracker/releases/tag/v1.5
[1.4.1]: https://github.com/rrhinog/water-tracker/releases/tag/v1.4.1
[1.4]: https://github.com/rrhinog/water-tracker/releases/tag/v1.4
[1.3.1]: https://github.com/rrhinog/water-tracker/releases/tag/v1.3.1
[1.3]: https://github.com/rrhinog/water-tracker/releases/tag/v1.3
[1.2]: https://github.com/rrhinog/water-tracker/releases/tag/v1.2
[1.1]: https://github.com/rrhinog/water-tracker/releases/tag/v1.1
[1.0]: https://github.com/rrhinog/water-tracker/releases/tag/v1.0
