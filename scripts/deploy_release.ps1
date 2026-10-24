# Stop any running Proxymateur instances
Stop-Process -Name "proxymateur" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$src = "E:\02_Projects\Proxymateur-Clean\src-tauri\target\release\proxymateur.exe"
if (-not (Test-Path -LiteralPath $src)) {
    Write-Error "Release binary not found at $src"
    exit 1
}

# Deploy to DevOps and Installed paths
Copy-Item -Force $src "E:\03_Devops\AntigravityManager\bin\proxymateur.exe"
if (Test-Path -LiteralPath "E:\01_Apps\Installed\Proxymateur_Clean") {
    Copy-Item -Force $src "E:\01_Apps\Installed\Proxymateur_Clean\proxymateur.exe"
}
if (Test-Path -LiteralPath "E:\01_Apps\Installed\Proxymateur") {
    Copy-Item -Force $src "E:\01_Apps\Installed\Proxymateur\proxymateur.exe"
}

# Start the updated binary
Start-Process "E:\03_Devops\AntigravityManager\bin\proxymateur.exe"
Write-Host "[Deploy] Proxymateur release updated and launched successfully." -ForegroundColor Green
