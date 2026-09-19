!macro preInit
  ; Always use one canonical per-user SXRON installation directory.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\sxron-marketplace"
!macroend

!macro customInit
  ; Kill every legacy SXRON process before replacing files.
  nsExec::ExecToLog 'taskkill /F /T /IM "SXRON Marketplace.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM "sxron-api.exe"'
  Pop $0

  ; Remove uninstallers left by malformed/legacy installs.
  Delete "$INSTDIR\Uninstall*.exe"

  ; Remove old malformed installation directories created by the historical
  ; --force-run updater bug. Keep the canonical directory above untouched.
  RMDir /r "$LOCALAPPDATA\Programs\sxron-marketplace --force-run"
  RMDir /r "$LOCALAPPDATA\Programs\sxron-marketplace --force-run --force-run"
  RMDir /r "$LOCALAPPDATA\Programs\sxron-marketplace --force-run --force-run --force-run"
  RMDir /r "$LOCALAPPDATA\Programs\sxron-marketplace --force-run --force-run --force-run --force-run"
  RMDir /r "$LOCALAPPDATA\Programs\sxron-marketplace --force-run --force-run --force-run --force-run --force-run"
  nsExec::ExecToLog 'taskkill /F /T /IM "SXRON Marketplace.exe"'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /T /IM "sxron-api.exe"'
  Pop $0
!macroend

!macro customHeader
  !system "echo SXRON Marketplace installer"
!macroend

!macro customInstall
  ; Copy the stable launcher outside the application directory.
  CreateDirectory "$LOCALAPPDATA\SXRON Launcher"
  CopyFiles /SILENT "$INSTDIR\launcher\SXRON Launcher.exe" "$LOCALAPPDATA\SXRON Launcher"

  ; Replace legacy shortcuts whose targets may contain malformed --force-run arguments.
  Delete "$DESKTOP\SXRON Marketplace.lnk"
  Delete "$DESKTOP\SXRON Launcher.lnk"
  CreateShortcut "$DESKTOP\SXRON Marketplace.lnk" "$LOCALAPPDATA\SXRON Launcher\SXRON Launcher.exe"

  CreateDirectory "$SMPROGRAMS\SXRON Marketplace"
  Delete "$SMPROGRAMS\SXRON Marketplace\SXRON Marketplace.lnk"
  Delete "$SMPROGRAMS\SXRON Marketplace\SXRON Launcher.lnk"
  CreateShortcut "$SMPROGRAMS\SXRON Marketplace\SXRON Marketplace.lnk" "$LOCALAPPDATA\SXRON Launcher\SXRON Launcher.exe"
!macroend

!macro customUnInstall
  Delete "$DESKTOP\SXRON Marketplace.lnk"
  Delete "$DESKTOP\SXRON Launcher.lnk"
  Delete "$SMPROGRAMS\SXRON Marketplace\SXRON Marketplace.lnk"
  Delete "$SMPROGRAMS\SXRON Marketplace\SXRON Launcher.lnk"
  Delete "$LOCALAPPDATA\SXRON Launcher\SXRON Launcher.exe"
  RMDir "$LOCALAPPDATA\SXRON Launcher"
!macroend
