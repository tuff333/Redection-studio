@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================
echo Redactio - Local Runner
echo ==========================================

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if npm is installed
npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm is not installed.
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo Error: Failed to install dependencies.
    pause
    exit /b 1
)

echo [2/3] Preparing environment...
if not exist .env (
    if exist .env.example (
        echo Creating .env from .env.example...
        copy .env.example .env
    ) else (
        echo Warning: .env.example not found. Creating empty .env...
        echo # Local Environment > .env
    )
)

echo [3/3] Starting server and opening browser...
:: Start the browser in a separate process
:: We use http://localhost:3000 as configured in server.ts
start http://localhost:3000

:: Start the application
echo Application is starting on http://localhost:3000
npm run dev

pause
