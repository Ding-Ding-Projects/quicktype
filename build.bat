@echo off
rem Builds quicktype Studio from a fresh checkout.
rem   build.bat [--run] [/s ^| --silent]       (or set SILENT=1)
rem   --run  launches the desktop app after a successful build.
setlocal EnableDelayedExpansion
set "RUN="
set "ARGS="
for %%a in (%*) do (
  if /i "%%~a"=="--run" ( set "RUN=1" ) else ( set "ARGS=!ARGS! %%~a" )
)
cd /d "%~dp0"
echo == Fetching dependencies
call download-dependencies.bat %ARGS% || ( echo Dependency step failed. & exit /b 1 )
echo == Building the quicktype engine
call npm run build --workspace quicktype-core --workspace quicktype-graphql-input --workspace quicktype-typescript-input || ( echo Engine build failed. & exit /b 1 )
echo == Building quicktype Studio
pushd studio
call npm run build:desktop || ( popd & echo Studio build failed. & exit /b 1 )
popd
echo == Building the website
pushd site
call node build.mjs || ( popd & echo Website build failed. & exit /b 1 )
popd
echo Build finished: studio\dist\web, studio\desktop\engine.bundle.cjs and site\dist.
if defined RUN (
  echo == Launching quicktype Studio
  pushd studio
  call npx electron .
  set "CODE=!errorlevel!"
  popd
  exit /b !CODE!
)
exit /b 0
