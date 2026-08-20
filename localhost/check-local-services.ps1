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

$webStatus = Test-HttpStatus -Url 'http://localhost:3000'

Write-Host "WEB status: $webStatus"

if ($webStatus -eq 200) {
  Write-Host "Frontend is up on localhost:3000."
}
