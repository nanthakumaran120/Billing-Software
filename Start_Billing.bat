@echo off
title Srinivasa Billing Server
color 0b
cls
echo ===================================================
echo       SRINIVASA BILLING APPLICATION SERVER
echo ===================================================
echo.
echo Initializing servers... Please wait...
echo.

cd /d "D:\New folder\billing"

:: ── Full path to npm (needed when launched via wscript/shortcut) ─────
set NPM="C:\Program Files\nodejs\npm.cmd"

:: ── Kill any old node processes silently ────────────────────────────
taskkill /F /IM node.exe >nul 2>&1

:: ── Start all servers (npm start runs concurrently) ─────────────────
:: Vite is configured to automatically open the browser once ready
start /b cmd /c %NPM% start

echo.
echo Application is starting. The browser will open automatically.
echo.
echo ===================================================
echo   SERVER IS RUNNING. DO NOT CLOSE THIS WINDOW.
echo   Closing this window will stop the application.
echo ===================================================
echo.
pause
