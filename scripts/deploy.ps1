# Deploy the current working tree to the live or staging container.
#
#   .\scripts\deploy.ps1 staging   # test a feature branch on your phone (staging database, demo data)
#   .\scripts\deploy.ps1 live      # ship main
#
# Steps: build image -> migrate the TARGET's database -> recreate container -> probe /api/health.
# Exits non-zero on any failure; a failed migration stops the deploy before the container changes.

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("live", "staging")]
    [string]$Target
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$port = if ($Target -eq "live") { 4210 } else { 4211 }
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$sha = (git rev-parse --short HEAD).Trim()

if ($Target -eq "live" -and $branch -ne "main") {
    Write-Error "Refusing to deploy branch '$branch' to live. Merge to main first."
    exit 1
}

Write-Host "==> Building $Target from $branch @ $sha"
$env:GIT_SHA = $sha   # docker-compose.yml passes it to the image as a build arg
docker compose build $Target
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

# Host-side: bun loads .env and uses LIVE_/STAGING_DATABASE_URL_FROM_HOST for this target.
Write-Host "==> Migrating the $Target database"
bun scripts/migrate.ts $Target
if ($LASTEXITCODE -ne 0) { Write-Error "Migrations failed; $Target was NOT redeployed (the old container is still running)"; exit 1 }

Write-Host "==> Recreating container"
docker compose up -d --force-recreate $Target
if ($LASTEXITCODE -ne 0) { Write-Error "Container start failed"; exit 1 }

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

if (-not $version) {
    Write-Error "$Target is not healthy on port $port after 30s ($last). Check: docker logs water-tracker$(if ($Target -eq 'staging') { '-staging' })"
    exit 1
}
if (-not $version.EndsWith("+$sha")) {
    Write-Warning "Health reports version $version, expected a build of $sha"
}

$phone = ""
if (Test-Path ".env") {
    $line = Get-Content ".env" | Where-Object { $_ -match "^PHONE_HOST=(.+)$" } | Select-Object -First 1
    if ($line -match "^PHONE_HOST=(.+)$") { $phone = "  |  phone: http://$($Matches[1]):$port" }
    # Optional HTTPS name from Tailscale Serve (live -> :8445, staging -> :8446); see README "HTTPS".
    $ts = Get-Content ".env" | Where-Object { $_ -match "^TS_HTTPS_HOST=(.+)$" } | Select-Object -First 1
    if ($ts -match "^TS_HTTPS_HOST=(.+)$") { $phone = "  |  phone: https://$($Matches[1]):$(if ($Target -eq 'live') { 8445 } else { 8446 })" }
}
Write-Host "==> $Target is up: http://127.0.0.1:$port$phone  (v$version, $branch @ $sha)"
