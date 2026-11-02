@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist .venv\Scripts\python.exe (echo Run 0-setup.bat first. & pause & exit /b 1)
rem The photo-to-page bench photos (only when Claude asks): about 900 Open Images photos and their outlines.
.venv\Scripts\python.exe bench_photos.py
echo.
pause
