param(
  [switch]$SkipMigration
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$envFile = Join-Path $root ".env.local"
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $root ".env.local.example") $envFile
  Write-Host "Created .env.local. Update DATABASE_URL, then run this script again."
  exit 1
}

$apiEnv = Join-Path $root "apps/api/.env"
Copy-Item $envFile $apiEnv -Force

$databaseUrl = (Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=', ''
if ($databaseUrl -notmatch '@([^:/?]+):?(\d+)?') {
  throw "DATABASE_URL is missing or malformed in .env.local"
}

$dbHost = $Matches[1]
$dbPort = if ($Matches[2]) { [int]$Matches[2] } else { 5432 }
$connection = Test-NetConnection $dbHost -Port $dbPort -WarningAction SilentlyContinue
if (-not $connection.TcpTestSucceeded) {
  throw "PostgreSQL is not reachable at ${dbHost}:${dbPort}. Install/start PostgreSQL or use a hosted PostgreSQL DATABASE_URL."
}

$listeners = Get-NetTCPConnection -LocalPort 3000,4000 -State Listen -ErrorAction SilentlyContinue
$processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $processIds) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}
if ($processIds) {
  Write-Host "Stopped existing local server processes on ports 3000/4000."
}

if (-not $SkipMigration) {
  corepack pnpm --filter "@josum/api" prisma:migrate:deploy
}

corepack pnpm --filter "@josum/api" build

New-Item -ItemType Directory -Force -Path (Join-Path $root "logs") | Out-Null

$nextDevDir = Resolve-Path (Join-Path $root "apps/web/.next-dev") -ErrorAction SilentlyContinue
if ($nextDevDir -and $nextDevDir.Path.StartsWith($root.Path)) {
  Push-Location (Join-Path $root "apps/web")
  node -e "require('fs').rmSync('.next-dev',{recursive:true,force:true})"
  Pop-Location
  Write-Host "Cleared stale Next.js dev cache."
}

$apiLog = Join-Path $root "logs/api-local.log"
$webLog = Join-Path $root "logs/web-local.log"

Start-Process powershell -WindowStyle Hidden -WorkingDirectory $root -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", "corepack pnpm --filter '@josum/api' start *> '$apiLog'"
)

Start-Process powershell -WindowStyle Hidden -WorkingDirectory $root -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", "corepack pnpm --filter '@josum/web' dev *> '$webLog'"
)

Write-Host "Started local API and web servers."
Write-Host "Web: http://localhost:3000"
Write-Host "API: http://localhost:4000/health"
Write-Host "Logs: logs/api-local.log and logs/web-local.log"
