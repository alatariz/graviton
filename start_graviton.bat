@echo off
title Graviton Autonomous Web Cockpit
cd /d "%~dp0"
echo ===============================================================
echo   STARTING GRAVITON AUTONOMOUS COCKPIT (ISOLATED DAEMON)
echo ===============================================================
echo   Port : http://localhost:3000
echo   Mode : 100%% Localhost Isolated Headless Engine
echo ===============================================================
node web/server.js
pause
