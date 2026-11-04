@echo off
rem Tonight's PC run (Ben, 3 Nov): about 7 h 20, no questions asked.
rem  1 Stage A2 (X3c at 27 and 81): not run again when x3-stage-a2.bat has run it (X3c 81 chosen).
rem  2 Stage B, only if 1 finished: all of TUNE against X2 (C1's maps): X3b and X3c with their sections matched
rem    (judged) and as they are (reported), X3c at 9 too (section-matched), X3d on Simpler background (about 3 h),
rem    and which X3c goes forward, 9 or 81 (the rule fixed first); then both pictured on the sample's 12 photos for
rem    go / no-go sheets, as X3b was, and X3c at 5 and 7 on the sample, for information (about 1 h).
rem  3 Stage C: sections more regular and easier to colour: smoother outlines (C8) and a wider thin-parts rule, each
rem    alone and together, on the sample, then on all of TUNE against X2, and their verdict (about 3 h).
rem  4 For the release's checklist: how many photos of each set have C1's map in the cache (file counts only).
rem  Then gathered in x3night-results, to copy to the Mac.
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
if not exist "%PY%" (echo x3-overnight.bat must be in ms-subject-train, beside .venv: tell Claude. & pause & exit /b 1)
if not exist "%GRID%\x3\scripts\bench\x3c_pick.py" (echo Unzip all of ms-x3night.zip over ms-subject-train first. & pause & exit /b 1)
findstr /c:"x3c7" "%GRID%\x3\scripts\bench\x3_stage.py" >nul 2>nul || (echo Unzip all of ms-x3night.zip over ms-subject-train first. & pause & exit /b 1)
findstr /c:"CL_C8" "%GRID%\x3\scripts\bench\x3_stage.py" >nul 2>nul || (echo Unzip all of ms-x3night.zip over ms-subject-train first. & pause & exit /b 1)
findstr /c:"ppSmoothRegions" "%GRID%\x3\index.html" >nul 2>nul || (echo Unzip all of ms-x3night.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%GRID%\x3\scripts\bench\cl_judge.py" (echo Unzip all of ms-x3night.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%GRID%\x3\scripts\bench\x3_mapcount.py" (echo Unzip all of ms-x3night.zip over ms-subject-train first. & pause & exit /b 1)
findstr /c:"ppSidePairs" "%GRID%\x3\index.html" >nul 2>nul || (echo grid3\x3 is not X3's builder: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\g3-X2\results.json" (echo X2's TUNE run is not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\maps\subject-te4\model.json" (echo C1's maps are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\x3-settings.json" (echo Stage A's results are not in bench-cache: run x3-stage-a.bat first. & pause & exit /b 1)
if not exist "%CACHE%\runs\x3-base60\results.json" (echo Stage A's results are not in bench-cache: run x3-stage-a.bat first. & pause & exit /b 1)
set LOG=%~dp0x3night-log.txt
set PYTHONUTF8=1
echo X3 tonight started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"
echo === 1 of 4: stage A2, X3c at 27 and 81 (skipped when run already)
if not exist "%CACHE%\runs\x3-settings-stage-a.json" copy /y "%CACHE%\runs\x3-settings.json" "%CACHE%\runs\x3-settings-stage-a.json" >nul
pushd "%GRID%\x3"
"%PY%" -I scripts\bench\x3_stage.py A2 "%CACHE%" "%PH%" 14 "%LOG%"
set A2=%errorlevel%
echo    stage A2 exit %A2% >> "%LOG%"
if not "%A2%"=="0" goto noB
echo === 2 of 4: stage B, all of TUNE, then the pictures (about 4 h)
"%PY%" -I scripts\bench\x3_stage.py B "%CACHE%" "%PH%" 14 "%LOG%"
echo    stage B exit %errorlevel% >> "%LOG%"
"%PY%" -I scripts\bench\x3c_pick.py "%CACHE%" >> "%LOG%" 2>&1
"%PY%" -I scripts\bench\x3_stage.py P "%CACHE%" "%PH%" 14 "%LOG%"
echo    stage P exit %errorlevel% >> "%LOG%"
goto counts
:noB
echo    stage A2 did not finish, so stage B was not run (stage C runs all the same): tell Claude >> "%LOG%"
:counts
echo === 3 of 4: stage C, sections easier to colour (about 3 h)
"%PY%" -I scripts\bench\x3_stage.py C "%CACHE%" "%PH%" 14 "%LOG%"
echo    stage C exit %errorlevel% >> "%LOG%"
"%PY%" -I scripts\bench\cl_judge.py "%CACHE%" >> "%LOG%" 2>&1
echo === 4 of 4: C1's maps in the cache (file counts)
"%PY%" -I scripts\bench\x3_mapcount.py "%CACHE%" "%PH%" >> "%LOG%" 2>&1
popd
set OUT=%KIT%\x3night-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
for %%R in (x3-x3c27-r60 x3-x3c27-c60 x3-x3c81-r60 x3-x3c81-c60 x3-x3c-p60 x3-x3c9-p60 x3-x3c5-r60 x3-x3c5-c60 x3-x3c7-r60 x3-x3c7-c60) do if exist "%CACHE%\runs\%%R" robocopy "%CACHE%\runs\%%R" "%OUT%\runs\%%R" /e /njh /njs /nfl /ndl >nul
for %%R in (x3b-TUNE x3b-raw-TUNE x3c-TUNE x3c-raw-TUNE x3c9-TUNE x3d-TUNE) do if exist "%CACHE%\runs\%%R" robocopy "%CACHE%\runs\%%R" "%OUT%\runs\%%R" /e /xd pics /njh /njs /nfl /ndl >nul
rem (X2's TUNE run, the baseline of stages B and C, for Claude's own checks of the verdicts)
robocopy "%CACHE%\runs\g3-X2" "%OUT%\runs\g3-X2" /e /xd pics /njh /njs /nfl /ndl >nul
for /d %%R in ("%CACHE%\runs\cl-*") do robocopy "%%R" "%OUT%\runs\%%~nxR" /e /njh /njs /nfl /ndl >nul
copy /y "%CACHE%\runs\x3c-pick.md" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\cl-settings.json" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\cl-verdict.md" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\cl-verdict.json" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\x3-settings.json" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\x3-settings-stage-a.json" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\LOG.md" "%OUT%\runs\" >nul 2>nul
echo X3 tonight finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo All done. Copy x3night-results (in ms-subject-train) to the Mac's Claude outputs and tell Claude.
pause
endlocal
exit /b 0
