# Water Tracker

A small, self-hosted daily water tracker. Phone + desktop web app (installable from the browser),
Docker on your own machine, Postgres for data. Built one feature at a time as a learning project;
the process is documented in [CONTRIBUTING.md](CONTRIBUTING.md).

<p>
  <img src="docs/screenshots/today-light.png" width="240" alt="Today on a phone, light mode: 67 oz of a 100 oz floor, pace 22 oz behind, bottle picker and slider">
  <img src="docs/screenshots/today-dark.png" width="240" alt="Today on a phone, dark mode">
  <img src="docs/screenshots/coffee-dark.png" width="240" alt="Coffee-free streak and coffee calendar, dark mode">
</p>

What it does:

- **Log a drink in one tap.** Pick your bottle, slide ¼ / ½ / ¾ / Full, Log. Or type a one-off amount;
  recent amounts come back as chips.
- **Today against a daily floor** (100 oz by default), with **pace**: ahead or behind, next drink due, and a
  first-bottle checkpoint. Two pace modes: an even spread, or a curve learned from your own cleared days.
- **Bottle timing.** Each finished bottle shows how long it took and ounces per hour; an optional
  "Started bottle" tap times the first one of the day.
- **Coffee, target zero.** A coffee-free streak, a brew timer from pour to finished, flavours, and a
  coffee calendar.
- **History.** Streaks, 7 / 30 day and 13 week charts, a month calendar, week / month / quarter tables,
  first-drink-vs-floor and bottle-pace breakdowns.
- **Make it yours.** Bottles, daily floor, oz or mL, pace window, coffee flavours and a colour theme,
  saved on your server.
- **Display size.** Scale the whole app to 80, 90, 100, 110 or 125 %, per device (a phone and a desktop
  can differ). Buttons stay at least 44 px to the touch at every size, and pinch-to-zoom still works.
- **Installable and offline-first.** Add it to your home screen over HTTPS; it opens with no signal, and
  taps land locally and sync when the server is reachable.

<img src="docs/screenshots/desktop-light.png" width="720" alt="Desktop layout: sidebar navigation, today's total, bottle log, and today's drinks with durations">

Screenshots use generated demo data. Release notes: [CHANGELOG.md](CHANGELOG.md).

## Run it

Requirements: [Bun](https://bun.sh), Docker, a PostgreSQL you can reach.

```bash
git clone https://github.com/rrhinog/water-tracker.git
cd water-tracker
bun install
cp .env.example .env            # fill in the database URLs (see below)
```

### Databases

Live and staging each get their **own** database, so trying a branch on staging can never touch
real data. Create both (any Postgres login that may create tables works; a dedicated one is best):

```bash
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE water_tracker;"
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE water_tracker_staging;"
```

`.env` names each database twice, because the containers and your machine reach Postgres by
different names:

| Variable | Used by | Host part |
| --- | --- | --- |
| `LIVE_DATABASE_URL` | the `live` container | `postgres:5432` (container name) |
| `STAGING_DATABASE_URL` | the `staging` container | `postgres:5432` |
| `LIVE_DATABASE_URL_FROM_HOST` | `migrate.ts live`, deploy | `127.0.0.1:5432` |
| `STAGING_DATABASE_URL_FROM_HOST` | `migrate.ts staging`, `seed-demo.ts staging`, deploy | `127.0.0.1:5432` |
| `DATABASE_URL` | `bun run dev`, scripts run without a target | `127.0.0.1:5432`, point it at staging |

Create the tables. The schema is hand-written SQL in `drizzle/`; `scripts/migrate.ts` applies the
files it has not applied before, in order, and records each one in a `schema_migrations` table:

```bash
bun scripts/migrate.ts live       # prints "migrations: up to date" or each file it applied
bun scripts/migrate.ts staging
```

Already ran the files by hand before the runner existed? Record them without running them again:
`bun scripts/migrate.ts live --baseline`.

Fill staging with demo data (about 75 days of drinks and coffees, generated from a fixed seed). The
script refuses any database whose name does not end in `_staging` or `_demo`, and refuses one that
already has rows unless you pass `--reset`:

```bash
bun scripts/seed-demo.ts staging            # or --reset to replace what is there
```

Develop:

```bash
bun run dev      # http://localhost:3000
bun run test     # vitest
bun run lint
bun run build
```

Deploy with Docker (two containers from one image — `live` on :4210 and `staging` on :4211 — so a branch
can be tried on a phone before it reaches `main`):

```powershell
.\scripts\deploy.ps1 staging   # build + migrate staging's database + recreate + health check
.\scripts\deploy.ps1 live      # refuses unless you are on main
```

The deploy script migrates the target's own database before it replaces the container, and stops
(leaving the old container running) if a migration fails. It then waits for `/api/health`:

```bash
curl http://127.0.0.1:4210/api/health   # {"ok":true,"version":"1.6.0+abc1234","db":true}
```

It answers `503` with `"ok": false` when the database is unreachable. Errors thrown in the browser
are posted to `/api/client-errors` and show up as one `[client-error]` line each in
`docker logs water-tracker` (message, stack, path and browser only; at most 20 a minute).

`docker-compose.yml` binds to `127.0.0.1` only. To reach the app from a phone, add your LAN or
Tailscale address in a `docker-compose.override.yml` (gitignored):

```yaml
services:
  live:
    ports: ["127.0.0.1:4210:4210", "YOUR.ADDRESS:4210:4210"]
  staging:
    ports: ["127.0.0.1:4211:4211", "YOUR.ADDRESS:4211:4211"]
```

and set `PHONE_HOST=YOUR.ADDRESS` in `.env` so the deploy script prints the phone URL. Then open it in
Safari or Chrome and Add to Home Screen.

### HTTPS (installable app, opens offline)

Browsers only run the service worker that lets the app open with no signal on a secure origin. With
[Tailscale](https://tailscale.com) (HTTPS certificates enabled for your tailnet), serve both containers
privately on your tailnet:

```bash
tailscale serve --bg --https=8445 http://127.0.0.1:4210   # live
tailscale serve --bg --https=8446 http://127.0.0.1:4211   # staging
```

Set `TS_HTTPS_HOST=yourpc.your-tailnet.ts.net` in `.env` and the deploy script prints the HTTPS URL.
Add to Home Screen from that URL. A new origin starts with an empty local cache; your data is on
the server, so nothing is lost, but open the old app once first so anything it logged offline is sent.

## Make it yours

Everything personal lives in **Settings** (the gear on the main screen): your containers and their
sizes, the daily floor, oz or mL, the pace window and default pace mode. First run starts with the
author's defaults; change them once and every device follows. The "my history" pace curve is built
from your own cleared days once you have ten; a built-in curve stands in before that.

**Display** is the exception: the size is kept in the browser on each device, applies as soon as you
tap it, and is not part of Save. The default for a device that hasn't picked one is `DEFAULT_DISPLAY`
in `src/lib/display.ts`.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Drizzle + `pg` · vitest · Docker (standalone output).

## License

MIT — see [LICENSE](LICENSE).
