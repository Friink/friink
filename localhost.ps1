$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot 'web'
$nextDir = Join-Path $webDir '.next'
$port = 3000

$listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  Write-Host "Stopping process $($listener.OwningProcess) on localhost:$port..."
  Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
}

if (Test-Path -LiteralPath $nextDir) {
  Write-Host 'Clearing the generated Next.js cache...'
  Remove-Item -LiteralPath $nextDir -Recurse -Force -ErrorAction Stop
}

Write-Host 'Starting Friink web app...'
Start-Process powershell -ArgumentList "-NoExit","-WorkingDirectory","$webDir","-Command","npm run dev:local" | Out-Null

Write-Host "Local web service launched at http://localhost:$port"
