@echo off
rem Snapping the subject's border (Ben, 3 Nov): Subject only with the background border on the page's colour patches
rem (each patch wholly in or out by its mean map value at 0.5; a patch with 20% or more on each side keeps today's
rem border), C1's map, against C1 as it is (g3s-c1). About 10 minutes, no questions asked.
rem  1 the builder with the snap, a copy of grid3\g3 with ms-snap.zip's three files (grid3\g3 is left as it is)
rem  2 Subject only pages with it, against g3s-c1
rem  3 gathered in subject-snap-results, to copy to the Mac
setlocal
cd /d "%~dp0"
set KIT=%~dp0.
set GRID=%~dp0grid3
set CACHE=%~dp0bench-cache
if not exist "%CACHE%\runs\x0c-TUNE" set CACHE=%~dp0..\bench-cache
set PH=%KIT%\bench-photos
if not exist "%PH%\index.csv" set PH=%~dp0..\bench-photos
where node >nul 2>nul || (echo Node is not installed on this PC any more: tell Claude. & pause & exit /b 1)
if not exist "%GRID%\g3\scripts\bench\pp-bench.mjs" (echo subject-snap.bat must be in ms-subject-train, beside subject-only.bat: tell Claude. & pause & exit /b 1)
findstr /c:"ppSnapBg" "%GRID%\g3snap\index.html" >nul 2>nul || (echo Unzip all of ms-snap.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%CACHE%\runs\g3s-c1\results.json" (echo C1's Subject only run is not in bench-cache: tell Claude. & pause & exit /b 1)
set W=14
set OPT=--cache "%CACHE%" --photos "%PH%" --workers %W%
set LOG=%~dp0subject-snap-log.txt
echo Snap started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"

echo.
echo === 1 of 3: the builder with the snap (a minute)
echo === 1 of 3 %TIME% >> "%LOG%"
rem (only the files g3snap doesn't have yet: ms-snap.zip's three stay)
robocopy "%GRID%\g3" "%GRID%\g3snap" /e /xc /xn /xo /njh /njs /nfl /ndl >nul
findstr /c:"ppSnapBg" "%GRID%\g3snap\index.html" >nul 2>nul || (echo The copy went wrong: tell Claude. & pause & exit /b 1)
findstr /c:"smap: subj" "%GRID%\g3snap\scripts\bench\lib\pp.mjs" >nul 2>nul || (echo The copy went wrong: tell Claude. & pause & exit /b 1)

echo.
echo === 2 of 3: Subject only pages with the snap (about 10 minutes)
echo === 2 of 3 %TIME% >> "%LOG%"
pushd "%GRID%\g3snap"
call :bench %OPT% --set TUNE --modes subject --x lam=0.1,mu=0.25,snap=0.5,sst=0.2 --map subject-te4 --compare g3s-c1 --tag g3s-snap
echo    g3s-snap exit %errorlevel% >> "%LOG%"
popd

echo.
echo === 3 of 3: gathered in subject-snap-results
set OUT=%KIT%\subject-snap-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
if exist "%CACHE%\runs\g3s-snap" robocopy "%CACHE%\runs\g3s-snap" "%OUT%\runs\g3s-snap" /e /xd pics /njh /njs /nfl /ndl >nul
echo Snap finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo All done. Copy subject-snap-results (in ms-subject-train) to the Mac's Claude outputs and tell Claude.
pause
endlocal
exit /b 0

:bench
rem (one bench step; if it doesn't finish it is run once more: it carries on where it stopped)
node scripts\bench\pp-bench.mjs %* >> "%LOG%" 2>&1
if not "%errorlevel%"=="0" (
  echo    ^(exit %errorlevel%: running this step once more^) >> "%LOG%"
  node scripts\bench\pp-bench.mjs %* >> "%LOG%" 2>&1
)
exit /b
