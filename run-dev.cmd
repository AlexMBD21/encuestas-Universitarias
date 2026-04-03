@echo off
rem Move to script directory
cd /d "%~dp0"
rem Start frontend in a new PowerShell window (keeps window open)
start "Frontend - dev" powershell -NoExit -Command "Set-Location -LiteralPath '%CD%'; npm run dev"
rem Start functions in a separate PowerShell window (keeps window open)
start "Functions - dev:functions" powershell -NoExit -Command "Set-Location -LiteralPath '%CD%'; npm run dev:functions"
exit /b
