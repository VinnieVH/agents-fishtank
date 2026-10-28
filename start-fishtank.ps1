# Starts the fishtank server in the background if it isn't already running.
# Used by the Copilot CLI and Claude Code sessionStart hooks (registered by install.ps1). Prints nothing:
# Claude Code adds a SessionStart hook's output to the conversation.
#   -Claude     forward the hook event on stdin to the server, so a new Claude Code session shows up right away
#   -NoBrowser  don't open the page
param([int]$Port = $(if ($env:FISHTANK_PORT) { [int]$env:FISHTANK_PORT } else { 4321 }), [switch]$NoBrowser, [switch]$Claude)

$hookEvent = if ($Claude) { [Console]::In.ReadToEnd() } else { $null }

function Test-Port([int]$p) {
    $c = New-Object System.Net.Sockets.TcpClient
    try { return $c.ConnectAsync('127.0.0.1', $p).Wait(300) -and $c.Connected } catch { return $false } finally { $c.Dispose() }
}
function Send-Event {
    if (-not $Claude) { return }
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:$Port/hook/claude" -Method Post -ContentType 'application/json' `
            -Body ([Text.Encoding]::UTF8.GetBytes($hookEvent)) -TimeoutSec 2 -UseBasicParsing | Out-Null
    } catch { }
}

if (Test-Port $Port) { Send-Event; exit 0 }

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { exit 0 }

$env:FISHTANK_PORT = "$Port"
Start-Process -FilePath $node -ArgumentList "`"$PSScriptRoot\server\index.ts`"" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden

for ($i = 0; $i -lt 20 -and -not (Test-Port $Port); $i++) { Start-Sleep -Milliseconds 250 }
Send-Event
if (-not $NoBrowser) { Start-Process "http://localhost:$Port" }
exit 0
