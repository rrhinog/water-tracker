# Security

## Reporting a vulnerability

Please don't open a public issue. Report it privately on GitHub: **Security → Report a vulnerability** on
this repository. This is a one-person project, so expect a reply within a week, and a fix in the next
release.

## Supported versions

Only the latest release gets fixes. To update, deploy the newest tag ([RELEASING.md](RELEASING.md)).

## Before you host it: what the app does and doesn't protect

- **There is no login.** Anyone who can reach the app can read and change its data. Keep it private: the
  containers listen on `127.0.0.1` only, and phones reach them over your own network or a private one such
  as Tailscale (README). **Never expose it to the internet** (no port forwarding, no public tunnel) unless
  you put real authentication in front of it.
- Your data stays in your own Postgres and on your own devices: each browser keeps a copy of the log in
  its storage so the app works offline (the service worker caches only pages and code). Nothing is sent
  anywhere else.
- Secrets live in `.env`, which git ignores. They reach the containers through `docker-compose.yml` and
  never go into an image: deploys build from the git commit, and `.dockerignore` excludes `.env*`. Up to
  v1.8, an image built from a folder holding `.env` did contain it (`/app/.env`). If you pushed such an
  image to a registry, change your database password.
- Give the app its own Postgres login that owns only its database, not a superuser.
- `/api/health` tells only the version and whether the database answers. Errors from browsers are logged
  with their message, stack, page and browser, and nothing else.
- Every pull request is scanned for secrets (gitleaks, over the whole history) and for dependencies with
  known high or critical vulnerabilities (bun audit). Dependabot proposes updates monthly.
