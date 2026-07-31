@echo off
chcp 65001 >nul 2>&1
title Nap token HuggingFace

rem ============================================================
rem  Mo khoa model clone giong. Chi can lam 1 lan.
rem  Token duoc go rieng o day nen khong loi ra lich su lenh.
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo   NAP TOKEN HUGGINGFACE  -  de clone duoc giong rieng
echo ============================================================
echo.
echo Chua lam 3 buoc nay thi lam truoc da:
echo.
echo   1. Tao tai khoan mien phi:  https://huggingface.co/join
echo   2. Vao  https://huggingface.co/kyutai/pocket-tts
echo      dang nhap roi bam nut dong y dieu khoan
echo   3. Tao token:  https://huggingface.co/settings/tokens
echo      bam "New token", chon loai "Read", roi Copy
echo.
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

set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

%PY% tao_voice.py --hf-token

echo.
pause
