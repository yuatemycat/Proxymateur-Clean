@echo off
rem Antigravity 2.0 CLI/CMD launcher: routes through Proxymateur when available, falls back to native instantly.
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0antigravity_gateway.ps1" %*
