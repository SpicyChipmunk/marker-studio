@echo off
rem Subject only on the bench (Ben, 3 Nov): which subject map, if any, makes better Subject only pages with the builder
rem that ships (X2+cap)? About 1 h 30, no questions asked. Then everything gathered in subject-results.
rem  1 the best-case map (the bench outlines themselves) for the TUNE photos, and each map's overlap at several cuts
rem  2 Subject only pages with C1's maps (the baseline), then the best case (snapped and not), A3, E5-kd-mix, E6-mix,
rem    E5-kd-mix unsnapped, and C1 unsnapped (the yardstick), each against the baseline
rem  3 gathered in subject-results, to copy to the Mac
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
if not exist "%PY%" (echo subject-only.bat must be in ms-subject-train, beside .venv: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\maps\subject-e5kd\model.json" (echo The kd models' maps are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\maps\subject-a3\model.json" (echo A3's maps are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\maps\subject-e6mix\model.json" (echo E6-mix's maps are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\maps\subject-te4\model.json" (echo C1's maps are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%GRID%\g3\scripts\bench\pp_oracle.py" (echo Unzip all of ms-subject-only.zip over ms-subject-train first. & pause & exit /b 1)
findstr /c:"subjRefused" "%GRID%\g3\scripts\bench\pp-bench.mjs" >nul 2>nul || (echo Unzip all of ms-subject-only.zip over ms-subject-train first. & pause & exit /b 1)
set W=14
set OPT=--cache "%CACHE%" --photos "%PH%" --workers %W%
set SUB=--set TUNE --modes subject --x lam=0.1,mu=0.25
set LOG=%~dp0subject-log.txt
set PYTHONUTF8=1
echo Subject only started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"
pushd "%GRID%\g3"

echo.
echo === 1 of 3: the best-case map, and each map's overlap at several cuts (a few minutes)
echo === 1 of 3 %TIME% >> "%LOG%"
"%PY%" -I scripts\bench\pp_oracle.py "%CACHE%" --tag oracle --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
if not "%errorlevel%"=="0" "%PY%" -I scripts\bench\pp_oracle.py "%CACHE%" --tag oracle --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
set MO=%errorlevel%
echo    oracle maps exit %MO% >> "%LOG%"
"%PY%" -I scripts\bench\pp_cuts.py "%CACHE%" "%PH%" "%~dp0subject-cuts.json" oracle subject-te4 subject-a3 subject-e5kd subject-e6mix >> "%LOG%" 2>&1
echo    cuts exit %errorlevel% >> "%LOG%"

echo.
echo === 2 of 3: Subject only pages, the baseline then seven maps (about 1 h 20)
echo === 2 of 3 %TIME% >> "%LOG%"
call :bench %OPT% %SUB% --map subject-te4 --tag g3s-c1
echo    g3s-c1 exit %errorlevel% >> "%LOG%"
if "%MO%"=="0" call :bench %OPT% %SUB% --map oracle --gf 0 --compare g3s-c1 --map-compare --tag g3s-oracle
if "%MO%"=="0" call :bench %OPT% %SUB% --map oracle --compare g3s-c1 --map-compare --tag g3s-oracle-snapped
call :bench %OPT% %SUB% --map subject-a3 --compare g3s-c1 --map-compare --tag g3s-a3
call :bench %OPT% %SUB% --map subject-e5kd --compare g3s-c1 --map-compare --tag g3s-e5kd
call :bench %OPT% %SUB% --map subject-e6mix --compare g3s-c1 --map-compare --tag g3s-e6mix
call :bench %OPT% %SUB% --map subject-e5kd --gf 0 --compare g3s-c1 --map-compare --tag g3s-e5kd-gf0
call :bench %OPT% %SUB% --map subject-te4 --gf 0 --compare g3s-c1 --map-compare --tag g3s-c1-gf0
popd

echo.
echo === 3 of 3: gathered in subject-results
set OUT=%KIT%\subject-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
for %%R in (g3s-c1 g3s-oracle g3s-oracle-snapped g3s-a3 g3s-e5kd g3s-e6mix g3s-e5kd-gf0 g3s-c1-gf0) do if exist "%CACHE%\runs\%%R" robocopy "%CACHE%\runs\%%R" "%OUT%\runs\%%R" /e /xd pics /njh /njs /nfl /ndl >nul
copy /y "%CACHE%\runs\LOG.md" "%OUT%\runs\" >nul 2>nul
copy /y "%~dp0subject-cuts.json" "%OUT%\" >nul 2>nul
echo Subject only finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo All done. Copy subject-results (in ms-subject-train) to the Mac's Claude outputs and tell Claude.
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
