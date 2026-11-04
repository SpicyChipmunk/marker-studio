@echo off
rem The two control checks (Ben, 2 Nov): do Focus pages need C1 at all? About 1 h 15, then tonight.bat carries on.
rem  1 A3's maps (the subject finder before v329.3, TRACER-TE0) and a no-model oval's, for the TUNE photos
rem  2 X0+cap with each, against X0+cap with C1's maps (x0c-TUNE), as E6-mix was read (decision 156's line)
rem  3 the two runs gathered in checks-results, to copy to the Mac
rem  4 tonight.bat carries on: the training from the pass it stopped in, then 6-results and the rest (close the window
rem    after "Checks done" if you'd rather not)
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
if not exist "%PY%" (echo checks.bat must be in ms-subject-train, beside .venv: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\x0c-TUNE" (echo Grid 3's runs are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%PH%\index.csv" (echo The bench photos are not where bench-pc.bat put them: tell Claude. & pause & exit /b 1)
if not exist "%KIT%\checks\subject-te0.onnx" (echo Unzip all of ms-checks.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%GRID%\x0c\scripts\bench\pp_oval.py" (echo Unzip all of ms-checks.zip over ms-subject-train first. & pause & exit /b 1)
set W=14
set OPT=--cache "%CACHE%" --photos "%PH%" --workers %W%
set ALL=--modes even,sharp,calm
set LOG=%~dp0checks-log.txt
set PYTHONUTF8=1
echo Checks started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"

echo.
echo === 1 of 3: A3's maps and the oval's, for the TUNE photos (a few minutes)
echo === 1 of 3 %TIME% >> "%LOG%"
pushd "%GRID%\x0c"
"%PY%" -I scripts\bench\pp_maps.py "%CACHE%" "%KIT%\checks\subject-te0.onnx" --tag subject-a3 --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
set MA=%errorlevel%
"%PY%" -I scripts\bench\pp_oval.py "%CACHE%" --tag oval --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
set MO=%errorlevel%
echo    maps: A3 exit %MA%, oval exit %MO% >> "%LOG%"

echo.
echo === 2 of 3: the builder with each, against C1's maps (about 1 h)
echo === 2 of 3 %TIME% >> "%LOG%"
if "%MA%"=="0" call :bench %OPT% --set TUNE %ALL% --map subject-a3 --compare x0c-TUNE --map-compare --tag x0c-a3
if "%MA%"=="0" echo    x0c-a3 exit %errorlevel% >> "%LOG%"
if "%MO%"=="0" call :bench %OPT% --set TUNE %ALL% --map oval --compare x0c-TUNE --map-compare --tag x0c-oval
if "%MO%"=="0" echo    x0c-oval exit %errorlevel% >> "%LOG%"
popd

echo.
echo === 3 of 3: gathered in checks-results
set OUT=%KIT%\checks-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
for %%R in (x0c-a3 x0c-oval) do if exist "%CACHE%\runs\%%R" robocopy "%CACHE%\runs\%%R" "%OUT%\runs\%%R" /e /xd pics /njh /njs /nfl /ndl >nul
copy /y "%CACHE%\runs\LOG.md" "%OUT%\runs\" >nul 2>nul
echo Checks finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo Checks done. Copy checks-results (in ms-subject-train) to the Mac's Claude outputs and tell Claude.
echo The training now carries on (tonight.bat): close this window if you'd rather it didn't.
echo.
endlocal
call "%~dp0tonight.bat"
exit /b 0

:bench
rem (one bench step; if it doesn't finish it is run once more: it carries on where it stopped)
node scripts\bench\pp-bench.mjs %* >> "%LOG%" 2>&1
if not "%errorlevel%"=="0" (
  echo    ^(exit %errorlevel%: running this step once more^) >> "%LOG%"
  node scripts\bench\pp-bench.mjs %* >> "%LOG%" 2>&1
)
exit /b
