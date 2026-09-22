# Deploy the current working tree to the live or staging container.
#
#   .\scripts\deploy.ps1 staging   # test a feature branch on your phone
#   .\scripts\deploy.ps1 live      # ship main
#
# Steps: build image -> recreate container -> probe the URL. Exits non-zero on any failure.

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
docker compose build $Target
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

Write-Host "==> Recreating container"
docker compose up -d --force-recreate $Target
if ($LASTEXITCODE -ne 0) { Write-Error "Container start failed"; exit 1 }

Write-Host "==> Probing http://127.0.0.1:$port"
$ok = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
}

if (-not $ok) {
    Write-Error "$Target did not answer on port $port after 30s. Check: docker logs water-tracker$(if ($Target -eq 'staging') { '-staging' })"
    exit 1
}

$phone = ""
if (Test-Path ".env") {
    $line = Get-Content ".env" | Where-Object { $_ -match "^PHONE_HOST=(.+)$" } | Select-Object -First 1
    if ($line -match "^PHONE_HOST=(.+)$") { $phone = "  |  phone: http://$($Matches[1]):$port" }
}
Write-Host "==> $Target is up: http://127.0.0.1:$port$phone  ($branch @ $sha)"
