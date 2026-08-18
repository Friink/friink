<#
Start-local.ps1

Usage: Run this from the repo root to install deps (if needed) and
start the Next web dev server.
#>

$repo = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $repo

Write-Host "Repo root: $repo"

if (-not (Test-Path "$repo\web\node_modules")) {
    Write-Host "Installing web dependencies..."
    npm --prefix web install
}

Write-Host "Starting web (Next) dev server..."
Start-Process powershell -ArgumentList @('-NoExit','-Command',"cd '$repo\web'; npm run dev:local")

Write-Host "Launched web server at http://localhost:3000"
