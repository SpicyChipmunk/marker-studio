@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist .venv\Scripts\python.exe (echo Run 0-setup.bat first. & pause & exit /b 1)
rem Round 6: its new photos (the people set and its 24-photo sheet FIRST, the fresh slice, the 640 copies). About 1.5-3 hours, no questions asked.
.venv\Scripts\python.exe s4_round6.py
echo.
pause
