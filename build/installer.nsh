; Included by electron-builder in the Windows installer (package.json build.nsis.include).
; Uninstalling disconnects the fishtank from Claude Code and Copilot CLI, so their hooks don't point at a removed app.
; Not when the uninstaller runs as part of an update: the new version keeps the connection.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    nsExec::Exec '"$INSTDIR\resources\bin\fishtank.cmd" disconnect'
  ${endIf}
!macroend
