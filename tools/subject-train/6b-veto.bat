@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist .venv\Scripts\python.exe (echo Run 0-setup.bat first. & pause & exit /b 1)
rem Round 5: only if Claude says so, after the iPad test build. Vetoes a candidate path (C1 or C2), then reruns step 6.
set /p V=Type the path you veto (C1 or C2) and press Enter: 
if /i not "%V%"=="C1" if /i not "%V%"=="C2" (echo Only C1 or C2. Nothing changed. & pause & exit /b 1)
>>work\veto.txt echo %V%
.venv\Scripts\python.exe s6_check.py
echo.
pause
