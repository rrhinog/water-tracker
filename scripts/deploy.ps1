# Deploy one version of the app to the live or staging container, or roll back to an earlier one.
#
#   .\scripts\deploy.ps1 staging              # this checkout's last commit (e.g. a feature branch)
#   .\scripts\deploy.ps1 staging feat/x       # any branch, tag or commit (or sha-<commit>), without checking it out
#   .\scripts\deploy.ps1 live v1.9.0          # a release tag on main
#   .\scripts\deploy.ps1 live v1.8            # roll back: the kept v1.8 image starts again, no rebuild
#   .\scripts\deploy.ps1 live v1.9.0 -DryRun  # check everything and say what would happen; change nothing
#   .\scripts\deploy.ps1 staging -Backup      # staging, backing up its database first as live always does
#
# Steps: image -> back up the database (live) -> migrate the TARGET's database -> point the container
# at the image -> probe /api/health. The backup (scripts/backup.ts, into BACKUP_DIR) is the last resort
# if a rollback isn't enough; scripts/restore-check.ts proves a backup restores.
#
# The image is built from the commit (git archive), never from the working folder, so uncommitted
# edits and local files such as .env can't reach it. It is named water-tracker:<tag> (or
# water-tracker:sha-<commit> for an untagged staging build) and kept: the newest 5 of each kind stay,
# so a rollback reuses one in seconds. Migrations only add (CONTRIBUTING.md), so an older version
# still runs on a newer database.
#
# Exits non-zero on any failure. A failed build or migration stops before the container changes.
# Works from the main checkout or any git worktree of it; this machine's .env and
# docker-compose.override.yml are read from the main checkout.

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("live", "staging")]
    [string]$Target,
    [string]$Ref,
    [switch]$DryRun,
    [switch]$Backup
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $PSScriptRoot
Set-Location $here

$keep = 5
$port = if ($Target -eq "live") { 4210 } else { 4211 }
$container = if ($Target -eq "live") { "water-tracker" } else { "water-tracker-staging" }
$versionTag = '^v\d+\.\d+(\.\d+)?$'
$tmp = $null
$code = 0

function Fail([string]$message) { throw $message }

function Get-ImageLabel([string]$imageRef, [string]$name) {
    $value = docker image inspect $imageRef --format "{{index .Config.Labels `"$name`"}}" 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return "$value".Trim()
}

# Keep the newest $keep tags of one kind (v* or sha-*); never the image a container is using.
function Remove-OldImages([string]$pattern) {
    $inUse = @(docker ps -a --format "{{.Image}}" | ForEach-Object { docker image inspect $_ --format "{{.Id}}" 2>$null })
    $tags = @(docker images water-tracker --format "{{.Tag}}" | Where-Object { $_ -match $pattern })
    $byAge = $tags | Sort-Object { docker image inspect "water-tracker:$_" --format "{{.Created}}" } -Descending
    foreach ($t in @($byAge | Select-Object -Skip $keep)) {
        $id = docker image inspect "water-tracker:$t" --format "{{.Id}}"
        if ($inUse -contains $id) { continue }
        docker rmi "water-tracker:$t" | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-Host "    removed old image water-tracker:$t" }
    }
}

try {
    # This machine's settings live in the main checkout, shared by every worktree.
    $machine = Split-Path -Parent (git rev-parse --path-format=absolute --git-common-dir).Trim()
    $envFile = Join-Path $machine ".env"
    if (-not (Test-Path $envFile)) { Fail "No .env in $machine (copy .env.example and fill it in)" }
    $compose = @("--env-file", $envFile, "-f", (Join-Path $here "docker-compose.yml"))
    $override = Join-Path $machine "docker-compose.override.yml"
    if (Test-Path $override) { $compose += @("-f", $override) }

    # --- Which commit ---
    if ($Target -eq "live") {
        if ($Ref -notmatch $versionTag) { Fail "Live takes a release tag, e.g. .\scripts\deploy.ps1 live v1.9.0 (tag main first). Got '$Ref'." }
        git fetch --quiet origin main --tags
        if ($LASTEXITCODE -ne 0) { Fail "git fetch failed; can't check that $Ref is on main" }
        if (-not (git tag -l $Ref)) { Fail "There is no tag $Ref" }
    }
    if (-not $Ref) {
        $Ref = "HEAD"
        if (git status --porcelain --untracked-files=no) { Write-Warning "Uncommitted changes in $here are NOT deployed, only its last commit." }
    }
    if ($Ref -match '^sha-([0-9a-f]{7,40})$') { $Ref = $Matches[1] }   # an image name, as the summary prints it
    $full = git rev-parse --verify --quiet "$Ref^{commit}"
    if (-not $full) { Fail "Unknown branch, tag or commit '$Ref'" }
    $full = "$full".Trim()
    $sha = (git rev-parse --short $full).Trim()
    if ($Target -eq "live") {
        git merge-base --is-ancestor $full origin/main
        if ($LASTEXITCODE -ne 0) { Fail "$Ref ($sha) is not on main. Live only runs released commits." }
    }
    $tag = @(git tag --points-at $full | Where-Object { $_ -match $versionTag }) | Select-Object -First 1
    $label = if ($Target -eq "live") { $Ref } elseif ($tag) { $tag } else { "sha-$sha" }
    $image = "water-tracker:$label"

    # What is running now, so the summary can name the way back.
    $was = $null
    $running = docker inspect $container --format "{{.Image}}" 2>$null
    if ($LASTEXITCODE -eq 0) { $was = Get-ImageLabel $running "org.opencontainers.image.version" }
    $wasText = if ($was) { $was } else { "an unversioned image (built before versioned deploys)" }

    $backUp = $Target -eq "live" -or $Backup
    if ($backUp -and -not $env:BACKUP_DIR -and -not (Select-String -Path $envFile -Pattern '^BACKUP_DIR=\S' -Quiet)) {
        Fail "Set BACKUP_DIR in .env first (see .env.example): a $Target deploy backs up the database before it changes it."
    }

    $reuse = (Get-ImageLabel $image "org.opencontainers.image.revision") -eq $full
    Write-Host "==> $Target : $Ref ($sha) as $image. Running now: $wasText"
    if ($DryRun) {
        Write-Host "    Dry run. Would $(if ($reuse) { 'reuse the kept image' } else { 'build the image from the commit' }),$(if ($backUp) { ' back up and' }) migrate the $Target database, recreate $container and probe /api/health."
        exit 0
    }

    # --- Image: reuse the kept one, or build it from the commit ---
    $tmp = Join-Path ([IO.Path]::GetTempPath()) "water-tracker-$sha-$PID"
    New-Item -ItemType Directory -Force $tmp | Out-Null
    git archive --format=tar -o "$tmp.tar" $full
    if ($LASTEXITCODE -ne 0) { Fail "git archive failed" }
    tar -xf "$tmp.tar" -C $tmp
    if ($LASTEXITCODE -ne 0) { Fail "Unpacking the commit failed" }

    if ($reuse) {
        Write-Host "==> Reusing $image (built $(docker image inspect $image --format '{{.Created}}'))"
    } else {
        Write-Host "==> Building $image from the commit"
        docker build -t $image --build-arg "GIT_SHA=$sha" `
            --label "org.opencontainers.image.revision=$full" `
            --label "org.opencontainers.image.version=$label" $tmp
        if ($LASTEXITCODE -ne 0) { Fail "Build failed; $Target was NOT changed" }
    }

    # --- Database: back it up, then apply that version's migrations (an older version applies none) ---
    if ($backUp) {
        Write-Host "==> Backing up the $Target database"
        bun --env-file="$envFile" scripts/backup.ts $Target $label
        if ($LASTEXITCODE -ne 0) { Fail "Backup failed; $Target was NOT changed" }
    }
    # Host-side: bun loads .env and uses LIVE_/STAGING_DATABASE_URL_FROM_HOST for this target.
    Write-Host "==> Migrating the $Target database"
    bun --env-file="$envFile" scripts/migrate.ts $Target --dir (Join-Path $tmp "drizzle")
    if ($LASTEXITCODE -ne 0) { Fail "Migrations failed; $Target was NOT redeployed (the old container is still running)" }

    # --- Container: the compose service runs water-tracker:<target>; point that name at this image ---
    Write-Host "==> Recreating $container on $image"
    docker tag $image "water-tracker:$Target"
    docker compose @compose up -d --no-build --force-recreate $Target
    if ($LASTEXITCODE -ne 0) { Fail "Container start failed. Roll back: .\scripts\deploy.ps1 $Target $was" }

    $health = "http://127.0.0.1:$port/api/health"
    Write-Host "==> Probing $health"
    $version = $null
    $last = "no answer"
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 2
        try {
            $r = Invoke-RestMethod -Uri $health -TimeoutSec 3
            if ($r.ok -eq $true) { $version = $r.version; break }
            $last = "ok=false"
        } catch {
            $last = $_.Exception.Message
        }
    }
    $back = if ($was) { "Roll back: .\scripts\deploy.ps1 $Target $was" } else { "Check: docker logs $container" }
    if (-not $version) { Fail "$Target is not healthy on port $port after 30s ($last). $back" }
    if (-not $version.EndsWith("+$sha")) { Fail "$Target answers $version, not a build of $sha. $back" }

    Remove-OldImages '^v\d'
    Remove-OldImages '^sha-'

    $phone = ""
    $line = Get-Content $envFile | Where-Object { $_ -match "^PHONE_HOST=(.+)$" } | Select-Object -First 1
    if ($line -match "^PHONE_HOST=(.+)$") { $phone = "  |  phone: http://$($Matches[1]):$port" }
    # Optional HTTPS name from Tailscale Serve (live -> :8445, staging -> :8446); see README "HTTPS".
    $ts = Get-Content $envFile | Where-Object { $_ -match "^TS_HTTPS_HOST=(.+)$" } | Select-Object -First 1
    if ($ts -match "^TS_HTTPS_HOST=(.+)$") { $phone = "  |  phone: https://$($Matches[1]):$(if ($Target -eq 'live') { 8445 } else { 8446 })" }
    Write-Host "==> $Target is up: http://127.0.0.1:$port$phone  ($label, v$version)"
    if ($was -and $was -ne $label) { Write-Host "    Was $was. To go back: .\scripts\deploy.ps1 $Target $was" }
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    $code = 1
} finally {
    if ($tmp) { Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tmp, "$tmp.tar" }
}
exit $code
