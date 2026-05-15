@echo off
cd /d "D:\New folder\billing"

:: ── Full path to npm (needed when launched via wscript/shortcut) ─────
set NPM="C:\Program Files\nodejs\npm.cmd"

:: ── Kill any old node processes silently ────────────────────────────
taskkill /F /IM node.exe >nul 2>&1

:: ── Start all servers (npm start runs concurrently) ─────────────────
start /b cmd /c %NPM% start

:: ── Poll until port 3005 is ready (checks every 1s, max 40 tries) ───
set TRIES=0
:WAIT_LOOP
    set /a TRIES+=1
    if %TRIES% GTR 40 goto TIMEOUT_OPEN
    powershell -NoProfile -Command ^
      "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('localhost',3005);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
    if %ERRORLEVEL%==0 goto OPEN_BROWSER
    timeout /t 1 /nobreak >nul
goto WAIT_LOOP

:OPEN_BROWSER
start http://localhost:3005
exit /b 0

:TIMEOUT_OPEN
start http://localhost:3005
exit /b 0
