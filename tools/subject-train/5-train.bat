@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist .venv\Scripts\python.exe (echo Run 0-setup.bat first. & pause & exit /b 1)
.venv\Scripts\python.exe s5_train.py
echo.
pause
