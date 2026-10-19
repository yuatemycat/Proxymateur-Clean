@echo off
cd /d "%~dp0"
if exist "E:\03_Devops\env.bat" (
    call "E:\03_Devops\env.bat"
)
npm run tauri dev -- --release
