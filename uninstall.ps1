# Removes the Copilot Fishtank hook and stops the server (Windows).
$copilotHome = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $env:USERPROFILE '.copilot' }
$hookFile = Join-Path $copilotHome 'hooks\fishtank.json'
if (Test-Path $hookFile) { Remove-Item $hookFile; Write-Host "Removed $hookFile" } else { Write-Host 'Hook not installed.' }

$port = if ($env:FISHTANK_PORT) { [int]$env:FISHTANK_PORT } else { 4321 }
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; Write-Host "Stopped fishtank server (PID $($_.OwningProcess))." }
