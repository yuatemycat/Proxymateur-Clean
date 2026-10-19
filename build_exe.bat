@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo  Building Proxymateur Desktop (.exe)
echo ===================================================

cd /d "%~dp0"

if exist "E:\03_Devops\env.bat" (
    call "E:\03_Devops\env.bat"
) else (
    call "D:\01_Apps\DevTools\VSBuildTools\VC\Auxiliary\Build\vcvars64.bat"
    set "PATH=C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64;D:\02_Projects\Antigravity-Manager\tools\nasm\nasm-2.16.03;C:\Users\Renzu\AppData\Local\Programs\Python\Python312\Lib\site-packages\clang\native;%PATH%"
    set "LIBCLANG_PATH=C:\Users\Renzu\AppData\Local\Programs\Python\Python312\Lib\site-packages\clang\native"
    set "LIB=D:\01_Apps\DevTools\VSBuildTools\VC\Tools\MSVC\14.44.35207\lib\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\ucrt\x64;%LIB%"
    set "INCLUDE=D:\01_Apps\DevTools\VSBuildTools\VC\Tools\MSVC\14.44.35207\include;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\um;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\ucrt;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\shared;%INCLUDE%"
    set "CMAKE_GENERATOR=Ninja"
)

call npm run tauri build -- %*
