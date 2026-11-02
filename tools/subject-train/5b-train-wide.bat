@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist .venv\Scripts\python.exe (echo Run 0-setup.bat first. & pause & exit /b 1)
rem Round 5: trains the wide run step 6 named in results\next-train.txt (only when the report says NOT FINAL).
.venv\Scripts\python.exe s5_train.py --wide
echo.
pause
