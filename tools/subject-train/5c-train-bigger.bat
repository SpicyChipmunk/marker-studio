@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist .venv\Scripts\python.exe (echo Run 0-setup.bat first. & pause & exit /b 1)
rem Decision 106: C1's recipe on TE5 (D5), then TE6 (D6), each measured beside C1 (it fetches their weights if needed). Hours: D5 about 5, D6 about 9.
rem Only one of them: 5c-train-bigger.bat D6
set R=%1
if "%R%"=="" set R=D5,D6
.venv\Scripts\python.exe s5_train.py --run %R%
echo.
pause
