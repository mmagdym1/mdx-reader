@echo off
chcp 65001 >nul
title MDX Reader
cd /d "%~dp0"

echo.
echo   ==========================================
echo    MDX Reader - Markdown viewer / editor
echo   ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js is not installed.
  echo   [!] Node.js ghyr mthbt - Install from: https://nodejs.org
  echo.
  echo   Or just double-click:  MDX-Reader-Standalone.html
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo   Installing Electron ... this happens only once.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [!] npm install failed. Check your internet connection.
    pause
    exit /b 1
  )
)

:: Stop stale instances so Electron can acquire its single-instance lock.
taskkill /F /IM electron.exe >nul 2>nul
taskkill /F /IM "MDX Reader.exe" >nul 2>nul

echo   Starting...
call npm start
