!macro customInit
  ; Remove the previous uninstaller before electron-builder's old-file cleanup.
  ; This avoids the known NSIS overwrite lock during in-place upgrades.
  Delete "$INSTDIR\Uninstall*.exe"
  nsExec::ExecToLog 'taskkill /F /T /IM "SXRON Marketplace.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM "sxron-api.exe"'
  Pop $0
!macroend

!macro customHeader
  !system "echo SXRON Marketplace installer"
!macroend

!macro customInstall
  ; In-place update. User data is preserved.
!macroend

!macro customUnInstall
  ; Keep user data during uninstall.
!macroend
