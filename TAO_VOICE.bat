@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title TAO VOICE - pocket-tts (CPU)

rem ============================================================
rem  KEO THA file .txt hoac thu muc vao file nay de chay ngay.
rem  BAM DUP (khong keo tha gi) = chay het hang doi trong KB_CHO
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo   TAO VOICE  -  doc kich ban .txt thanh WAV + SRT
echo   Thu muc: %CD%
echo ============================================================
echo.

rem --- 1. Tim Python: uu tien .venv trong thu muc tool ---------
set "PY="
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"

if not defined PY (
    where py >nul 2>&1 && set "PY=py -3"
)
if not defined PY (
    where python >nul 2>&1 && set "PY=python"
)

if not defined PY (
    echo [LOI] Khong tim thay Python tren may.
    echo       Cai Python 3.11 tai https://www.python.org/downloads/
    echo       Nho tich o "Add python.exe to PATH" luc cai.
    echo.
    pause
    exit /b 1
)

rem --- 2. Kiem tra thu vien -----------------------------------
%PY% -c "import pocket_tts" >nul 2>&1
if errorlevel 1 (
    echo [!] Chua cai thu vien pocket-tts.
    echo     Chay CAI_DAT.bat truoc ^(chi can 1 lan^).
    echo.
    choice /c YN /m "Cai ngay bay gio"
    if errorlevel 2 ( exit /b 1 )
    call "%~dp0CAI_DAT.bat" /nopause
    if errorlevel 1 ( pause & exit /b 1 )
)

rem --- 3. Chay: co keo tha thi chay dung file/thu muc do -------
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

if "%~1"=="" (
    echo [*] Khong co file keo tha -^> chay het hang doi trong KB_CHO\
    echo.
    %PY% tao_voice.py
) else (
    echo [*] Chay cac muc duoc keo tha:
    set "DS="
    for %%F in (%*) do (
        echo     - %%~nxF
        set DS=!DS! "%%~fF"
    )
    echo.
    %PY% tao_voice.py !DS!
)

set "MA=%ERRORLEVEL%"
echo.
echo ============================================================
if "%MA%"=="0" (
    echo   XONG. Ket qua nam trong thu muc XONG\
) else (
    echo   CO LOI ^(ma %MA%^). Xem chi tiet trong thu muc logs\
)
echo ============================================================
echo.

rem Mo thu muc ket qua cho tien
if "%MA%"=="0" if exist "XONG" start "" explorer "%CD%\XONG"

pause
endlocal
exit /b %MA%
