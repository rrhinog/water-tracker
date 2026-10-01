# Runbook

The exact commands for running the app: checking it, deploying, rolling back, restoring data and the
monthly upkeep. Commands are PowerShell 7, run from the repository (the main checkout or any worktree).
The release checklist is [RELEASING.md](RELEASING.md).

## Where things are

|  | Live | Staging |
| --- | --- | --- |
| Address on this machine | http://127.0.0.1:4210 | http://127.0.0.1:4211 |
| Container | `water-tracker` | `water-tracker-staging` |
| Database | `water_tracker` | `water_tracker_staging` (demo data only) |

- **Images**: `docker images water-tracker`. Each release is kept as `water-tracker:vX.Y.Z` (the newest 5),
  each staging build of a branch as `water-tracker:sha-<commit>` (the newest 5). `water-tracker:live` and
  `water-tracker:staging` name whichever one is running.
- **Backups**: in `BACKUP_DIR` (set in `.env`), one per live deploy: `water_tracker_pre_<version>_<date>.dump`
  and a `.json` beside it with every table's row count at that moment.
- **Settings for these scripts** (`.env`, see `.env.example`): `BACKUP_DIR`, and `PG_CONTAINER` if Postgres runs
  in Docker. Live deploys also need the GitHub CLI (`gh`), signed in.

## Is it up?

    curl http://127.0.0.1:4210/api/health      # {"ok":true,"version":"1.9.0+abc1234","db":true}
    docker logs --tail 50 water-tracker        # errors from phones show as [client-error] lines

`/api/health` answers `503` with `"ok": false` when the database is unreachable.

## Deploy

    .\scripts\deploy.ps1 live v1.9.0 -DryRun   # checks everything, changes nothing
    .\scripts\deploy.ps1 live v1.9.0

Live takes a release tag on `main` whose CI passed. The image is built from that commit (or the kept one
is reused), the database is backed up, migrations run, the container is swapped, and `/api/health` plus
Today, History and Settings must answer from the new version. Any failure before the swap leaves the old
container running. Staging takes any branch, tag or commit: `.\scripts\deploy.ps1 staging feat/x`.

## Roll back (first resort: seconds, nothing lost)

When a release misbehaves, run the earlier release again:

    .\scripts\deploy.ps1 live v1.8             # the "To go back" line every deploy prints

The kept image starts in about 10 seconds, without a rebuild (an image older than the newest 5 is rebuilt
from its tag in about 30). Its migrations are already applied and newer ones only added things, so the old
code runs on today's database, and everything logged since stays. Then fix forward on a branch and
release `v1.9.1`.

Rehearsed on staging (2026-10-01): a tag, a branch, back to the tag in 9 s, an older release (v1.7.1),
and back; all 22 browser checks passed after the rollback.

## Restore a backup (last resort: the data itself is wrong)

Use this when data is damaged or lost (a bad migration, a bug that deleted rows), not for a bad release.
A restore brings back the database as it was at the backup, so **anything logged after it is lost**.

1. Pick the backup from just before the problem: `water_tracker_pre_<version>_<date>.dump` in `BACKUP_DIR`.
2. Optional and harmless: prove it restores, in a throwaway container.

       bun scripts/restore-check.ts <file.dump>

3. Stop the app, so nothing writes during the restore (phones keep logging offline and send it later):

       docker stop water-tracker

4. Restore. It refuses unless the dump is of this same database; it first backs up the current state
   (`water_tracker_pre_restore_<date>.dump`, so this step can be undone), then replaces everything in one
   transaction and compares every table's rows with the backup's record.

       bun scripts/restore.ts live <file.dump> --yes-replace-water_tracker

5. Start the release you want. Deploying migrates the restored database up to that version first.

       .\scripts\deploy.ps1 live <version>

6. Open the app on each phone, so anything it logged while the app was down is sent.

Rehearsed on staging (2026-10-01): a drink was deleted, the app stopped, the backup restored in 1 second
with every table matching, the app redeployed, and the drink was back.

## Monthly upkeep

- **Dependencies**: Dependabot opens update pull requests once a month. Take each through staging like any
  change and release the result as a patch. A security fix can't wait for the month: `audit` fails the
  next pull request until it's updated.
- **Prove a restore**: `bun scripts/restore-check.ts <newest .dump in BACKUP_DIR>` must say PASS.
- **Tidy up**: `git worktree list` and `git branch --merged main` for finished worktrees and branches to
  delete; backups you no longer need in `BACKUP_DIR`. Keep the database server's own regular backups as
  well; the per-deploy ones only cover deploys.
