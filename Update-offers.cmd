@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 24 or newer first.
 pause
 exit /b 1
)
if not exist node_modules\unpdf (
 call npm ci
 if errorlevel 1 (pause & exit /b 1)
)
node scripts/compose.mjs
if errorlevel 1 (pause & exit /b 1)
node scripts/update-hosted.mjs
pause
