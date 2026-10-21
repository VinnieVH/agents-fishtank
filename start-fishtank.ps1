# Starts the fishtank server in the background if it isn't already running.
# Used by the Copilot CLI sessionStart hook (registered by install.ps1).
param([int]$Port = $(if ($env:FISHTANK_PORT) { [int]$env:FISHTANK_PORT } else { 4321 }), [switch]$NoBrowser)

function Test-Port([int]$p) {
    $c = New-Object System.Net.Sockets.TcpClient
    try { return $c.ConnectAsync('127.0.0.1', $p).Wait(300) -and $c.Connected } catch { return $false } finally { $c.Dispose() }
}

if (Test-Port $Port) { exit 0 }

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { exit 0 }

$env:FISHTANK_PORT = "$Port"
Start-Process -FilePath $node -ArgumentList "`"$PSScriptRoot\server.js`"" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden

if (-not $NoBrowser) {
    for ($i = 0; $i -lt 20 -and -not (Test-Port $Port); $i++) { Start-Sleep -Milliseconds 250 }
    Start-Process "http://localhost:$Port"
}
exit 0
