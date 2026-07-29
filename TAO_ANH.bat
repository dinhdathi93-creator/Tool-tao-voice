@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title TAO ANH - Gemini + Pollinations

rem ============================================================
rem  KEO THA file .txt (hoac ca thu muc) vao file nay de chay ngay.
rem  BAM DUP (khong keo tha gi) = chay het hang doi trong PROMPT_CHO
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo   TAO ANH  -  tao anh AI hang loat cho 5 kenh
echo   Thu muc: %CD%
echo ============================================================
echo.

rem --- 1. Tim Python -------------------------------------------
set "PY="
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
if not defined PY ( where py >nul 2>&1 && set "PY=py -3" )
if not defined PY ( where python >nul 2>&1 && set "PY=python" )

if not defined PY (
    echo [LOI] Khong tim thay Python tren may.
    echo       Cai Python 3.11 tai https://www.python.org/downloads/
    echo       Nho tich o "Add python.exe to PATH" luc cai.
    echo.
    pause
    exit /b 1
)

rem --- 2. Kiem tra Pillow (de ep anh ve 1920x1080) --------------
%PY% -c "import PIL" >nul 2>&1
if errorlevel 1 (
    echo [!] Chua co thu vien Pillow, dang cai...
    %PY% -m pip install pillow
    if errorlevel 1 (
        echo [LOI] Cai Pillow that bai. Kiem tra ket noi mang.
        pause
        exit /b 1
    )
    echo.
)

rem --- 3. Chay ---------------------------------------------------
rem  Chua co config.json thi tao_anh.py tu tao roi huong dan, khong chay tiep.

set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

rem --- 4. Goi python ---------------------------------------------
if "%~1"=="" (
    echo [*] Khong co file keo tha -^> chay het hang doi trong PROMPT_CHO\
    echo.
    %PY% tao_anh.py
) else (
    echo [*] Chay cac muc duoc keo tha:
    set "DS="
    for %%F in (%*) do (
        echo     - %%~nxF
        set DS=!DS! "%%~fF"
    )
    echo.
    %PY% tao_anh.py !DS!
)

set "MA=%ERRORLEVEL%"
echo.
echo ============================================================
if "%MA%"=="0" (
    echo   XONG HET. Anh da luu vao thu muc cua tung kenh.
) else if "%MA%"=="1" (
    echo   XONG NHUNG CON ANH HONG.
    echo   Mo PROMPT_CHO\loi_*.txt, tha lai vao file .bat nay de chay bu.
) else (
    echo   CO LOI ^(ma %MA%^). Xem chi tiet trong thu muc logs\
)
echo ============================================================
echo.

pause
endlocal
exit /b %MA%
