$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot 'web'

Write-Host 'Starting Friink web app...'
Start-Process powershell -ArgumentList "-NoExit","-WorkingDirectory","$webDir","-Command","npm run dev:local" | Out-Null

Write-Host 'Local web service launched at http://localhost:3000'
