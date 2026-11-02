@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
if not exist .venv\Scripts\python.exe (echo Run 0-setup.bat first. & pause & exit /b 1)
.venv\Scripts\python.exe -c "import torchvision" 2>nul || (echo Installing the check detector's library, once... & .venv\Scripts\python.exe -m pip install torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu126 --no-deps || (echo torchvision did not install: tell Claude. & pause & exit /b 1))
.venv\Scripts\python.exe s6_check.py
echo.
pause
