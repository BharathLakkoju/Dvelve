@echo off
echo Starting Dvelve Backend...
cd /d d:\workFiles\ai-automation-web-app\backend
start "Dvelve Backend" cmd /k "uvicorn main:app --port 8000 --reload"
timeout /t 2 /nobreak >nul
echo Starting Dvelve Frontend...
cd /d d:\workFiles\ai-automation-web-app\frontend
start "Dvelve Frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
echo.
echo ========================================
echo  Dvelve is starting up!
echo  Frontend: http://localhost:5173
echo  Backend API: http://localhost:8000
echo  (API docs disabled — set ENABLE_API_DOCS=true in .env to enable)
echo ========================================
start "" http://localhost:5173
