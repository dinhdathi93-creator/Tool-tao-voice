@echo off
chcp 65001 >nul 2>&1
title TAO VOICE - giao dien web

rem ============================================================
rem  Bam dup file nay roi mo trinh duyet vao http://localhost:8777
rem  Moi thu chay tren may ban, khong gui gi len mang.
rem  Dong cua so den nay la tat giao dien.
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo   TAO VOICE - giao dien web
echo ============================================================
echo.

set "PY="
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
if not defined PY ( where py >nul 2>&1 && set "PY=py -3" )
if not defined PY ( where python >nul 2>&1 && set "PY=python" )

if not defined PY (
    echo [LOI] Khong tim thay Python. Chay CAI_DAT.bat truoc.
    echo.
    pause
    exit /b 1
)

%PY% -c "import pocket_tts, fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
    echo [LOI] Thieu thu vien. Chay CAI_DAT.bat truoc ^(chi can 1 lan^).
    echo.
    pause
    exit /b 1
)

set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

echo [*] Dang khoi dong... trinh duyet se tu mo sau 3 giay.
echo     Neu khong tu mo, go vao trinh duyet:  http://localhost:8777
echo.

start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:8777"

%PY% tao_voice_web.py

echo.
echo Da tat giao dien.
pause
