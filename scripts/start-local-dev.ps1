$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $repoRoot 'api'
$webDir = Join-Path $repoRoot 'web'

Write-Host 'Starting Friink API...'
Start-Process powershell -ArgumentList "-NoExit","-WorkingDirectory","$apiDir","-Command","npm run start:dev" | Out-Null

Start-Sleep -Seconds 3

Write-Host 'Starting Friink web app...'
Start-Process powershell -ArgumentList "-NoExit","-WorkingDirectory","$webDir","-Command","npm run dev:local" | Out-Null

Write-Host 'Local services launched.'
Write-Host 'API: http://localhost:3001'
Write-Host 'Web: http://localhost:3000'
