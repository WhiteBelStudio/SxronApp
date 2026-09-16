!macro customInit
  ; Close a running SXRON Marketplace before replacing its files.
  ; This allows the same Setup.exe to update an existing installation.
  nsExec::ExecToLog 'taskkill /F /T /IM "SXRON Marketplace.exe"'
  Pop $0
!macroend

!macro customHeader
  !system "echo SXRON Marketplace installer"
!macroend

!macro customInstall
  ; Installing the same appId over an existing installation performs an in-place update.
  ; User data is kept because deleteAppDataOnUninstall=false.
!macroend

!macro customUnInstall
  ; Keep user data during uninstall so a later installation can restore it.
!macroend
