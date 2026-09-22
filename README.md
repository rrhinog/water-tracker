# Water Tracker

A small, self-hosted daily water tracker. Phone + desktop web app (installable from the browser),
Docker on your own machine, Postgres for data. Built one feature at a time as a learning project;
the process is documented in [CONTRIBUTING.md](CONTRIBUTING.md).

What it does:

- Log a bottle in one tap: pick your bottle, slide ¼ / ½ / ¾ / Full, Log. Or type a one-off amount.
- Today's total against a daily floor (100 oz by default), with **pace**: on track / behind, next drink
  due, and a first-bottle-by-10 AM checkpoint. Two pace modes: an even spread, or a curve from your own
  cleared days.
- Coffee log with a coffee-free streak (the target is zero).
- History: streaks, last 7 / 30 days / 13 weeks, month calendar, breakdown by week / month / quarter.
- Offline-first: taps land locally and sync when the server is reachable.

## Run it

Requirements: [Bun](https://bun.sh), Docker, a PostgreSQL you can reach.

```bash
git clone https://github.com/rrhinog/water-tracker.git
cd water-tracker
bun install
cp .env.example .env            # fill in POSTGRES_PASSWORD and DATABASE_URL
```

Create the database and tables (the schema is hand-written SQL, applied once):

```bash
psql "$DATABASE_URL_WITHOUT_DB" -c "CREATE DATABASE water_tracker;"
psql "$DATABASE_URL" -f drizzle/0000_init.sql
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
.\scripts\deploy.ps1 staging   # build + recreate + probe
.\scripts\deploy.ps1 live      # refuses unless you are on main
```

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

## Make it yours

Everything personal lives in **Settings** (the gear on the main screen): your containers and their
sizes, the daily floor, oz or mL, the pace window and default pace mode. First run starts with the
author's defaults; change them once and every device follows. The "my history" pace curve is built
from your own cleared days once you have ten; a built-in curve stands in before that.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Drizzle + `pg` · vitest · Docker (standalone output).

## License

MIT — see [LICENSE](LICENSE).
