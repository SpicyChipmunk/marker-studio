@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist .venv\Scripts\python.exe (echo Run 0-setup.bat first. & pause & exit /b 1)
rem Decision 104: is a bigger model better for our photos? (stock TE5, TE6, TE7 and TE4 at larger inputs; about an hour)
.venv\Scripts\python.exe s1e_bigger.py
echo.
pause
