@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title XOA WATERMARK - go logo / chu chim tren anh

rem ============================================================
rem  KEO THA anh (hoac ca thu muc) vao file nay de xoa watermark.
rem  BAM DUP (khong keo tha gi) = xu ly het anh trong WM_CHO\
rem  Anh goc KHONG bi dong vao, ket qua nam trong WM_XONG\
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo   XOA WATERMARK  -  go logo / chu chim tren anh cua ban
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

rem --- 2. Kiem tra numpy + Pillow -------------------------------
%PY% -c "import numpy, PIL" >nul 2>&1
if errorlevel 1 (
    echo [!] Chua co numpy / Pillow, dang cai...
    %PY% -m pip install numpy pillow
    if errorlevel 1 (
        echo [LOI] Cai thu vien that bai. Kiem tra ket noi mang.
        pause
        exit /b 1
    )
    echo.
)

rem --- 3. Hoi vi tri watermark ----------------------------------
echo  Watermark nam o dau?
echo.
echo    [1] Tu dong do          (nen dung - can it nhat 3 anh cung bo)
echo    [2] Goc duoi ben phai
echo    [3] Goc duoi ben trai
echo    [4] Goc tren ben phai
echo    [5] Goc tren ben trai
echo    [6] Ca dai duoi anh
echo    [7] Chinh giua anh
echo    [8] XEM THU - chi ve khung do de soi, khong sua anh
echo.
set "CHON=1"
set /p "CHON=Go so roi bam Enter (mac dinh 1): "

set "THAM_SO=--vung tu-dong"
if "%CHON%"=="2" set "THAM_SO=--vung duoi-phai"
if "%CHON%"=="3" set "THAM_SO=--vung duoi-trai"
if "%CHON%"=="4" set "THAM_SO=--vung tren-phai"
if "%CHON%"=="5" set "THAM_SO=--vung tren-trai"
if "%CHON%"=="6" set "THAM_SO=--vung duoi"
if "%CHON%"=="7" set "THAM_SO=--vung giua"
if "%CHON%"=="8" set "THAM_SO=--vung tu-dong --xem-thu"

rem --- 4. Watermark la chu trang? -------------------------------
if not "%CHON%"=="8" (
    echo.
    echo  Watermark la CHU TRANG / xam mo tren nen anh?
    echo    Chon C = chi va dung net chu, phan nen giu nguyen ^(dep hon^)
    echo    Chon K = va ca o vuong ^(chac an hon khi logo nhieu mau^)
    set "NET=K"
    set /p "NET=Go C hoac K roi bam Enter (mac dinh K): "
    if /i "!NET!"=="C" set "THAM_SO=!THAM_SO! --loc-mau sang --no-rong 3"
)

echo.

set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

rem --- 5. Chay ---------------------------------------------------
if "%~1"=="" (
    echo [*] Khong co file keo tha -^> xu ly het anh trong WM_CHO\
    echo.
    %PY% xoa_watermark.py %THAM_SO%
) else (
    echo [*] Xu ly cac muc duoc keo tha:
    set "DS="
    for %%F in (%*) do (
        echo     - %%~nxF
        set DS=!DS! "%%~fF"
    )
    echo.
    %PY% xoa_watermark.py !DS! %THAM_SO%
)

set "MA=%ERRORLEVEL%"
echo.
echo ============================================================
if "%MA%"=="0" (
    if "%CHON%"=="8" (
        echo   DA VE KHUNG DO. Mo WM_XONG\ xem file *_xem_truoc.png
        echo   Neu khung chua trum dung watermark, chay lai va chon goc khac.
    ) else (
        echo   XONG HET. Anh sach nam trong  WM_XONG\
        echo   Anh goc van con nguyen, khong bi dong vao.
    )
) else if "%MA%"=="1" (
    echo   XONG NHUNG CON FILE HONG. Xem dong [LOI] o tren.
) else (
    echo   CO LOI ^(ma %MA%^). Xem chi tiet trong thu muc logs\
)
echo ============================================================
echo.

pause
endlocal
exit /b %MA%
