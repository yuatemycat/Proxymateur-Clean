@echo off
rem agy shim: decides gateway vs native per launch from Proxymateur's toggle.
rem Keep this file next to agy_gateway.ps1, in a PATH directory that precedes the real agy.
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0agy_gateway.ps1" %*
exit /b %ERRORLEVEL%
