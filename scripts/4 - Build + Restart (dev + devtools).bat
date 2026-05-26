@echo off
cd /d "C:\Steam filters ext"
echo Building plugin...
call npx millennium-ttc --build dev
if %ERRORLEVEL% neq 0 (
    echo.
    echo [FAIL] Build failed - check errors above
    pause
    exit /b 1
)
echo.
echo [OK] Build succeeded! Restarting Steam...
taskkill /f /im steam.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo Starting Steam with DevTools on port 8080...
start "" "C:\Program Files (x86)\Steam\Steam.exe" -dev -cef-enable-debugging -remote-debugging-port=8080
echo.
echo Steam is starting. Open DevTools at: http://localhost:8080
echo (wait ~10 seconds for Steam to fully load before opening DevTools)
pause
