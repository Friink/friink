$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot 'web'
$apiDir = Join-Path $repoRoot 'api'
$nextDir = Join-Path $webDir '.next'
$apiEnvFile = Join-Path $apiDir '.env.development'
$webPort = 3000
$apiPort = 8000
$apiPython = Join-Path $apiDir '.venv\Scripts\python.exe'

function Stop-LocalPort {
  param (
    [Parameter(Mandatory = $true)]
    [int] $Port
  )

  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    Write-Host "Stopping process $($listener.OwningProcess) on localhost:$Port..."
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
  }
}

Stop-LocalPort -Port $webPort
Stop-LocalPort -Port $apiPort

if (Test-Path -LiteralPath $nextDir) {
  Write-Host 'Clearing the generated Next.js cache...'
  Remove-Item -LiteralPath $nextDir -Recurse -Force -ErrorAction Stop
}

if (-not (Test-Path -LiteralPath $apiPython)) {
  throw "FastAPI virtual environment not found at $apiPython. Run the setup steps in api/README.md first."
}

if (-not (Test-Path -LiteralPath $apiEnvFile)) {
  throw "Development environment file not found at $apiEnvFile. Create it before starting localhost."
}

Write-Host 'Starting Friink API...'
$apiCommand = @"
`$ErrorActionPreference = 'Stop'
Get-Content -LiteralPath '.env.development' | ForEach-Object {
  if (`$_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
    [Environment]::SetEnvironmentVariable(`$Matches[1], `$Matches[2])
  }
}
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port $apiPort
"@
Start-Process powershell -WorkingDirectory $apiDir -ArgumentList "-NoExit","-Command",$apiCommand | Out-Null

Write-Host 'Starting Friink web app...'
Start-Process powershell -WorkingDirectory $webDir -ArgumentList "-NoExit","-Command","npm run dev:local" | Out-Null

Write-Host ''
Write-Host "Local API service launched at http://localhost:$apiPort"
Write-Host "Local web service launched at http://localhost:$webPort"
