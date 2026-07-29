@echo off
chcp 65001 >nul 2>&1
title CAI DAT TAO VOICE

rem ============================================================
rem  Cai dat 1 lan: tao .venv rieng + cai torch CPU, pocket-tts,
rem  faster-whisper. Khong dung GPU, khong dung API.
rem ============================================================

cd /d "%~dp0"

echo ============================================================
echo   CAI DAT TAO VOICE  (CPU-only, khong can card do hoa)
echo ============================================================
echo.

set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY ( where python >nul 2>&1 && set "PY=python" )

if not defined PY (
    echo [LOI] Chua co Python. Tai ban 3.11 tai:
    echo       https://www.python.org/downloads/release/python-3119/
    echo       Luc cai NHO TICH o "Add python.exe to PATH".
    echo.
    pause
    exit /b 1
)

echo [1/4] Tao moi truong rieng .venv ...
if not exist ".venv\Scripts\python.exe" (
    %PY% -m venv .venv
    if errorlevel 1 (
        echo [LOI] Khong tao duoc .venv.
        pause
        exit /b 1
    )
)
set "VPY=.venv\Scripts\python.exe"

echo [2/4] Nang cap pip ...
"%VPY%" -m pip install --upgrade pip wheel --quiet

echo [3/4] Cai PyTorch ban CPU (nang, doi vai phut) ...
"%VPY%" -m pip install torch --index-url https://download.pytorch.org/whl/cpu
if errorlevel 1 (
    echo [LOI] Cai torch that bai. Kiem tra ket noi mang roi chay lai.
    pause
    exit /b 1
)

echo [4/4] Cai pocket-tts + faster-whisper ...
"%VPY%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo [LOI] Cai thu vien that bai.
    pause
    exit /b 1
)

echo.
echo [*] Kiem tra lai ...
"%VPY%" -c "import torch, pocket_tts, faster_whisper; print('   torch', torch.__version__, '| pocket-tts OK | faster-whisper OK')"
if errorlevel 1 (
    echo [LOI] Thu vien cai chua day du.
    pause
    exit /b 1
)

"%VPY%" tao_voice.py --tu-kiem-tra
echo.
echo ============================================================
echo   CAI DAT XONG.
echo   Buoc tiep theo:
echo     1. Bo file giong mau vao thu muc  voices\
echo        (WAV 16-bit mono, 10-30 giay, dat ten theo kenh:
echo         TERCO1.wav, GODSAYS.wav ...)
echo     2. Sua channels.json cho khop ten kenh + model
echo     3. Bo kich ban .txt vao  KB_CHO\  roi chay TAO_VOICE.bat
echo ============================================================
echo.

if /i not "%~1"=="/nopause" pause
exit /b 0
