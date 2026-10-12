@echo off
title MDX Reader - Force quit
echo.
echo   Closing any stuck MDX Reader / Electron instance...
echo.

taskkill /F /IM "MDX Reader.exe" >nul 2>nul
if not errorlevel 1 echo   - closed: MDX Reader.exe

taskkill /F /IM electron.exe >nul 2>nul
if not errorlevel 1 echo   - closed: electron.exe

echo.
echo   Done. You can start the app again now.
timeout /t 3 >nul
