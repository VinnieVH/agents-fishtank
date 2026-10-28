# Builds the Agent Fishtank and registers it as a sessionStart hook for GitHub Copilot CLI and/or Claude Code (Windows).
# Usage: powershell -ExecutionPolicy Bypass -File .\install.ps1            # every CLI found on this machine
#        powershell -ExecutionPolicy Bypass -File .\install.ps1 claude     # only the CLIs named (copilot, claude)
$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Error 'Node.js 22.18+ is required. Install it from https://nodejs.org and run this again.' }
$ver = [version]((& node --version).TrimStart('v'))
if ($ver -lt [version]'22.18.0') { Write-Error "Node.js 22.18+ is required (found v$ver)." }

$port = if ($env:FISHTANK_PORT) { [int]$env:FISHTANK_PORT } else { 4321 }
$copilotHome = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $env:USERPROFILE '.copilot' }
$claudeHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE '.claude' }

$clis = @($args)
if (-not $clis.Count) {
  if ((Get-Command copilot -ErrorAction SilentlyContinue) -or (Test-Path $copilotHome)) { $clis += 'copilot' }
  if ((Get-Command claude -ErrorAction SilentlyContinue) -or (Test-Path $claudeHome)) { $clis += 'claude' }
}
if (-not $clis.Count) { Write-Error 'Found neither GitHub Copilot CLI nor Claude Code. Install one, or name it: install.ps1 copilot|claude' }
foreach ($cli in $clis) { if ($cli -notin 'copilot', 'claude') { Write-Error "Unknown CLI '$cli' (use copilot or claude)." } }

# Build the page (Vite + PixiJS) into dist/, which the server serves.
Push-Location $PSScriptRoot
try {
  Write-Host 'Installing dependencies and building the fishtank...'
  & npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build failed.' }
} finally { Pop-Location }

$script = Join-Path $PSScriptRoot 'start-fishtank.ps1'
foreach ($cli in $clis) {
  if ($cli -eq 'copilot') {
    $hooksDir = Join-Path $copilotHome 'hooks'
    New-Item -ItemType Directory -Force -Path $hooksDir | Out-Null
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
  } else {
    # Claude Code runs hook commands in Git Bash (or PowerShell without it); forward slashes work in both.
    $command = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$($script -replace '\\', '/')`" -Claude"
    $settings = Join-Path $claudeHome 'settings.json'
    & node (Join-Path $PSScriptRoot 'scripts\claude-hooks.ts') install $settings $port $command
    if ($LASTEXITCODE -ne 0) { throw "Could not update $settings." }
    Write-Host "Installed Claude Code hooks and status line in $settings (your own status line still shows)" -ForegroundColor Green
  }
}

Write-Host 'The fishtank opens automatically the next time you start a session.'
Write-Host "Start it now:  powershell -ExecutionPolicy Bypass -File `"$script`""
