@echo off
cd /d "%~dp0"
set PYTHONUTF8=1
where py >nul 2>nul || (echo Python is not installed: see README.md, step 1. & pause & exit /b 1)
if not exist .venv\Scripts\python.exe (
  echo Making a private Python environment in this folder...
  py -3.12 -m venv .venv || (echo Could not: is Python 3.12 installed? See README.md, step 1. & pause & exit /b 1)
)
.venv\Scripts\python.exe -m pip install --upgrade pip
echo Installing PyTorch for NVIDIA cards (about 2.5 GB)...
.venv\Scripts\python.exe -m pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cu126 || (echo PyTorch did not install: see README.md, If something goes wrong. & pause & exit /b 1)
.venv\Scripts\python.exe -m pip install -r requirements.txt || (echo A package did not install: see README.md, If something goes wrong. & pause & exit /b 1)
echo Installing the check detector's library (torchvision, for step 6)...
.venv\Scripts\python.exe -m pip install torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu126 --no-deps || (echo torchvision did not install: see README.md, If something goes wrong. & pause & exit /b 1)
echo.
echo Setup done. Next: 1-check.bat
pause
