@echo off
rem Two last checks of the subject map (Ben, 3 Nov). About 1 h 15, no questions asked. Needs about 2 GB free on this disk.
rem  1 stock TE4 (untrained, C1's start) as the app's file, and its maps for the TUNE photos
rem  2 C1 run a second time on a small subject's box (the zoom), and C1's map alone at the same size (the fair baseline)
rem  3 the pages: stock TE4 against C1 (Subject only, then Even, Sharper subject, Simpler background); C1 at the zoom's
rem    size against C1 (should change nothing); the zoom against C1 at the same size
rem  4 the zoom from the full-size photo, reported only: about 24 photos' originals downloaded from Open Images (Flickr),
rem    the zoom made from them, and those photos' Subject only pages against the zoom from the working picture
rem  5 gathered in more-results, to copy to the Mac
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
if not exist "%PY%" (echo subject-more.bat must be in ms-subject-train, beside .venv: tell Claude. & pause & exit /b 1)
if not exist "%KIT%\s6_stock_te4.py" (echo Unzip all of ms-more.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%GRID%\g3\scripts\bench\pp_zoomfull.py" (echo Unzip all of ms-more.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%GRID%\g3\scripts\bench\pp_zoom.py" (echo Unzip all of ms-more.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%KIT%\checks\subject-c1.onnx" (echo Unzip all of ms-more.zip over ms-subject-train first. & pause & exit /b 1)
if not exist "%KIT%\work\TRACER-Efficient-4.pth" (echo Stock TE4's weights are not in work: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\g3s-c1\results.json" (echo C1's Subject only run is not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\x0c-TUNE\results.json" (echo Grid 3's runs are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\maps\subject-te4\model.json" (echo C1's maps are not in bench-cache: tell Claude. & pause & exit /b 1)
set W=14
set OPT=--cache "%CACHE%" --photos "%PH%" --workers %W%
set SUB=--set TUNE --modes subject --x lam=0.1,mu=0.25
set LOG=%~dp0more-log.txt
set PYTHONUTF8=1
echo More started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"

echo.
echo === 1 of 5: stock TE4 as the app's file, and its maps (about 5 minutes)
echo === 1 of 5 %TIME% >> "%LOG%"
"%PY%" s6_stock_te4.py "%KIT%\checks" "%CACHE%" >> "%LOG%" 2>&1
set MS=%errorlevel%
echo    stock TE4 export exit %MS% >> "%LOG%"
pushd "%GRID%\g3"
if "%MS%"=="0" "%PY%" -I scripts\bench\pp_maps.py "%CACHE%" "%KIT%\checks\subject-TE4stock-448-w8.onnx" --tag subject-te4stock --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
if "%MS%"=="0" set MS=%errorlevel%
echo    stock TE4 maps exit %MS% >> "%LOG%"

echo.
echo === 2 of 5: the zoom's maps, and C1's at the same size (a few minutes)
echo === 2 of 5 %TIME% >> "%LOG%"
"%PY%" -I scripts\bench\pp_zoom.py "%CACHE%" "%KIT%\checks\subject-c1.onnx" --base subject-te4 --tag subject-te4up --up --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
set MU=%errorlevel%
"%PY%" -I scripts\bench\pp_zoom.py "%CACHE%" "%KIT%\checks\subject-c1.onnx" --base subject-te4 --tag subject-te4zoom --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
set MZ=%errorlevel%
echo    maps: up exit %MU%, zoom exit %MZ% >> "%LOG%"

echo.
echo === 3 of 5: the pages (about 50 minutes)
echo === 3 of 5 %TIME% >> "%LOG%"
if "%MS%"=="0" call :bench %OPT% %SUB% --map subject-te4stock --compare g3s-c1 --map-compare --tag g3s-te4stock
if "%MS%"=="0" echo    g3s-te4stock exit %errorlevel% >> "%LOG%"
if "%MU%"=="0" call :bench %OPT% %SUB% --map subject-te4up --compare g3s-c1 --map-compare --tag g3s-te4up
if "%MU%"=="0" echo    g3s-te4up exit %errorlevel% >> "%LOG%"
if "%MZ%"=="0" if "%MU%"=="0" call :bench %OPT% %SUB% --map subject-te4zoom --compare g3s-te4up --map-compare --tag g3s-te4zoom
if "%MZ%"=="0" if "%MU%"=="0" echo    g3s-te4zoom exit %errorlevel% >> "%LOG%"
echo.
echo === 4 of 5: the zoom from the full-size photo, a few photos (about 15 minutes, with the downloads)
echo === 4 of 5 %TIME% >> "%LOG%"
set MF=1
if "%MZ%"=="0" if "%MU%"=="0" "%PY%" -I scripts\bench\pp_zoomfull.py "%CACHE%" "%KIT%\checks\subject-c1.onnx" --photos "%PH%" --work "%KIT%\work\zoomfull" >> "%LOG%" 2>&1
if "%MZ%"=="0" if "%MU%"=="0" set MF=%errorlevel%
echo    zoom full size maps exit %MF% >> "%LOG%"
set ZI=%CACHE%\maps\subject-te4zoomfull\zoomfull-ids.txt
if "%MF%"=="0" call :bench %OPT% %SUB% --map subject-te4zoom --ids "%ZI%" --tag g3s-zf900
if "%MF%"=="0" echo    g3s-zf900 exit %errorlevel% >> "%LOG%"
if "%MF%"=="0" call :bench %OPT% %SUB% --map subject-te4zoomfull --ids "%ZI%" --compare g3s-zf900 --map-compare --tag g3s-zffull
if "%MF%"=="0" echo    g3s-zffull exit %errorlevel% >> "%LOG%"
popd
pushd "%GRID%\x0c"
if "%MS%"=="0" call :bench %OPT% --set TUNE --modes even,sharp,calm --map subject-te4stock --compare x0c-TUNE --map-compare --tag x0c-te4stock
if "%MS%"=="0" echo    x0c-te4stock exit %errorlevel% >> "%LOG%"
popd

echo.
echo === 5 of 5: gathered in more-results
set OUT=%KIT%\more-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
for %%R in (g3s-te4stock g3s-te4up g3s-te4zoom g3s-zf900 g3s-zffull x0c-te4stock) do if exist "%CACHE%\runs\%%R" robocopy "%CACHE%\runs\%%R" "%OUT%\runs\%%R" /e /xd pics /njh /njs /nfl /ndl >nul
copy /y "%CACHE%\maps\subject-te4zoom\zoom.json" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\maps\subject-te4zoomfull\zoomfull.json" "%OUT%\" >nul 2>nul
copy /y "%CACHE%\runs\LOG.md" "%OUT%\runs\" >nul 2>nul
echo More finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo All done. Copy more-results (in ms-subject-train) to the Mac's Claude outputs and tell Claude.
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
