@echo off
title MDX Reader - Build installer
setlocal

set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"
cd /d "%APPDIR%"

net session >nul 2>&1
if %errorLevel% neq 0 (
  echo.
  echo   =====================================================
  echo    ADMINISTRATOR RIGHTS REQUIRED
  echo   =====================================================
  echo.
  echo   Right-click this file "Build-EXE.bat"
  echo   and choose:  Run as administrator
  echo.
  pause
  exit /b 1
)

echo.
echo   Building Windows installer + portable EXE...
echo   Folder: %APPDIR%
echo   Output: dist
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js required: https://nodejs.org
  pause
  exit /b 1
)

if not exist "%APPDIR%\node_modules\electron" (
  echo   Installing dependencies... this happens only once.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [!] npm install failed. Check your internet connection.
    pause
    exit /b 1
  )
)

call npm run dist
if errorlevel 1 (
  echo.
  echo   [!] Build failed.
  echo   [!] Tip: enable Windows Developer Mode from
  echo       Settings - Privacy ^& security - For developers
  echo       then run this file again as administrator.
  pause
  exit /b 1
)

if not exist "%APPDIR%\dist\*.exe" (
  echo.
  echo   [!] No .exe was produced. Check the errors above.
  pause
  exit /b 1
)

echo.
echo   Done. Opening the "dist" folder...
explorer "%APPDIR%\dist"
pause
