; Explorer context menu entries for opening files and folders in r0.
; On Windows 11 they appear under "Show more options".

!macro R0_CONTEXT_MENU KEY TARGET
  WriteRegStr SHCTX "Software\Classes\${KEY}\shell\R0" "" "Open with ${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\${KEY}\shell\R0" "Icon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr SHCTX "Software\Classes\${KEY}\shell\R0\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"${TARGET}$\""
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro R0_CONTEXT_MENU "*" "%1"
  !insertmacro R0_CONTEXT_MENU "Directory" "%1"
  !insertmacro R0_CONTEXT_MENU "Directory\Background" "%V"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    DeleteRegKey SHCTX "Software\Classes\*\shell\R0"
    DeleteRegKey SHCTX "Software\Classes\Directory\shell\R0"
    DeleteRegKey SHCTX "Software\Classes\Directory\Background\shell\R0"
  ${EndIf}
!macroend
