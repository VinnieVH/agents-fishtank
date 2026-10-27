# Registers the Copilot Fishtank as a Copilot CLI sessionStart hook (Windows).
# Usage: powershell -ExecutionPolicy Bypass -File .\install.ps1
$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Error 'Node.js 20.19+ is required. Install it from https://nodejs.org and run this again.' }
$ver = [version]((& node --version).TrimStart('v'))
if ($ver -lt [version]'20.19.0') { Write-Error "Node.js 20.19+ is required (found v$ver)." }

# Build the page (Vite + PixiJS) into dist/, which server.js serves.
Push-Location $PSScriptRoot
try {
  Write-Host 'Installing dependencies and building the fishtank...'
  & npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build failed.' }
} finally { Pop-Location }

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
