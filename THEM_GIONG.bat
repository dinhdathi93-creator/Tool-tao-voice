@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title THEM GIONG MAU - clone giong

rem ============================================================
rem  KEO THA mot file am thanh (wav/mp3/m4a/flac) vao file nay
rem  de nap thanh giong mau cho mot kenh.
rem  Moi thu chay tren may, khong gui file di dau ca.
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo   THEM GIONG MAU  -  clone giong cho mot kenh
echo ============================================================
echo.

rem --- 1. Tim Python -------------------------------------------
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

rem --- 2. File am thanh ----------------------------------------
set "NGUON=%~1"
if "%NGUON%"=="" (
    echo Keo tha file am thanh vao day roi Enter
    echo   ^(hoac go duong dan day du^):
    set /p "NGUON=> "
)
rem bo dau nhay kep neu nguoi dung dan duong dan co nhay
set "NGUON=%NGUON:"=%"

if not exist "%NGUON%" (
    echo.
    echo [LOI] Khong thay file: %NGUON%
    echo.
    pause
    exit /b 1
)

echo.
echo File giong mau: %NGUON%
echo.

rem --- 3. Ten kenh ---------------------------------------------
echo Ten kenh la phan dau ten file kich ban.
echo   vi du kenh TERCO1  ^<-  KB_CHO\TERCO1_video01.txt
echo.
set "KENH="
set /p "KENH=Ten kenh (chu va so, khong dau): "
if "%KENH%"=="" (
    echo [LOI] Chua nhap ten kenh.
    pause
    exit /b 1
)

rem --- 4. Ngon ngu / model -------------------------------------
echo.
echo Kenh nay noi tieng gi?
echo    1. English      (english)
echo    2. Portuguese   (portuguese)
echo    3. Spanish      (spanish)
echo    4. Italian      (italian)
echo    5. German       (german)
echo    6. Go tay ten model khac
echo.
choice /c 123456 /n /m "Chon (1-6): "
set "MODEL="
if errorlevel 6 ( set /p "MODEL=Ten model: " ) else (
if errorlevel 5 ( set "MODEL=german" ) else (
if errorlevel 4 ( set "MODEL=italian" ) else (
if errorlevel 3 ( set "MODEL=spanish" ) else (
if errorlevel 2 ( set "MODEL=portuguese" ) else (
                  set "MODEL=english" )))))

echo.
echo ------------------------------------------------------------
echo   Kenh : %KENH%
echo   Model: %MODEL%
echo ------------------------------------------------------------
echo.

rem --- 5. Nap ---------------------------------------------------
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

%PY% tao_voice.py --them-giong "%NGUON%" --kenh "%KENH%" --model "%MODEL%"
set "MA=%ERRORLEVEL%"

echo.
echo ============================================================
if not "%MA%"=="0" (
    echo   NAP KHONG THANH CONG ^(ma %MA%^). Doc phan [LOI] o tren.
    echo ============================================================
    echo.
    pause
    exit /b %MA%
)

echo   XONG. Giong da luu o voices\%KENH%.wav
echo   channels.json da duoc cap nhat.
echo ============================================================
echo.

rem --- 6. Mo ban doc thu de nghe --------------------------------
set "THU=XONG\_THU_GIONG\%KENH%_thu.wav"
if exist "%THU%" (
    echo Dang mo ban doc thu de ban nghe...
    start "" "%THU%"
) else (
    echo ^(Khong co ban doc thu - xem canh bao o tren.^)
)

echo.
echo Buoc tiep theo: bo kich ban %KENH%_*.txt vao KB_CHO\
echo roi chay TAO_VOICE.bat
echo.
pause
endlocal
exit /b 0
