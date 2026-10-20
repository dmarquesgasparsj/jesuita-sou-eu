Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"
Name "O jesuíta sou eu"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\OJesuitaSouEu"
InstallDirRegKey HKCU "Software\OJesuitaSouEu" "InstallDir"
RequestExecutionLevel user
Icon "${ICON}"
UninstallIcon "${ICON}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\OJesuitaSouEu.exe"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Portuguese"

Section "Aplicação"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /oname=OJesuitaSouEu.exe "${APP}"
  File /oname=app.ico "${ICON}"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  CreateDirectory "$SMPROGRAMS\O jesuíta sou eu"
  CreateShortcut "$SMPROGRAMS\O jesuíta sou eu\O jesuíta sou eu.lnk" "$INSTDIR\OJesuitaSouEu.exe" "" "$INSTDIR\app.ico"
  CreateShortcut "$DESKTOP\O jesuíta sou eu.lnk" "$INSTDIR\OJesuitaSouEu.exe" "" "$INSTDIR\app.ico"
  WriteRegStr HKCU "Software\OJesuitaSouEu" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OJesuitaSouEu" "DisplayName" "O jesuíta sou eu"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OJesuitaSouEu" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OJesuitaSouEu" "DisplayIcon" "$INSTDIR\app.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OJesuitaSouEu" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OJesuitaSouEu" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OJesuitaSouEu" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /IM OJesuitaSouEu.exe /F'
  Delete "$DESKTOP\O jesuíta sou eu.lnk"
  Delete "$SMPROGRAMS\O jesuíta sou eu\O jesuíta sou eu.lnk"
  RMDir "$SMPROGRAMS\O jesuíta sou eu"
  Delete "$INSTDIR\OJesuitaSouEu.exe"
  Delete "$INSTDIR\app.ico"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\OJesuitaSouEu"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OJesuitaSouEu"
SectionEnd
