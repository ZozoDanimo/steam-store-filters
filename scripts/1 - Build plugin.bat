@echo off
cd /d "C:\Steam filters ext"
echo Building plugin...
call npx millennium-ttc --build dev
if %ERRORLEVEL% == 0 (
    echo.
    echo [OK] Build succeeded - press Ctrl+R in Steam to reload
) else (
    echo.
    echo [FAIL] Build failed - check errors above
)
pause
