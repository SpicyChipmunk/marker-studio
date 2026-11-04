@echo off
rem E4kd on Subject only (Ben, 3 Nov): C1's network (TE4, the same speed) trained the kd way. Does it make better
rem Subject only pages than C1 with the builder that ships (X2+cap)? About 10 minutes, no questions asked.
rem  1 Subject only pages with E4kd's maps, against C1's (g3s-c1, made by subject-only.bat)
rem  2 gathered in subject-e4kd-results, to copy to the Mac
setlocal
cd /d "%~dp0"
set KIT=%~dp0.
set GRID=%~dp0grid3
set CACHE=%~dp0bench-cache
if not exist "%CACHE%\runs\x0c-TUNE" set CACHE=%~dp0..\bench-cache
set PH=%KIT%\bench-photos
if not exist "%PH%\index.csv" set PH=%~dp0..\bench-photos
where node >nul 2>nul || (echo Node is not installed on this PC any more: tell Claude. & pause & exit /b 1)
if not exist "%GRID%\g3\scripts\bench\pp-bench.mjs" (echo subject-e4kd.bat must be in ms-subject-train, beside subject-only.bat: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\maps\subject-e4kd\model.json" (echo E4kd's maps are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\g3s-c1\results.json" (echo C1's Subject only run is not in bench-cache: tell Claude. & pause & exit /b 1)
set W=14
set OPT=--cache "%CACHE%" --photos "%PH%" --workers %W%
set SUB=--set TUNE --modes subject --x lam=0.1,mu=0.25
set LOG=%~dp0subject-e4kd-log.txt
echo E4kd Subject only started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"
pushd "%GRID%\g3"

echo.
echo === 1 of 2: Subject only pages with E4kd's maps (about 10 minutes)
echo === 1 of 2 %TIME% >> "%LOG%"
call :bench %OPT% %SUB% --map subject-e4kd --compare g3s-c1 --map-compare --tag g3s-e4kd
echo    g3s-e4kd exit %errorlevel% >> "%LOG%"
popd

echo.
echo === 2 of 2: gathered in subject-e4kd-results
set OUT=%KIT%\subject-e4kd-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
if exist "%CACHE%\runs\g3s-e4kd" robocopy "%CACHE%\runs\g3s-e4kd" "%OUT%\runs\g3s-e4kd" /e /xd pics /njh /njs /nfl /ndl >nul
echo E4kd Subject only finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo All done. Copy subject-e4kd-results (in ms-subject-train) to the Mac's Claude outputs and tell Claude.
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
