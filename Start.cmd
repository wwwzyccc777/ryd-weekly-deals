@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Please install Node.js 24 or newer from https://nodejs.org/
 pause
 exit /b 1
)
echo Starting Ryd Weekly Grocery Guide...
if not exist node_modules\unpdf (
 call npm ci
 if errorlevel 1 (pause & exit /b 1)
)
echo Open http://127.0.0.1:8787 in your browser.
node scripts/compose.mjs
if errorlevel 1 (pause & exit /b 1)
node scripts/preview.mjs
pause
