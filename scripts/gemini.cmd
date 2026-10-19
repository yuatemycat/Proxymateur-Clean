@echo off
rem Google Gemini Desktop launcher: routes through Proxymateur when available, falls back to native instantly.
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0gemini_gateway.ps1" %*
