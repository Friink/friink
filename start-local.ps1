<#
Start-local.ps1

Usage: Run this from the repo root to install deps (if needed) and
open two PowerShell windows: one for the Next web dev server and one
for the Nest API dev server. The API will be started with the
`DATABASE_URL` environment variable set to the staging Neon DB.

Note: This script opens new PowerShell windows so both processes
continue running independently.
#>

param(
    [string]$DatabaseUrl = "postgresql://neondb_owner:npg_KvgWhwi4C6oe@ep-floral-poetry-azd2jxuj-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    [string]$JwtSecret = "dev-secret"
)

$repo = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $repo

Write-Host "Repo root: $repo"

if (-not (Test-Path "$repo\web\node_modules")) {
    Write-Host "Installing web dependencies..."
    npm --prefix web install
}

if (-not (Test-Path "$repo\api\node_modules")) {
    Write-Host "Installing api dependencies..."
    npm --prefix api install
}

Write-Host "Running DB migrations against: $DatabaseUrl"
$env:DATABASE_URL = $DatabaseUrl
$env:JWT_SECRET = $JwtSecret
npm --prefix api run db:migrate

Write-Host "Starting web (Next) in a new window..."
Start-Process powershell -ArgumentList @('-NoExit','-Command',"cd '$repo\web'; npm run dev")

Write-Host "Starting api (Nest) in a new window with DATABASE_URL and JWT_SECRET set..."
$psCmd = "`$env:DATABASE_URL='$DatabaseUrl'; `$env:JWT_SECRET='$JwtSecret'; cd '$repo\api'; npm run start:dev"
Start-Process powershell -ArgumentList @('-NoExit','-Command', $psCmd)

Write-Host "Launched web and api. Check the new windows for logs."
