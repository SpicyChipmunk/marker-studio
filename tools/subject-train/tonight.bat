@echo off
rem Tonight (decisions 150, 155-157), one step after another, no questions asked: about 13-14 hours from 9 p.m.
rem  1 the one HELD look at X2+cap (bench, about 30 min)
rem  2 E6-mix's subject maps, and the builder with them (bench, about 1 h 15)
rem  3 E4-kd and E5-kd trained, taught by E6-mix (the card, about 8 h 30)
rem  4 6-results: both judged (about 2 h)
rem  5 the kd models' subject maps, and the builder with them (bench, about 1 h 15)
rem  6 everything gathered in tonight-results, to copy to the Mac
rem It lives in ms-subject-train, beside grid3 and bench-cache. Running it again carries on where it stopped (each step
rem skips what is finished). "tonight.bat check" only checks that everything is in place.
setlocal
cd /d "%~dp0"
set KIT=%~dp0.
set PYTHONUTF8=1
set PY=%KIT%\.venv\Scripts\python.exe
set GRID=%~dp0grid3
set CACHE=%~dp0bench-cache
if not exist "%CACHE%\runs\x0c-TUNE" set CACHE=%~dp0..\bench-cache
set PH=%KIT%\bench-photos
if not exist "%PH%\index.csv" set PH=%~dp0..\bench-photos
where node >nul 2>nul || (echo Node is not installed on this PC any more: tell Claude. & pause & exit /b 1)
if not exist "%PY%" (echo tonight.bat must be in ms-subject-train, beside .venv: tell Claude. & pause & exit /b 1)
findstr /c:"E5kd" "%KIT%\config.json" >nul 2>nul || (echo The kd kit is not unzipped over ms-subject-train yet: unzip ms-tonight.zip there first. & pause & exit /b 1)
findstr /c:"blend_to_stock" "%KIT%\common.py" >nul 2>nul || (echo Only part of the kd kit is here: unzip all of ms-tonight.zip. & pause & exit /b 1)
if not exist "%PH%\index.csv" (echo The bench photos are not where bench-pc.bat put them: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\x0c-TUNE" (echo Grid 3's runs are not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\g3-X2" (echo Grid 3's X2 run is not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%CACHE%\runs\x0c-HELD" (echo Grid 3's HELD baseline is not in bench-cache: tell Claude. & pause & exit /b 1)
if not exist "%GRID%\x0c\index.html" (echo grid3 is not in ms-subject-train: tell Claude. & pause & exit /b 1)
if not exist "%GRID%\g3\index.html" (echo grid3 is not in ms-subject-train: tell Claude. & pause & exit /b 1)
findstr /c:"held-look" "%GRID%\g3\scripts\bench\pp-bench.mjs" >nul 2>nul || (echo The new bench scripts are not in grid3: unzip all of ms-tonight.zip over ms-subject-train. & pause & exit /b 1)
findstr /c:"map-compare" "%GRID%\x0c\scripts\bench\pp-bench.mjs" >nul 2>nul || (echo The new bench scripts are not in grid3: unzip all of ms-tonight.zip over ms-subject-train. & pause & exit /b 1)
"%PY%" -c "import onnxruntime, numpy" 2>nul || (echo The kit's Python has no onnxruntime: tell Claude. & pause & exit /b 1)
rem (round 6's results kept on this PC before 6-results writes new ones; E6-mix's app file is read from this copy)
if not exist "%KIT%\results-round6\report.md" robocopy "%KIT%\results" "%KIT%\results-round6" /e /njh /njs /nfl /ndl >nul
if not exist "%KIT%\results-round6\report.md" (echo Could not keep a copy of round 6's results: tell Claude. & pause & exit /b 1)
set E6F=%KIT%\results-round6\models\subject-E6-mix-576-w8.onnx
if not exist "%E6F%" (echo E6-mix's app file is not in results\models: tell Claude. & pause & exit /b 1)
if /i "%~1"=="check" (echo Tonight is in place: cache %CACHE% & exit /b 0)
set W=14
set OPT=--cache "%CACHE%" --photos "%PH%" --workers %W%
set ALL=--modes even,sharp,calm
set LOG=%~dp0tonight-log.txt
echo Tonight started %DATE% %TIME% (cache %CACHE%) >> "%LOG%"

echo.
echo === 1 of 6: the one HELD look at X2+cap (decision 150; about 30 min). Don't open held-look.txt: Claude reads it.
echo === 1 of 6 %TIME% >> "%LOG%"
rem (made once: a second run would be a second look, so once it has finished it is not run again)
if exist "%~dp0held-look.done" (echo    already made. & echo 1 already made >> "%LOG%" & goto step2)
pushd "%GRID%\g3"
node scripts\bench\pp-bench.mjs %OPT% --set HELD %ALL% --x lam=0.1,mu=0.25 --compare x0c-HELD --held-look --tune-ref g3-X2 --tag g3-X2-HELD >> "%~dp0held-look.txt" 2>&1
rem (exit 3: refused before any page, nothing looked at; other failures run once more, carrying on where it stopped)
if errorlevel 1 if not errorlevel 3 node scripts\bench\pp-bench.mjs %OPT% --set HELD %ALL% --x lam=0.1,mu=0.25 --compare x0c-HELD --held-look --tune-ref g3-X2 --tag g3-X2-HELD >> "%~dp0held-look.txt" 2>&1
set HL=%errorlevel%
if "%HL%"=="0" echo made %DATE% %TIME% > "%~dp0held-look.done"
echo 1 done %TIME% (exit %HL%) >> "%LOG%"
popd

:step2
rem (already made, when tonight.bat is run again after checks.bat: not judged a second time)
if exist "%CACHE%\runs\x0c-e6mix\report.md" if exist "%CACHE%\runs\g3-X2-e6mix\report.md" (echo === 2 of 6: already made. & echo 2 already made >> "%LOG%" & goto step2b)

echo.
echo === 2 of 6: E6-mix's subject maps for the TUNE photos, then the builder with them, X0+cap and X2+cap (about 1 h 15)
echo === 2 of 6 %TIME% >> "%LOG%"
pushd "%GRID%\x0c"
rem (a bench only once its maps are all made: a photo benched without its map would never get its Focus rows)
call :maps "%E6F%" subject-e6mix
set MAPOK=%errorlevel%
if not "%MAPOK%"=="0" echo    E6-mix's maps were not all made (exit %MAPOK%): its two bench steps are skipped >> "%LOG%"
if "%MAPOK%"=="0" call :bench %OPT% --set TUNE %ALL% --map subject-e6mix --compare x0c-TUNE --map-compare --tag x0c-e6mix
if "%MAPOK%"=="0" echo    x0c-e6mix exit %errorlevel% >> "%LOG%"
popd
pushd "%GRID%\g3"
if "%MAPOK%"=="0" call :bench %OPT% --set TUNE %ALL% --x lam=0.1,mu=0.25 --map subject-e6mix --compare g3-X2 --map-compare --tag g3-X2-e6mix
if "%MAPOK%"=="0" echo    g3-X2-e6mix exit %errorlevel% >> "%LOG%"
popd
echo 2 done %TIME% >> "%LOG%"

:step2b
echo.
echo === 2b: the filter test (Ben, 2 Nov): E6-mix's maps with the snapping filter off and at half strength, and C1's
echo     with it off, each against C1 as the app runs it (about 1 h 30)
echo === 2b %TIME% >> "%LOG%"
if not exist "%GRID%\x0g\scripts\bench\pp-bench.mjs" (echo    no grid3\x0g: skipped >> "%LOG%" & goto step3)
pushd "%GRID%\x0g"
call :bench %OPT% --set TUNE %ALL% --map subject-e6mix --gf 0 --compare x0c-TUNE --map-compare --tag x0g-e6mix-gf0
echo    x0g-e6mix-gf0 exit %errorlevel% >> "%LOG%"
call :bench %OPT% --set TUNE %ALL% --map subject-e6mix --gf 4,0.004 --compare x0c-TUNE --map-compare --tag x0g-e6mix-gf4
echo    x0g-e6mix-gf4 exit %errorlevel% >> "%LOG%"
call :bench %OPT% --set TUNE %ALL% --map subject-te4 --gf 0 --compare x0c-TUNE --map-compare --tag x0g-c1-gf0
echo    x0g-c1-gf0 exit %errorlevel% >> "%LOG%"
popd
echo 2b done %TIME% >> "%LOG%"

:step3

echo.
echo === 3 of 6: E4-kd and E5-kd trained (about 8 h 30). The window shows the training; its own log is work\s5_train.log.
echo === 3 of 6 %TIME% >> "%LOG%"
"%PY%" s5_train.py --run E4kd,E5kd
set TR=%errorlevel%
echo 3 done %TIME% (exit %TR%) >> "%LOG%"

echo.
if "%TR%"=="1" (
  echo === 4 of 6: skipped. Training stopped before training anything: its message is above and in work\s5_train.log.
  echo 4 skipped: training exit 1 >> "%LOG%"
  goto kdmaps
)
echo === 4 of 6: 6-results, E4-kd and E5-kd judged beside round 6 (about 2 h)
echo === 4 of 6 %TIME% >> "%LOG%"
"%PY%" -c "import torchvision" 2>nul || "%PY%" -m pip install torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu126 --no-deps
"%PY%" s6_check.py
echo 4 done %TIME% (exit %errorlevel%) >> "%LOG%"

:kdmaps
echo.
echo === 5 of 6: the kd models' subject maps, then the builder with them (about 1 h 15; only for models 6-results exported)
echo === 5 of 6 %TIME% >> "%LOG%"
rem (6-results exports the passing ones, and E5-kd if it passes pending the iPad timing; a blend, if the alpha rule
rem chose one, is preferred, as E6-mix was)
set M=%KIT%\results\models
set E4F=
if exist "%M%\subject-E4kd-448-w8.onnx" set E4F=%M%\subject-E4kd-448-w8.onnx
if exist "%M%\subject-E4kd-mix-448-w8.onnx" set E4F=%M%\subject-E4kd-mix-448-w8.onnx
set E5F=
if exist "%M%\subject-E5kd-512-w8.onnx" set E5F=%M%\subject-E5kd-512-w8.onnx
if exist "%M%\subject-E5kd-mix-512-w8.onnx" set E5F=%M%\subject-E5kd-mix-512-w8.onnx
echo    E4-kd's file: "%E4F%"; E5-kd's file: "%E5F%" >> "%LOG%"
pushd "%GRID%\x0c"
set MAP4=1
if defined E4F call :maps "%E4F%" subject-e4kd
if defined E4F set MAP4=%errorlevel%
if "%MAP4%"=="0" call :bench %OPT% --set TUNE %ALL% --map subject-e4kd --compare x0c-TUNE --map-compare --tag x0c-e4kd
if "%MAP4%"=="0" echo    x0c-e4kd exit %errorlevel% >> "%LOG%"
set MAP5=1
if defined E5F call :maps "%E5F%" subject-e5kd
if defined E5F set MAP5=%errorlevel%
if "%MAP5%"=="0" call :bench %OPT% --set TUNE %ALL% --map subject-e5kd --compare x0c-TUNE --map-compare --tag x0c-e5kd
if "%MAP5%"=="0" echo    x0c-e5kd exit %errorlevel% >> "%LOG%"
echo    maps: E4-kd exit %MAP4%, E5-kd exit %MAP5% (1 with no file: not exported) >> "%LOG%"
popd
echo 5 done %TIME% >> "%LOG%"

echo.
echo === 6 of 6: everything gathered in tonight-results
set OUT=%KIT%\tonight-results
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\runs"
robocopy "%KIT%\results" "%OUT%\results-kd" /e /njh /njs /nfl /ndl >nul
for %%R in (g3-X2-HELD x0c-e6mix g3-X2-e6mix x0g-e6mix-gf0 x0g-e6mix-gf4 x0g-c1-gf0 x0c-a3 x0c-oval x0c-e4kd x0c-e5kd) do if exist "%CACHE%\runs\%%R" robocopy "%CACHE%\runs\%%R" "%OUT%\runs\%%R" /e /xd pics /njh /njs /nfl /ndl >nul
copy /y "%CACHE%\runs\LOG.md" "%OUT%\runs\" >nul 2>nul
copy /y "%~dp0held-look.txt" "%OUT%\" >nul 2>nul
copy /y "%KIT%\work\s5_train.log" "%OUT%\" >nul 2>nul
copy /y "%KIT%\work\s6_check.log" "%OUT%\" >nul 2>nul
echo Tonight finished %DATE% %TIME% >> "%LOG%"
copy /y "%LOG%" "%OUT%\" >nul
echo.
echo All done. Copy the folder tonight-results (in ms-subject-train) to the Mac's Claude outputs, and tell Claude.
pause
endlocal
exit /b 0

:maps
rem (one model's subject maps for the TUNE photos; run once more if it doesn't finish: it skips the maps it made)
"%PY%" -I scripts\bench\pp_maps.py "%CACHE%" %1 --tag %2 --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
if not "%errorlevel%"=="0" "%PY%" -I scripts\bench\pp_maps.py "%CACHE%" %1 --tag %2 --set TUNE --photos "%PH%" >> "%LOG%" 2>&1
exit /b

:bench
rem (one bench step; if it doesn't finish it is run once more: it carries on where it stopped)
node scripts\bench\pp-bench.mjs %* >> "%LOG%" 2>&1
if not "%errorlevel%"=="0" (
  echo    ^(exit %errorlevel%: running this step once more^) >> "%LOG%"
  node scripts\bench\pp-bench.mjs %* >> "%LOG%" 2>&1
)
exit /b
