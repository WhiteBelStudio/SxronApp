!macro customHeader
  !system "echo SXRON Marketplace installer"
!macroend

!macro customInstall
  ; SXRON Marketplace uses the standard NSIS installer flow.
  ; The application registers its sxron:// protocol on first launch.
!macroend

!macro customUnInstall
  ; Keep user data during uninstall so a later installation can restore it.
!macroend
