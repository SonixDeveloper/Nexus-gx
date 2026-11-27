!macro customInstall
  WriteRegStr SHCTX "Software\Classes\NexusGX.Url" "" "NEXUS GX URL"
  WriteRegStr SHCTX "Software\Classes\NexusGX.Url" "URL Protocol" ""
  WriteRegStr SHCTX "Software\Classes\NexusGX.Url\DefaultIcon" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\",0"
  WriteRegStr SHCTX "Software\Classes\NexusGX.Url\shell\open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  WriteRegStr SHCTX "Software\NexusGX\Capabilities" "ApplicationName" "NEXUS GX"
  WriteRegStr SHCTX "Software\NexusGX\Capabilities" "ApplicationDescription" "NEXUS GX desktop browser"
  WriteRegStr SHCTX "Software\NexusGX\Capabilities\URLAssociations" "http" "NexusGX.Url"
  WriteRegStr SHCTX "Software\NexusGX\Capabilities\URLAssociations" "https" "NexusGX.Url"
  WriteRegStr SHCTX "Software\RegisteredApplications" "NEXUS GX" "Software\NexusGX\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegValue SHCTX "Software\RegisteredApplications" "NEXUS GX"
  DeleteRegKey SHCTX "Software\NexusGX\Capabilities"
  DeleteRegKey SHCTX "Software\Classes\NexusGX.Url"
!macroend
