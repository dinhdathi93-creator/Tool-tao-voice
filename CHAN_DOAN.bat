@echo off
chcp 65001 >nul 2>&1
title Chan doan TAO VOICE
cd /d "%~dp0"
set "PY="
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
if not defined PY ( where py >nul 2>&1 && set "PY=py -3" )
if not defined PY ( where python >nul 2>&1 && set "PY=python" )
if not defined PY ( echo [LOI] Khong tim thay Python. & pause & exit /b 1 )
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
%PY% tao_voice.py --chan-doan
echo.
pause
