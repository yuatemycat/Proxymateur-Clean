Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strPsScript = objFSO.BuildPath(strScriptDir, "gemini_gateway.ps1")

strCmd = "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strPsScript & """"
objShell.Run strCmd, 0, False
