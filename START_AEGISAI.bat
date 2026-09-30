@echo off
title AegisAI Platform Launcher
color 0A

echo ============================================================
echo   AegisAI Governance Platform - Starting All Services
echo ============================================================
echo.

SET PROJECT=c:\Users\DHARSHINI N\AegisAI-Governance-Platform\AegisAI-Governance-Platform
SET PG_CTL="C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
SET PGDATA=%PROJECT%\.pgdata
SET PGPORT=5433

:: ── 1. Start PostgreSQL ───────────────────────────────────────
echo [1/4] Starting PostgreSQL on port %PGPORT%...
%PG_CTL% start -D "%PGDATA%" -o "-p %PGPORT%" -s
IF %ERRORLEVEL%==0 (
    echo       PostgreSQL started successfully.
) ELSE (
    echo       PostgreSQL may already be running, or check for errors.
)
echo.

:: ── 2. Start MLflow ───────────────────────────────────────────
echo [2/4] Starting MLflow Tracking Server on port 5001...
start "MLflow Server" cmd /k "cd /d ^"%PROJECT%^" && title MLflow Server && echo Starting MLflow... && mlflow server --host 127.0.0.1 --port 5001 --backend-store-uri sqlite:///mlflow.db"
timeout /t 3 /nobreak > nul
echo       MLflow started.
echo.

:: ── 3. Start API Backend ──────────────────────────────────────
echo [3/4] Starting API Backend on port 5000...
start "AegisAI API" cmd /k "cd /d ^"%PROJECT%^" && title AegisAI API && echo Starting API Server... && pnpm --filter @workspace/api-server run dev"
timeout /t 8 /nobreak > nul
echo       API server started.
echo.

:: ── 4. Start Frontend ─────────────────────────────────────────
echo [4/4] Starting Frontend on port 5173...
start "AegisAI Frontend" cmd /k "cd /d ^"%PROJECT%\artifacts\aegisai^" && title AegisAI Frontend && echo Starting Frontend... && npx vite --config vite.config.ts --host 0.0.0.0"
timeout /t 5 /nobreak > nul
echo       Frontend started.
echo.

:: ── Open browser ──────────────────────────────────────────────
echo ============================================================
echo   All services are running!
echo   Opening browser at: http://localhost:5173
echo ============================================================
echo.
timeout /t 3 /nobreak > nul
start http://localhost:5173

echo.
echo   Login credentials:
echo     Email   : dharshini@aegisai.local
echo     Password: Aegis@1234
echo.
echo   Press any key to close this launcher...
pause > nul
