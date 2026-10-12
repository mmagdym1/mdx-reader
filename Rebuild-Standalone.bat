@echo off
title MDX Reader - Rebuild standalone HTML
setlocal
set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"
cd /d "%APPDIR%"

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js required: https://nodejs.org
  pause
  exit /b 1
)

node build-standalone.js
if errorlevel 1 (
  echo   [!] Rebuild failed.
  pause
  exit /b 1
)

echo.
echo   Done. MDX-Reader-Standalone.html has been updated.
pause
