# Registers the Copilot Fishtank as a Copilot CLI sessionStart hook (Windows).
# Usage: powershell -ExecutionPolicy Bypass -File .\install.ps1
$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Error 'Node.js 18+ is required. Install it from https://nodejs.org and run this again.' }
$major = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($major -lt 18) { Write-Error "Node.js 18+ is required (found $(& node --version))." }

$copilotHome = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $env:USERPROFILE '.copilot' }
$hooksDir = Join-Path $copilotHome 'hooks'
New-Item -ItemType Directory -Force -Path $hooksDir | Out-Null

$script = Join-Path $PSScriptRoot 'start-fishtank.ps1'
$hook = [ordered]@{
  version = 1
  hooks   = [ordered]@{
    sessionStart = @(
      [ordered]@{
        type       = 'command'
        powershell = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$script`""
        timeoutSec = 15
      }
    )
  }
}
$hookFile = Join-Path $hooksDir 'fishtank.json'
[IO.File]::WriteAllText($hookFile, ($hook | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false))

Write-Host "Installed Copilot CLI hook: $hookFile" -ForegroundColor Green
Write-Host 'The fishtank opens automatically the next time you start `copilot`.'
Write-Host "Start it now:  powershell -ExecutionPolicy Bypass -File `"$script`""
