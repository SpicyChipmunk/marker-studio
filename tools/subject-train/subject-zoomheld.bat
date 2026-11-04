@echo off
rem The zoom's confirmation (Ben, 3 Nov). About 30 minutes, no questions asked. Needs subject-more.bat's maps.
rem  1 Focus first, on TUNE's zoomed photos: Sharper subject and Simpler background with the zoom against C1 alone at
rem    the same size. If either is worse by the rule, it stops here and HELD is not looked at.
rem  2 the one HELD look for the zoom: HELD's zoomed photos' Subject only pages, the zoom against C1 alone at the same
rem    size (HELD's numbers are differences only)
rem  3 gathered in zoomheld-results, to copy to the Mac
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
if not exist "%PY%" (echo subject-zoomheld.bat must be in ms-subject-train, beside .venv: tell Claude. & pause & exit /b 1)
findstr /c:"only-zoomed" "%GRID%\g3\scripts\bench\pp_zoom.py" >nul 2>nul || (echo Unzip all of ms-zoomheld.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%KIT%\checks\subject-c1.onnx" (echo C1's file from ms-more.zip is missing: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\maps\subject-te4zoom\zoom.json" (echo subject-more.bat's zoom maps are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\g3s-te4zoom\results.json" (echo subject-more.bat's runs are not in bench-cache: tell Claude. & pause & exit /b 1)
if exist "%CACHE%\runs\g3h-te4zoom\results.json" (echo The HELD look for the zoom has been made already: a second one is not allowed. Tell Claude. & pause & exit /b 1)
set W=14
set OPT=--cache "%CACHE%" --photos "%PH%" --workers %W%
set X=--x lam=0.1,mu=0.25
set C1=%KIT%\checks\subject-c1.onnx
set LOG=%~dp0zoomheld-log.txt
set PYTHONUTF8=1
echo Zoom HELD started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"
pushd "%GRID%\g3"

echo.
echo === 1 of 3: Focus on TUNE's zoomed photos (about 10 minutes)
echo === 1 of 3 %TIME% >> "%LOG%"
"%PY%" -I scripts\bench\pp_zoom.py "%CACHE%" "%C1%" --base subject-te4 --tag subject-te4zoom --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
set ZT=%CACHE%\maps\subject-te4zoom\zoomed-TUNE.txt
if not exist "%ZT%" (echo    TUNE's zoomed list was not made: stopped >> "%LOG%" & goto gather)
call :bench %OPT% --set TUNE --modes sharp,calm %X% --map subject-te4up --ids "%ZT%" --tag g3f-te4up
echo    g3f-te4up exit %errorlevel% >> "%LOG%"
call :bench %OPT% --set TUNE --modes sharp,calm %X% --map subject-te4zoom --ids "%ZT%" --compare g3f-te4up --map-compare --tag g3f-te4zoom
echo    g3f-te4zoom exit %errorlevel% >> "%LOG%"
set FR=%CACHE%\runs\g3f-te4zoom\report.md
findstr /c:"Decision 156's reading" "%FR%" >nul 2>nul || (echo    Focus was not read: HELD not looked at >> "%LOG%" & goto gather)
findstr /c:"better, worse" "%FR%" >nul 2>nul && (echo    Focus is worse with the zoom: HELD not looked at >> "%LOG%" & echo Focus is worse with the zoom: HELD is not looked at. & goto gather)
echo    Focus not worse: on to the HELD look >> "%LOG%"

echo.
echo === 2 of 3: the one HELD look for the zoom (about 15 minutes)
echo === 2 of 3 %TIME% >> "%LOG%"
"%PY%" -I scripts\bench\pp_zoom.py "%CACHE%" "%C1%" --base subject-te4 --tag subject-te4zoom --only-zoomed --set HELD --photos "%PH%" >> "%LOG%" 2>&1
set ZH=%CACHE%\maps\subject-te4zoom\zoomed-HELD.txt
if not exist "%ZH%" (echo    HELD's zoomed list was not made: stopped >> "%LOG%" & goto gather)
"%PY%" -I scripts\bench\pp_zoom.py "%CACHE%" "%C1%" --base subject-te4 --tag subject-te4up --up --ids "%ZH%" --set HELD --photos "%PH%" >> "%LOG%" 2>&1
set MU=%errorlevel%
echo    HELD maps: up exit %MU% >> "%LOG%"
if not "%MU%"=="0" goto gather
call :bench %OPT% --set HELD --modes subject %X% --map subject-te4up --ids "%ZH%" --tag g3h-te4up
echo    g3h-te4up exit %errorlevel% >> "%LOG%"
call :bench %OPT% --set HELD --modes subject %X% --map subject-te4zoom --ids "%ZH%" --compare g3h-te4up --map-compare --tag g3h-te4zoom
echo    g3h-te4zoom exit %errorlevel% >> "%LOG%"

:gather
popd
echo.
echo === 3 of 3: gathered in zoomheld-results
set OUT=%KIT%\zoomheld-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
for %%R in (g3f-te4up g3f-te4zoom g3h-te4up g3h-te4zoom) do if exist "%CACHE%\runs\%%R" robocopy "%CACHE%\runs\%%R" "%OUT%\runs\%%R" /e /xd pics /njh /njs /nfl /ndl >nul
copy /y "%CACHE%\maps\subject-te4zoom\zoom.json" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\maps\subject-te4zoom\zoomed-TUNE.txt" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\maps\subject-te4zoom\zoomed-HELD.txt" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\LOG.md" "%OUT%\runs\" >nul 2>nul
echo Zoom HELD finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo All done. Copy zoomheld-results (in ms-subject-train) to the Mac's Claude outputs and tell Claude.
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
