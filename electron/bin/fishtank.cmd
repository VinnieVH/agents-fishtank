@echo off
rem Runs the Agent Fishtank command line (cli\cli.mjs) with the app's own binary in Node mode, so no Node.js is needed.
rem Lives in resources\bin of the installed app.
setlocal
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\..\Agent Fishtank.exe" "%~dp0..\cli\cli.mjs" %*
