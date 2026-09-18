!macro preInit
  ; Use the canonical per-user SXRON directory as the default location.
  ; Older builds could corrupt $INSTDIR with repeated --force-run suffixes.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\sxron-marketplace"
!macroend

!macro customInit
  ; Remove the previous uninstaller before electron-builder's old-file cleanup.
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
  ; In-place update. User data is preserved in %APPDATA%.
!macroend

!macro customUnInstall
  ; Keep user data during uninstall.
!macroend
