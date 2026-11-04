@echo off
rem X3b, X3c and X3d, stage A (Ben, 3 Nov): about 1 h 10, no questions asked.
rem  On a fixed sample of 60 TUNE photos: today's pages (X2, C1's maps), then X3b (the subject's line) and X3c (the
rem  subject-aware merge, at three strengths), each as it is and with its sections matched to today's; X3c's strength
rem  chosen; pictures of 12 photos for Ben's go / no-go sheet. Then gathered in x3a-results, to copy to the Mac.
rem  Stage B (all of TUNE) is x3-stage-b.bat, after Ben has seen the sheet.
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
if not exist "%PY%" (echo x3-stage-a.bat must be in ms-subject-train, beside .venv: tell Claude. & pause & exit /b 1)
if not exist "%GRID%\x3\scripts\bench\x3_stage.py" (echo Unzip all of ms-x3.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%GRID%\g3\scripts\bench\pp-bench.mjs" (echo grid3\g3 is missing: tell Claude. & pause & exit /b 1)
rem (X3's builder: a copy of grid3\g3 with ms-x3.zip's files; only the files grid3\x3 doesn't have yet are copied)
robocopy "%GRID%\g3" "%GRID%\x3" /e /xc /xn /xo /njh /njs /nfl /ndl >nul
findstr /c:"ppSidePairs" "%GRID%\x3\index.html" >nul 2>nul || (echo The copy went wrong: tell Claude. & pause & exit /b 1)
findstr /c:"focusBgm" "%GRID%\x3\scripts\bench\lib\pp.mjs" >nul 2>nul || (echo The copy went wrong: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\g3-X2\results.json" (echo X2's TUNE run is not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\maps\subject-te4\model.json" (echo C1's maps are not in bench-cache: tell Claude. & pause & exit /b 1)
set LOG=%~dp0x3a-log.txt
set PYTHONUTF8=1
echo X3 stage A started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"
pushd "%GRID%\x3"
"%PY%" -I scripts\bench\x3_stage.py A "%CACHE%" "%PH%" 14 "%LOG%"
echo    stage A exit %errorlevel% >> "%LOG%"
popd
set OUT=%KIT%\x3a-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
for /d %%R in ("%CACHE%\runs\x3-*") do robocopy "%%R" "%OUT%\runs\%%~nxR" /e /njh /njs /nfl /ndl >nul
copy /y "%CACHE%\runs\x3-settings.json" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\LOG.md" "%OUT%\runs\" >nul 2>nul
echo X3 stage A finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo All done. Copy x3a-results (in ms-subject-train) to the Mac's Claude outputs and tell Claude.
pause
endlocal
exit /b 0
