@echo off
rem X3c at strengths 27 and 81, stage A2 (Ben, 3 Nov): about 40 min, no questions asked.
rem  Stage A's scores rose at every strength (1, 3, 9), so two more on the same 60-photo sample, as stage A ran them;
rem  the strength then chosen again of all five by the same rule (the range stops at 81). Needs stage A's results in
rem  bench-cache. Then gathered in x3a2-results, to copy to the Mac. Stage B (x3-stage-b.bat) after this.
setlocal
cd /d "%~dp0"
set KIT=%~dp0.
set PY=%KIT%\.venv\Scripts\python.exe
set GRID=%~dp0grid3
set CACHE=%~dp0bench-cache
if not exist "%CACHE%\runs\x0c-TUNE" set CACHE=%~dp0..\bench-cache
set PH=%KIT%\bench-photos
if not exist "%PH%\index.csv" set PH=%~dp0..\bench-photos
where node >nul 2>nul || (echo Node is not installed on this PC any more: tell Claude. & pause & exit /b 1)
if not exist "%PY%" (echo x3-stage-a2.bat must be in ms-subject-train, beside .venv: tell Claude. & pause & exit /b 1)
findstr /c:"CANDS2" "%GRID%\x3\scripts\bench\x3_stage.py" >nul 2>nul || (echo Unzip all of ms-x3a2.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%CACHE%\runs\x3-settings.json" (echo Stage A's results are not in bench-cache: run x3-stage-a.bat first. & pause & exit /b 1)
if not exist "%CACHE%\runs\x3-base60\results.json" (echo Stage A's results are not in bench-cache: run x3-stage-a.bat first. & pause & exit /b 1)
set LOG=%~dp0x3a2-log.txt
set PYTHONUTF8=1
echo X3 stage A2 started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"
copy /y "%CACHE%\runs\x3-settings.json" "%CACHE%\runs\x3-settings-stage-a.json" >nul
pushd "%GRID%\x3"
"%PY%" -I scripts\bench\x3_stage.py A2 "%CACHE%" "%PH%" 14 "%LOG%"
echo    stage A2 exit %errorlevel% >> "%LOG%"
popd
set OUT=%KIT%\x3a2-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
for %%T in (x3-x3c27-r60 x3-x3c27-c60 x3-x3c81-r60 x3-x3c81-c60) do if exist "%CACHE%\runs\%%T" robocopy "%CACHE%\runs\%%T" "%OUT%\runs\%%T" /e /njh /njs /nfl /ndl >nul
copy /y "%CACHE%\runs\x3-settings.json" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\x3-settings-stage-a.json" "%OUT%\" >nul 2>nul
echo X3 stage A2 finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo All done. Copy x3a2-results (in ms-subject-train) to the Mac's Claude outputs and tell Claude.
pause
endlocal
exit /b 0
