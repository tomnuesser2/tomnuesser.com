@echo off
chcp 65001 >nul
title tomnuesser.com - Admin
cd /d "%~dp0"
echo.
echo  =========================================
echo    tomnuesser.com - Admin-Panel
echo  =========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js ist nicht installiert. Das wird einmalig gebraucht.
  echo.
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo  Installiere Node.js automatisch ...
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    echo.
    echo  Fertig. Bitte dieses Fenster schliessen und Admin-starten.bat NOCHMAL starten.
  ) else (
    echo  Bitte "LTS" von https://nodejs.org installieren, dann diese Datei nochmal starten.
    start https://nodejs.org
  )
  echo.
  pause
  exit /b
)
echo  Starte Server ... (dieses Fenster offen lassen!)
echo  Zum Beenden: Fenster schliessen oder STRG+C
echo.
start "" /min cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8787/admin/"
node admin\server.mjs
echo.
echo  Der Server wurde beendet oder ist abgestuerzt (siehe Meldung oben).
pause
