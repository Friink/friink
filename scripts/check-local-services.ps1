$ErrorActionPreference = 'Stop'

function Test-HttpStatus {
  param(
    [string]$Url,
    [string]$Method = 'GET'
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -Method $Method -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    return $response.StatusCode
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($null -eq $status) {
      return 0
    }
    return $status
  }
}

$apiStatus = Test-HttpStatus -Url 'http://localhost:3001/api/auth/login' -Method 'POST'
$webStatus = Test-HttpStatus -Url 'http://localhost:3000'

Write-Host "API status: $apiStatus"
Write-Host "WEB status: $webStatus"

if ($apiStatus -eq 404) {
  Write-Host "API is running but the route is not available yet. Check the auth controller and Nest startup."
}

if ($webStatus -eq 200) {
  Write-Host "Frontend is up on localhost:3000."
}
