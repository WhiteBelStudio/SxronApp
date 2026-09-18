!macro preInit
  ; Always use the canonical per-user SXRON installation directory.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\sxron-marketplace"
!macroend

!macro customInit
  ; The launcher is outside $INSTDIR, so the installer can safely replace app files.
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
