# Removes the Agent Fishtank hooks (Copilot CLI and Claude Code) and stops the server (Windows).
$copilotHome = if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $env:USERPROFILE '.copilot' }
$hookFile = Join-Path $copilotHome 'hooks\fishtank.json'
if (Test-Path $hookFile) { Remove-Item $hookFile; Write-Host "Removed $hookFile" }

$claudeHome = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE '.claude' }
$settings = Join-Path $claudeHome 'settings.json'
if ((Test-Path $settings) -and (Select-String -Path $settings -Pattern '/hook/claude|start-fishtank|statusline.ts' -Quiet)) {
  & node (Join-Path $PSScriptRoot 'scripts\claude-hooks.ts') uninstall $settings
  if ($LASTEXITCODE -eq 0) { Write-Host "Removed the Claude Code hooks from $settings" }
}

$port = if ($env:FISHTANK_PORT) { [int]$env:FISHTANK_PORT } else { 4321 }
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; Write-Host "Stopped fishtank server (PID $($_.OwningProcess))." }
